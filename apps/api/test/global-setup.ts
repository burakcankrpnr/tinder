import { execSync } from 'node:child_process';
import path from 'node:path';
import { TEST_DATABASE_URL } from './test-env';

export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../../../packages/database'),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
