// Heap snapshot de la página Master de una corrida en curso (TEMPORAL).
import fs from 'node:fs';
import { CDP, Page } from './cdp.mjs';
const out = process.argv[2];
const cdp = await CDP.connect(9333);
const { targetInfos } = await cdp.send('Target.getTargets');
const master = targetInfos.find((t) => t.type === 'page' && t.url.includes('/master-control'));
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: master.targetId, flatten: true });
const page = new Page(cdp, sessionId, master.targetId);
await page.heapSnapshot(out, fs);
console.log('ok', out);
process.exit(0);
