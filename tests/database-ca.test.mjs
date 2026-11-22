import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rootCertificates, checkServerIdentity } from 'node:tls';
import ts from 'typescript';
import pg from 'pg';

const source = readFileSync(new URL('../src/lib/server/db.ts', import.meta.url), 'utf8')
  .replace(/import .* from '@prisma\/client';/, 'class PrismaClient {}')
  .replace(/import .* from '@prisma\/adapter-pg';/, 'class PrismaPg {}')
  .replace(/import .* from '.\/transaction-retry';/, 'const retrySnapshot = work => work();');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { databaseTlsConfiguration } = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
const url = 'postgresql://lab_orm.project:synthetic@pooler.invalid:6543/postgres?sslmode=verify-full';
const ca = rootCertificates[0];

test('PEM CA survives actual pg URL parsing with chain and hostname verification enabled', () => {
  const config = databaseTlsConfiguration(url, ca);
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  const client = new pg.Client(config); // Inspect driver configuration; never connect.
  assert.equal(client.connectionParameters.ssl.ca, ca);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.ssl.servername, 'pooler.invalid');
  assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined);
  assert.equal(checkServerIdentity('pooler.invalid', { subjectaltname: 'DNS:other.invalid' }).code,
    'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.equal(client.connectionParameters.user, 'lab_orm.project');
});

test('custom CA rejects TLS downgrades, URL overrides, invalid PEM and duplicate modes', () => {
  for (const mode of ['disable', 'require', 'no-verify', 'verify-ca']) {
    assert.throws(() => databaseTlsConfiguration(url.replace('verify-full', mode), ca));
  }
  for (const key of ['ssl', 'sslrootcert', 'sslcert', 'sslkey', 'sslaccept', 'uselibpqcompat', 'host', 'user']) {
    assert.throws(() => databaseTlsConfiguration(url + `&${key}=synthetic`, ca));
  }
  assert.throws(() => databaseTlsConfiguration(url + '&sslmode=verify-full', ca));
  assert.throws(() => databaseTlsConfiguration(url, 'invalid PEM'));
});

test('omitting custom CA preserves local configuration and standard trust-store URL behavior', () => {
  assert.deepEqual(databaseTlsConfiguration(url), { connectionString: url });
  const local = 'postgresql://lab_orm:synthetic@127.0.0.1/lab_m2_test_tls';
  assert.deepEqual(databaseTlsConfiguration(local), { connectionString: local });
});
