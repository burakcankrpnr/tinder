// Kullanım: node scripts/tick-spec.mjs 12 15-18 ...  — verilen satırlardaki "- [ ]" kutucuklarını işaretler.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../DATING_PLATFORM_SPEC.md', import.meta.url);
const lines = readFileSync(file, 'utf8').split('\n');
const targets = new Set();
for (const arg of process.argv.slice(2)) {
  const [start, end = start] = arg.split('-').map(Number);
  for (let n = start; n <= end; n++) targets.add(n);
}
let ticked = 0;
for (const n of targets) {
  const index = n - 1;
  if (lines[index]?.includes('- [ ]')) {
    lines[index] = lines[index].replace('- [ ]', '- [x]');
    ticked++;
  }
}
writeFileSync(file, lines.join('\n'));
console.log(`${ticked} kutucuk işaretlendi`);
