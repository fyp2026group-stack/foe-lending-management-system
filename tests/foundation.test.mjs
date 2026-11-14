import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';

let child;
let baseUrl;

before(async () => {
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
    const timeout = setTimeout(
      () => reject(new Error('Local server did not become ready: ' + output)),
      25000
    );
    const receive = (chunk) => {
      output += chunk.toString();
      if (/Ready in/.test(output)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error('Local server exited ' + code + ': ' + output));
    });
  });
});
after(() => {
  child?.kill();
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
