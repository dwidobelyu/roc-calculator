// Copies regenerated master data JSON files into public/data.
// Usage: npm run data:sync -- <folder with the JSON files>
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2];
if (!SRC) {
  console.error('Usage: npm run data:sync -- <folder with the JSON files>');
  process.exit(1);
}
const DEST = join(import.meta.dirname, '../public/data');
// Only files the app already loads are copied, so a stray file in the source folder is not published.
const FILES = readdirSync(DEST).filter((f) => f.endsWith('.json'));

mkdirSync(DEST, { recursive: true });
const missing = FILES.filter((f) => !existsSync(join(SRC, f)));
if (missing.length) {
  console.error(`Missing in ${SRC}: ${missing.join(', ')}`);
  process.exit(1);
}
for (const f of FILES) copyFileSync(join(SRC, f), join(DEST, f));
console.log(`Copied ${FILES.length} files to ${DEST}`);
