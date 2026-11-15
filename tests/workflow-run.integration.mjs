import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { configuration } from './m2-guard.mjs';

process.loadEnvFile('.verification/m2.env');
delete process.env.NODE_OPTIONS;
process.env.M2_TEST_RUNTIME_DATABASE_URL ??= process.env.DATABASE_URL;
const cfg = configuration(process.env);
if (cfg.origin !== 'http://127.0.0.1:3000' || process.env.APP_ORIGIN !== cfg.origin)
  throw Error('Runner requires matching loopback origin3000');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
const secrets = [
  env.M2_TEST_DATABASE_URL,
  env.M2_TEST_RUNTIME_DATABASE_URL,
  env.DATABASE_URL,
  env.LOGIN_VERIFIER_SECRET,
].filter(Boolean);
function safe(value) {
  let s = String(value);
  for (const secret of secrets) s = s.replaceAll(secret, '[redacted]');
  return s.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[redacted database URL]');
}
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
  { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
);
let tests;
let appLogTail = '';
try {
  await new Promise((resolve, reject) => {
    let tail = '';
    const timeout = setTimeout(() => reject(Error('Server readiness timeout')), 45000);
    const finish = (fn) => {
      clearTimeout(timeout);
      fn();
    };
    const receive = (chunk) => {
      tail = (tail + chunk).slice(-10000);
      appLogTail = (appLogTail + chunk.toString()).slice(-16000);
      // Do not forward app request logs, which may include credential-related diagnostics.
      if (/EADDRINUSE|Another next dev server|Failed to start server/.test(tail))
        finish(() => reject(Error('Port/project already in use; no unrelated process stopped')));
      else if (/Ready in/.test(tail)) finish(resolve);
    };
    server.stdout.on('data', receive);
    server.stderr.on('data', receive);
    server.once('error', () => finish(() => reject(Error('Server process spawn failed'))));
    server.once('exit', (code) =>
      finish(() => reject(Error(`Server exited before readiness: ${code}`)))
    );
  });
  process.stdout.write(`Owned server ready (PID ${server.pid}); executing integration suite\n`);
  tests = spawn(
    process.execPath,
    [
      '--test-isolation=none',
      '--test',
      'tests/m2-identity.integration.mjs',
      'tests/m3-inventory.integration.mjs',
      'tests/workflow-basic.integration.mjs',
    ],
    { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  tests.stdout.on('data', (chunk) => process.stdout.write(safe(chunk)));
  tests.stderr.on('data', (chunk) => process.stderr.write(safe(chunk)));
  const watchdog = setTimeout(() => tests.kill(), 90000);
  try {
    const [code] = await once(tests, 'exit');
    process.exitCode = code ?? 1;
    if (process.exitCode !== 0) {
      process.stderr.write('Application server diagnostics (secrets masked):\\n' + safe(appLogTail.slice(-9000)) + '\\n');
    }
  } finally {
    clearTimeout(watchdog);
  }
} catch (error) {
  process.stderr.write(safe(error.message) + '\n');
  process.exitCode = 1;
} finally {
  if (tests && tests.exitCode === null && !tests.killed) tests.kill();
  if (server.pid && server.exitCode === null) {
    if (process.platform === 'win32') {
      // PID comes directly from our still-live spawn object; never discover/kill another server.
      const cleanup = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      await once(cleanup, 'exit');
    } else {
      server.kill();
      await once(server, 'exit');
    }
  }
}
