import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Keep these tests offline: only the database adapter import is substituted.
const source = readFileSync(new URL('../src/lib/server/google-oauth.ts', import.meta.url), 'utf8')
  .replace(/import \{ googleBatchOptions, googleSignIn, googleRegister \} from '[^']+';/,
    'function googleBatchOptions() { throw Error("DATABASE_NOT_EXPECTED"); } const googleSignIn = googleBatchOptions, googleRegister = googleBatchOptions;');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const oauth = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));

test('OAuth tickets, state and origin fail closed using synthetic configuration', async t => {
  const keys = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_COOKIE_SECRET', 'APP_ORIGIN', 'NODE_ENV'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    GOOGLE_OAUTH_CLIENT_ID: 'synthetic-client', GOOGLE_OAUTH_CLIENT_SECRET: 'synthetic-secret',
    GOOGLE_OAUTH_COOKIE_SECRET: 'synthetic-cookie-secret-for-offline-tests-only',
    APP_ORIGIN: 'https://lab.example.invalid', NODE_ENV: 'production',
  });
  t.after(() => keys.forEach(key => saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key]));
  const identity = { sub: 'synthetic-subject', email: 'student@example.invalid', name: 'Synthetic Student' };
  const ticket = oauth.signupTicket(identity).split(';')[0];
  const request = value => new Request('https://lab.example.invalid/api/google/profile', { headers: { cookie: value } });

  await t.test('encrypted signup ticket roundtrips without exposing identity', () => {
    assert.deepEqual(oauth.signupIdentity(request(ticket)), identity);
    assert.ok(!ticket.includes(identity.email));
    assert.match(oauth.signupTicket(identity), /HttpOnly; SameSite=Lax; Max-Age=900; Secure/);
  });
  await t.test('tampered and oversized tickets are rejected', () => {
    const [name, value] = ticket.split('=');
    const tampered = (value[0] === 'A' ? 'B' : 'A') + value.slice(1);
    assert.equal(oauth.signupIdentity(request(name + '=' + tampered)), null);
    assert.equal(oauth.signupIdentity(request(name + '=' + 'A'.repeat(3901))), null);
  });
  await t.test('flow cookies cannot be substituted for signup tickets', () => {
    const started = oauth.startGoogle();
    assert.equal(oauth.signupIdentity(request(oauth.signupCookie + '=' + started.flow.split(';')[0].split('=')[1])), null);
    const url = new URL(started.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('nonce'));
    assert.notEqual(url.searchParams.get('state'), new URL(oauth.startGoogle().url).searchParams.get('state'));
  });
  await t.test('missing or mismatched state is rejected before network access', async () => {
    const started = oauth.startGoogle();
    await assert.rejects(oauth.finishGoogle(new Request('https://lab.example.invalid/api/google/callback?code=synthetic&state=wrong', {
      headers: { cookie: started.flow.split(';')[0] },
    })), /GOOGLE_OAUTH_STATE_DENIED/);
  });
  await t.test('both request destination and Origin must match configured origin', () => {
    const req = (url, origin) => new Request(url, { headers: origin ? { origin } : {} });
    assert.equal(oauth.expectedOrigin(req('https://lab.example.invalid/api/google/profile', 'https://lab.example.invalid')), true);
    assert.equal(oauth.expectedOrigin(req('https://lab.example.invalid/api/google/profile', 'https://attacker.invalid')), false);
    assert.equal(oauth.expectedOrigin(req('https://attacker.invalid/api/google/profile', 'https://lab.example.invalid')), false);
    assert.equal(oauth.expectedOrigin(req('https://lab.example.invalid/api/google/profile')), false);
  });
  await t.test('expired tickets are rejected', () => {
    const original = Date.now;
    try {
      Date.now = () => original() + 901_000;
      assert.equal(oauth.signupIdentity(request(ticket)), null);
    } finally { Date.now = original; }
  });
});
