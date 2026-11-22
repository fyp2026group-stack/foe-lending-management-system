import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';

let child;
let baseUrl;

before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'),
    'Foundation HTTP tests require a production build: run npm run build before npm test');
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );
  await new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    let probe;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(probe);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => finish(new Error(
      'Local server did not serve /login: ' + output)), 25000);
    const receive = (chunk) => {
      output = (output + chunk.toString()).slice(-8000);
    };
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    child.once('error', (error) => {
      finish(error);
    });
    child.once('exit', (code) => {
      finish(new Error('Local server exited ' + code + ': ' + output));
    });
    // Next logs "Ready in" before loading the build/config. Require a real
    // HTTP response so a startup crash cannot masquerade as test readiness.
    const check = async () => {
      try {
        const response = await fetch(baseUrl + '/login', { signal: AbortSignal.timeout(2000) });
        await response.arrayBuffer();
        if (response.status === 200) return finish();
      } catch { /* The socket may not be listening yet. */ }
      if (!settled) probe = setTimeout(check, 100);
    };
    void check();
  });
});
after(async () => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill();
  });
});

test('root redirects to the authenticated workspace; sign-in retains accessible entry', async () => {
  const response = await fetch(baseUrl, { redirect: 'manual' });
  assert.ok([307, 308].includes(response.status), 'Unexpected redirect: ' + response.status);
  assert.equal(new URL(response.headers.get('location'), baseUrl).pathname, '/workspace');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-powered-by'), null);

  const login = await fetch(baseUrl + '/login');
  assert.equal(login.status, 200);
  assert.match(login.headers.get('content-type'), /text\/html/);
  const html = await login.text();
  assert.match(html, /href="#main"/);
  assert.match(html, /id="main"/);
  assert.match(html, /<form\b/i);
  assert.match(html, /Sign in/);
  assert.equal(login.headers.get('x-powered-by'), null);
});

test('legacy unauthenticated command endpoints fail closed', async () => {
  for (const route of [
    '/api/v1/handovers',
    '/api/v1/return-receipts',
    '/api/v1/intents',
    '/api/v1/requests/example/submissions',
    '/api/v1/approval-assignments/example/decisions',
  ]) {
    const response = await fetch(baseUrl + route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.ok(response.status >= 400 && response.status < 500, route + ': ' + response.status);
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('legacy preview URLs redirect to real borrowing screens rather than synthetic previews', async () => {
  for (const flow of ['requests', 'approvals', 'collection', 'returns']) {
    const response = await fetch(baseUrl + '/preview/' + flow, { redirect: 'manual' });
    assert.ok([307, 308].includes(response.status), flow + ': ' + response.status);
    const destination = new URL(response.headers.get('location'), baseUrl);
    assert.equal(destination.pathname, '/borrowing', flow);
    assert.equal(destination.searchParams.get('view'), flow, flow);
  }
});
