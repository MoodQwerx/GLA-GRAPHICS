import { exec } from 'node:child_process';
import { WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const PORT = 9222;
const stateFile = path.join(process.cwd(), 'data', 'master-control-state.json');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  console.log('--- DEBUGGING PROGRAM RENDER ---');

  let backup = null;
  if (fs.existsSync(stateFile)) {
    backup = fs.readFileSync(stateFile, 'utf8');
    console.log('Backed up state.');
  }

  // Inject active state
  const testState = {
    sideTable: {
      posicion: 'placaL',
      titulo: 'RESULTADOS',
      encuentros: [
        { teamA: 'calambres', teamB: 'gambeta', status: 'final', scoreA: '3', scoreB: '1' }
      ]
    }
  };
  fs.writeFileSync(stateFile, JSON.stringify(testState));
  await delay(1000);

  // Stop current server and start test server
  console.log('Restarting server...');
  exec('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 4400).OwningProcess -Force -ErrorAction SilentlyContinue"');
  await delay(2000);
  const serverProc = exec('node server/index.js');
  await delay(2000);

  console.log('Launching browser...');
  const browserProc = exec(`${EDGE_PATH} --headless --remote-debugging-port=${PORT} about:blank`);
  await delay(2000);

  try {
    const list = await getJson(`http://localhost:${PORT}/json/list`);
    const page = list.find((p) => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Page.navigate', params: { url: 'http://localhost:4400/master' } }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Console.messageAdded') {
        console.log(`[Browser Console]: ${msg.params.message.text}`);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error(`[Browser Exception]:`, msg.params.exceptionDetails.exception.description);
      }
    });

    await delay(3000);

    console.log('Clicking sideTable tab and TAKE...');
    ws.send(JSON.stringify({
      id: 5,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (() => {
            document.querySelector('button[data-id="sideTable"]').click();
            return 'Tab clicked';
          })()
        `
      }
    }));
    await delay(1000);

    ws.send(JSON.stringify({
      id: 6,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (() => {
            document.getElementById('btn-take').click();
            return 'Take clicked';
          })()
        `
      }
    }));
    await delay(2000);

    console.log('Navigating page to program overlay...');
    ws.send(JSON.stringify({ id: 7, method: 'Page.navigate', params: { url: 'http://localhost:4400/program' } }));
    await delay(3000);

    console.log('Reading program DOM innerHTML...');
    ws.send(JSON.stringify({
      id: 8,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (() => {
            const mod = document.getElementById('mod-sideTable');
            return JSON.stringify({
              bodyHTML: document.body.innerHTML,
              modClasses: mod ? mod.className : 'null',
              modInnerHTML: mod ? mod.innerHTML : 'null'
            });
          })()
        `
      }
    }));

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 8) {
        const valStr = msg.result?.result?.value;
        if (valStr) {
          const val = JSON.parse(valStr);
          console.log('\n--- DOM STATE ---');
          console.log('modClasses:', val.modClasses);
          console.log('modInnerHTML:', val.modInnerHTML);
          console.log('-----------------\n');
        } else {
          console.log('No value returned from DOM query');
        }
      }
    });

    await delay(3000);
    ws.close();
    browserProc.kill();

  } catch (err) {
    console.error('Error:', err.message);
    browserProc.kill();
  } finally {
    console.log('Cleaning up...');
    exec('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 4400).OwningProcess -Force -ErrorAction SilentlyContinue"');
    await delay(2000);
    serverProc.kill();

    if (backup) {
      fs.writeFileSync(stateFile, backup);
      console.log('Restored state backup.');
    } else {
      if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    }

    console.log('Restarting original server...');
    exec('node server/index.js');
    await delay(2000);
  }
}

main().catch(console.error);
