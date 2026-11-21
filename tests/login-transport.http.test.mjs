import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.LOGIN_TRANSPORT_ORIGIN;
const sentinel = 'synthetic-transport-sentinel';
test('login transport rejects URL credentials and cleans navigation before rendering', {
  skip: !base && 'Set LOGIN_TRANSPORT_ORIGIN to a running local app',
}, async () => {
  const origin = new URL(base);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname));
  async function request(path, init) {
    const response = await fetch(new URL(path, origin), { redirect: 'manual', ...init });
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    const body = await response.text();
    assert.ok(!body.includes(sentinel), 'Response must not reflect synthetic credentials');
    assert.equal(response.headers.get('set-cookie'), null);
    return { response, body };
  }
  const query = `?email=${sentinel}%40example.invalid&password=${sentinel}`;
  for (const path of ['/login' + query, '/login?google=' + sentinel, '/login?google=denied&password=' + sentinel]) {
    const { response } = await request(path);
    assert.equal(response.status, 303);
    const destination = new URL(response.headers.get('location'), origin);
    assert.equal(destination.pathname, '/login');
    assert.ok(!destination.href.includes(sentinel));
  }
  const { response: fallback } = await request('/login', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `email=${sentinel}%40example.invalid&password=${sentinel}`,
  });
  assert.equal(fallback.status, 303);
  assert.equal(new URL(fallback.headers.get('location'), origin).search, '');
  const { body: html, response: page } = await request('/login');
  assert.equal(page.status, 200);
  const form = html.match(/<form\b[^>]*>/)?.[0] ?? '';
  assert.match(form, /method="post"/i);
  assert.match(form, /action="\/login"/);
  assert.match(html, /type="password"/);
  assert.ok(!/<script[^>]+src="https?:\/\//i.test(html), 'No external script on login');
  const { response: get } = await request('/api/auth/login' + query);
  assert.equal(get.status, 405);
  const { response: mixed } = await request('/api/auth/login' + query, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: origin.origin },
    body: JSON.stringify({ email: `${sentinel}@example.invalid`, password: sentinel }),
  });
  assert.equal(mixed.status, 400);
  const { response: queryOnly } = await request('/api/auth/login?password=' + sentinel, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: origin.origin }, body: '{}',
  });
  assert.equal(queryOnly.status, 400);
});
