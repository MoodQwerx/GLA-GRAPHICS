import { exec } from 'node:child_process';
import { WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const PORT = 9222;
const stateFile = path.join(process.cwd(), 'data', 'master-control-state.json');
const outputPath = 'C:/Users/CONTROLÑ/.gemini/antigravity-ide/brain/90ea9701-9a55-4556-a415-42b9ebf76184/scratch/program_results_now.png';

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
  console.log('--- CAPTURING CURRENT PROGRAM RESULTS SCREENSHOT ---');

  let backup = null;
  if (fs.existsSync(stateFile)) {
    backup = fs.readFileSync(stateFile, 'utf8');
    console.log('Backed up state file.');
  }

  // Inject active state with 3 mock matches of varying scores/statuses
  console.log('Injecting state...');
  const testState = {
    sideTable: {
      posicion: 'placaL',
      titulo: 'RESULTADOS',
      encuentros: [
        { teamA: 'calambres', teamB: 'gambeta', status: 'final', scoreA: '3', scoreB: '1' },
        { teamA: 'actores', teamB: 'brg', status: 'entretiempo', scoreA: '0', scoreB: '0' },
        { teamA: 'la-32', teamB: 'los-displicentes', status: 'hora', hora: '18:30' }
      ]
    }
  };
  fs.writeFileSync(stateFile, JSON.stringify(testState));
  await delay(1000);

  console.log('Stopping active server on 4400...');
  try {
    execSync('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 4400 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"');
  } catch (e) {
    // Ignore
  }
  await delay(3000);

  console.log('Starting server...');
  const serverProc = exec('node server/index.js');
  await delay(3000);

  console.log('Launching browser...');
  const browserProc = exec(`${EDGE_PATH} --headless --remote-debugging-port=${PORT} --window-size=1920,1080 about:blank`);
  await delay(2000);

  try {
    const list = await getJson(`http://localhost:${PORT}/json/list`);
    const page = list.find((p) => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
      ws.send(JSON.stringify({
        id: 20,
        method: 'Emulation.setDeviceMetricsOverride',
        params: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          mobile: false
        }
      }));
      console.log('Navigating to Master Control: http://localhost:4400/master ...');
      ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://localhost:4400/master' } }));
    });

    await delay(3000); // Wait for master control to load

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

    console.log('Navigating to Program: http://localhost:4400/program ...');
    ws.send(JSON.stringify({ id: 7, method: 'Page.navigate', params: { url: 'http://localhost:4400/program' } }));
    await delay(3000); // Wait for page load and WebSocket connection

    console.log('Waiting for mod-sideTable to become visible (is-in and content-in)...');
    ws.send(JSON.stringify({
      id: 11,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
              attempts++;
              const mod = document.getElementById('mod-sideTable');
              const overlay = mod ? mod.querySelector('.gfx-overlay') : null;
              if (mod && mod.classList.contains('is-in') && overlay && overlay.classList.contains('content-in')) {
                resolve('visible');
              } else if (attempts > 100) {
                resolve('timeout');
              } else {
                setTimeout(check, 100);
              }
            };
            check();
          })
        `,
        awaitPromise: true
      }
    }));

    // Listen to visibility response
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 11) {
        console.log('Overlay visibility status:', msg.result?.result?.value);
      }
    });

    await delay(2000); // Small buffer for rendering

    console.log('Taking screenshot...');
    ws.send(JSON.stringify({
      id: 8,
      method: 'Page.captureScreenshot',
      params: {
        format: 'png',
        fromSurface: true
      }
    }));

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 8) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          const imgDir = path.dirname(outputPath);
          if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
          fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
          console.log(`Screenshot saved successfully to ${outputPath}`);
        } else {
          console.error('FAILED: No screenshot data received');
        }
      }
    });

    await delay(2000);
    ws.close();
    browserProc.kill();

  } catch (err) {
    console.error('Error during capture:', err.message);
    browserProc.kill();
  } finally {
    console.log('Stopping test server...');
    exec('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 4400).OwningProcess -Force -ErrorAction SilentlyContinue"');
    await delay(2000);
    serverProc.kill();

    if (backup) {
      fs.writeFileSync(stateFile, backup);
      console.log('Restored state file backup.');
    } else {
      if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    }

    console.log('Restarting original server...');
    exec('node server/index.js');
    await delay(2000);
  }
}

main().catch(console.error);
