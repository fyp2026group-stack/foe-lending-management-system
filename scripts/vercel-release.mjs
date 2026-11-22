import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export function verifyTag(env = process.env, cwd = process.cwd()) {
  if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF_TYPE !== 'tag' ||
      !/^refs\/tags\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?![\s\S])/.test(env.GITHUB_REF ?? '')) {
    throw new Error('Release requires a pushed vMAJOR.MINOR.PATCH tag without leading zeros or suffixes');
  }
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const tagged = git('rev-parse', '--verify', `${env.GITHUB_REF}^{commit}`);
  if (git('rev-parse', 'HEAD') !== tagged) throw new Error('Checkout must match the tagged commit');
  git('merge-base', '--is-ancestor', tagged, 'refs/remotes/origin/production');
  return tagged;
}

export function verifyEnvironment(env) {
  for (const key of Object.keys(env)) {
    if (['MIGRATION_DATABASE_URL', 'DIRECT_URL', 'DATABASE_URL', 'SYNTHETIC_ADMIN_PASSWORD'].includes(key) ||
        key.startsWith('M2_TEST_') || key.startsWith('LOCAL_') || key.startsWith('NEXT_PUBLIC_')) {
      throw new Error(`Remove forbidden production variable: ${key}`);
    }
  }
  const db = new URL(env.ORM_DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(db.protocol) ||
      decodeURIComponent(db.username).split('.')[0] !== 'lab_orm' || !db.password ||
      ['user', 'host', 'hostaddr', 'port', 'password'].some(key => db.searchParams.has(key)) ||
      ['localhost', '127.0.0.1', '[::1]'].includes(db.hostname)) {
    throw new Error('Production requires a remote restricted lab_orm PostgreSQL URL');
  }
  if (db.searchParams.getAll('sslmode').length !== 1 ||
      db.searchParams.get('sslmode') !== 'verify-full' || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('Production PostgreSQL requires sslmode=verify-full and certificate verification');
  }
  const origin = new URL(env.APP_ORIGIN || '');
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      env.APP_ORIGIN !== origin.origin) {
    throw new Error('APP_ORIGIN must be a canonical HTTPS origin');
  }
  const oauth = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_COOKIE_SECRET'];
  if (oauth.some(key => env[key]) && (oauth.some(key => !env[key]) || env.GOOGLE_OAUTH_COOKIE_SECRET.length < 32)) {
    throw new Error('Google OAuth requires all three values and a cookie secret of at least 32 characters');
  }
}

export function restoreSensitiveOrm(contents, secret) {
  // Require an encoded, single-line URL: dotenv expansion must not reinterpret
  // password characters, nor may a secret inject another environment entry.
  if (!secret || /[\r\n\0"'`\\$]/.test(secret)) throw new Error('Protected ORM secret missing or unsafe');
  const pulled = parseEnv(contents);
  const assignments = contents.match(/^ORM_DATABASE_URL\s*=/gm) ?? [];
  if (assignments.length !== 1 || !pulled.ORM_DATABASE_URL) throw new Error('Expected one pulled ORM entry');
  if (pulled.ORM_DATABASE_URL !== '[SENSITIVE]' && pulled.ORM_DATABASE_URL !== secret) {
    throw new Error('Pulled ORM configuration conflicts with protected secret');
  }
  for (const [key, value] of Object.entries(pulled)) {
    if (key !== 'ORM_DATABASE_URL' && value.includes('[SENSITIVE]')) throw new Error('Unexpected sensitive placeholder');
  }
  verifyEnvironment({ ...pulled, ORM_DATABASE_URL: secret });
  if (pulled.ORM_DATABASE_URL === secret) return contents;
  const placeholder = /^ORM_DATABASE_URL=(?:"\[SENSITIVE\]"|'\[SENSITIVE\]'|\[SENSITIVE\])(?=\r?$)/gm;
  if ((contents.match(placeholder) ?? []).length !== 1) throw new Error('Unexpected ORM placeholder format');
  // Replace only this single entry, preserving other bytes (including CA PEM).
  const updated = contents.replace(placeholder, () => `ORM_DATABASE_URL="${secret}"`);
  if (parseEnv(updated).ORM_DATABASE_URL !== secret) throw new Error('ORM serialization mismatch');
  return updated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === 'tag') verifyTag();
    else if (process.argv[2] === 'restore-sensitive') {
      const path = '.vercel/.env.production.local';
      const updated = restoreSensitiveOrm(readFileSync(path, 'utf8'), process.env.RELEASE_ORM_DATABASE_URL);
      chmodSync(path, 0o600);
      writeFileSync(path, updated, { mode: 0o600 });
    }
    else if (process.argv[2] === 'env') {
      verifyEnvironment({ ...process.env, ...parseEnv(readFileSync('.vercel/.env.production.local', 'utf8')) });
    } else throw new Error('Expected tag, restore-sensitive or env');
    console.log('Release policy passed');
  } catch {
    // Configuration/command errors may contain credentials; never echo them.
    console.error('Release policy rejected configuration; check tag ancestry and documented production settings.');
    process.exitCode = 1;
  }
}
