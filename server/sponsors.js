import fs from 'node:fs';
import path from 'node:path';

const SPONSORS_DIR = path.join(process.cwd(), 'Sponsors');

export function getSponsorsCatalog() {
  const catalog = {
    scoreboard: [],
    var: [],
    vs_compact: [],
    zocalo: []
  };

  const map = {
    scoreboard: 'SPONSOR MARCADOR',
    var: 'SPONSOR VAR',
    vs_compact: 'SPONSOR ZOCALO MEDIO',
    zocalo: 'SPONSORS ZOCALO'
  };

  for (const [key, folderName] of Object.entries(map)) {
    const dirPath = path.join(SPONSORS_DIR, folderName);
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f));
        catalog[key] = files.map(file => ({
          name: path.basename(file, path.extname(file)),
          file: `/assets/sponsors/${encodeURIComponent(folderName)}/${encodeURIComponent(file)}`
        }));
      }
    } catch (e) {
      console.error(`Error reading sponsor folder ${folderName}:`, e);
    }
  }

  return catalog;
}
