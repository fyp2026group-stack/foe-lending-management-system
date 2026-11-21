import { randomBytes } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * One-time local upgrade for pre-Prisma test installations.
 * The existing migration/runtime/admin credentials are never overwritten.
 * Secrets remain in the already protected .verification/m2.env file.
 */
const path = resolve('.verification/m2.env');
const file = await readFile(path, 'utf8');
const values = new Map(file.split(/\r?\n/).filter(Boolean).map(line => {
  const index = line.indexOf('=');
  if (index < 1) throw Error('Invalid local env file');
  return [line.slice(0, index), line.slice(index + 1)];
}));
if (values.has('ORM_DATABASE_URL') && values.has('LOCAL_ORM_PASSWORD')) {
  const url = new URL(values.get('ORM_DATABASE_URL'));
  if (url.username !== 'lab_orm') throw Error('Unexpected ORM account in existing configuration');
  process.exit(0);
}
if (values.has('ORM_DATABASE_URL') || values.has('LOCAL_ORM_PASSWORD')) {
  throw Error('Incomplete existing ORM settings; refuse to change credentials');
}
const base = values.get('DATABASE_URL');
if (!base) throw Error('No legacy runtime connection; refuse upgrade');
const url = new URL(base);
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) ||
  !/^\/(lab_inventory|lab_m2_test_[a-z0-9_]+)$/.test(url.pathname) ||
  url.username !== 'lab_runtime') throw Error('Local lab database required');
const secret = randomBytes(24).toString('hex');
url.username = 'lab_orm';
url.password = secret;
await appendFile(path,
  '\nLOCAL_ORM_PASSWORD=' + secret + '\nORM_DATABASE_URL=' + url.toString() + '\n',
  { mode: 0o600 }
);
