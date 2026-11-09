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
  await new Promise(resolve => reservation.close(resolve));
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Local server did not become ready: ${output}`)), 25000);
    const receive = chunk => {
      output += chunk.toString();
      if (/Ready in/.test(output)) { clearTimeout(timeout); resolve(); }
    };
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Local server exited ${code}: ${output}`)); });
  });
});

after(() => { child?.kill(); });

test('production page renders the synthetic preview and skip-link destination', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-powered-by'), null);
  const html = await response.text();
  assert.match(html, /Synthetic demonstration/);
  assert.match(html, /Example laboratories/);
  assert.match(html, /href="#main"/);
  assert.match(html, /id="main"/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i);
});

test('operational command routes are unavailable', async () => {
  for (const route of ['/api/v1/handovers', '/api/v1/return-receipts', '/api/v1/intents', '/api/v1/requests/example/submissions', '/api/v1/approval-assignments/example/decisions']) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.ok([404, 405].includes(response.status), `${route}: ${response.status}`);
  }
});

test('all four previews render as non-operational synthetic layouts', async () => {
  for (const flow of ['requests', 'approvals', 'collection', 'returns']) {
    const response = await fetch(`${baseUrl}/preview/${flow}`);
    assert.equal(response.status, 200, flow);
    const html = await response.text();
    assert.match(html, /Synthetic layout preview/);
    assert.match(html, /all workflow actions unavailable/);
    assert.match(html, /<caption\b/);
    assert.doesNotMatch(html, /<form\b/i);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i);
  }
});
