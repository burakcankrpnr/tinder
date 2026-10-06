import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = new Date().toISOString().replaceAll(/[-:]/g, '').replace('T', '-').slice(0, 15);
const outDir = join(root, 'backups');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `dating-${stamp}.sql.gz`);

const dump = spawn(
  'docker',
  ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'dating', '-d', 'dating', '--no-owner', '--format=plain'],
  { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
);

await pipeline(dump.stdout, createGzip(), createWriteStream(outFile));
if (dump.exitCode) process.exit(dump.exitCode ?? 1);
console.log(`Yedek: ${outFile}`);
