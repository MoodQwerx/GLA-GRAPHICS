import { exec } from 'node:child_process';
import { WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const PORT = 9222;
const scratchDir = 'C:/Users/CONTROLÑ/.gemini/antigravity-ide/brain/3c6ee6c0-1f10-40cb-9b03-716164c22230/scratch';

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
  console.log('Starting headless browser...');
  const browserProc = exec(`${EDGE_PATH} --headless --remote-debugging-port=${PORT} --window-size=1920,1080 about:blank`);
  await delay(2000);

  try {
    const list = await getJson(`http://localhost:${PORT}/json/list`);
    const page = list.find((p) => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const browserWs = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => {
      browserWs.on('open', () => {
        browserWs.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        browserWs.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
        browserWs.send(JSON.stringify({
          id: 20,
          method: 'Emulation.setDeviceMetricsOverride',
          params: { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }
        }));
        browserWs.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://localhost:4400/program' } }));
        resolve();
      });
    });
    await delay(2000);

    const ws = new WebSocket('ws://localhost:4400/ws');
    await new Promise((resolve) => ws.on('open', resolve));

    // Clear all
    ws.send(JSON.stringify({ type: 'OUT', moduleId: 'scoreboard' }));
    ws.send(JSON.stringify({ type: 'OUT', moduleId: 'marcadorZocalo' }));
    await delay(500);

    // Take marcadorZocalo
    console.log('Sending UPDATE & TAKE for marcadorZocalo...');
    ws.send(JSON.stringify({
      type: 'UPDATE',
      moduleId: 'marcadorZocalo',
      data: { titulo: 'TEST MARCADOR ZÓCALO', clock: { elapsed: 3540000, running: false } }
    }));
    await delay(500);
    ws.send(JSON.stringify({ type: 'TAKE', moduleId: 'marcadorZocalo' }));
    await delay(2000);

    // Capture screenshot
    console.log('Capturing screenshot...');
    browserWs.send(JSON.stringify({
      id: 8,
      method: 'Page.captureScreenshot',
      params: { format: 'png', fromSurface: true }
    }));

    const screenshotData = await new Promise((resolve) => {
      const onMsg = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 8) {
          browserWs.off('message', onMsg);
          resolve(msg.result?.data);
        }
      };
      browserWs.on('message', onMsg);
    });

    if (screenshotData) {
      const outPath = path.join(scratchDir, 'debug_marcador_zocalo.png');
      fs.writeFileSync(outPath, Buffer.from(screenshotData, 'base64'));
      console.log(`Saved screenshot to ${outPath}`);
    } else {
      console.error('No screenshot data received');
    }

    // Clean up
    ws.send(JSON.stringify({ type: 'OUT', moduleId: 'marcadorZocalo' }));
    await delay(500);
    ws.close();
    browserWs.close();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    browserProc.kill();
  }
}

main().catch(console.error);
