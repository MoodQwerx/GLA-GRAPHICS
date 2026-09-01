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

    // Evaluate script in page to load image, draw to canvas, and check pixel values in the text area (e.g. x100, y90)
    console.log('Evaluating image pixels on program page...');
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
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            let nonTransparentCount = 0;
            
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                const alpha = data[idx + 3];
                if (alpha > 0) {
                  nonTransparentCount++;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
            
            return JSON.stringify({
              width: img.width,
              height: img.height,
              nonTransparentCount,
              minX,
              minY,
              maxX,
              maxY
            });
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
