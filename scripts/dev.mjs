import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? 'unknown'}`));
    });
  });
}

function startExpoGo() {
  if (process.platform === 'win32') {
    const script = join(root, 'scripts', 'expo-go.cmd');
    const expo = spawn('cmd.exe', ['/d', '/c', `start "Expo Go" cmd /k "${script}"`], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true,
    });
    expo.unref();
    return;
  }

  const expo = spawn(pnpm, ['--filter', '@dating/mobile', 'dev'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: '' },
  });
  expo.on('exit', (code) => {
    if (code && code !== 0) process.kill(process.pid, 'SIGTERM');
  });
}

await run('docker', ['compose', 'up', '-d']);
startExpoGo();
console.log('Expo Go ayrı pencerede açılıyor. Telefonda QR kodu okutun.');

const turbo = spawn(pnpm, ['exec', 'turbo', 'run', 'dev', '--filter=!@dating/mobile'], {
  cwd: root,
  stdio: 'inherit',
});

const stop = () => {
  turbo.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

turbo.on('exit', (code) => {
  process.exit(code ?? 0);
});
