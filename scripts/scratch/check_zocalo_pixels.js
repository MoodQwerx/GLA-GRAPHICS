import { exec } from 'node:child_process';
import { WebSocket } from 'ws';
import http from 'node:http';

const EDGE_PATH = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const PORT = 9222;

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
  const browserProc = exec(`${EDGE_PATH} --headless --remote-debugging-port=${PORT} about:blank`);
  await delay(2000);

  try {
    const list = await getJson(`http://localhost:${PORT}/json/list`);
    const page = list.find((p) => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://localhost:4400/program' } }));
        resolve();
      });
    });
    await delay(2000);

    console.log('Sampling pixels...');
    ws.send(JSON.stringify({
      id: 8,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (async () => {
            const img = new Image();
            img.src = '/assets/marcador/marcador-zocalo.png';
            await new Promise(r => img.onload = r);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const samples = [];
            for (let y = 70; y <= 115; y++) {
              const idx = (y * canvas.width + 400) * 4;
              samples.push({
                y,
                color: [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]
              });
            }
            return JSON.stringify(samples);
          })()
        `,
        awaitPromise: true
      }
    }));

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 8) {
        console.log('Result:', msg.result?.result?.value);
      }
    });

    await delay(2000);
    ws.close();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    browserProc.kill();
  }
}

main().catch(console.error);
