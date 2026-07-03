import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveBundledDbPath(filename) {
  const candidates = [
    path.join(serverDir, 'db', filename),
    path.join(serverDir, '..', 'db', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
