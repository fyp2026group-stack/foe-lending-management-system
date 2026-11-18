import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Prisma adapter supports PostgreSQL connections and transactions', () => {
  const db = read('src/lib/server/db.ts');
  assert.match(db, /new PrismaPg\(/);
  assert.match(db, /new PrismaClient\(/);
  assert.match(db, /\.\$transaction\(/);
  assert.match(db, /\.\$queryRawUnsafe/);
  assert.match(db, /\.\$executeRawUnsafe/);
  assert.match(db, /DATABASE_URL is required/);
  assert.match(db, /postgresql:/);
  assert.doesNotMatch(db, /Local database required/);
  assert.doesNotMatch(db, /require\(['"]pg['"]\)/);
  assert.doesNotMatch(db, /new Pool\(/);
});

test('Every protected JSONB RPC has an explicit cast', () => {
  for (const [path, name] of [
    ['src/lib/server/identity.ts', 'identity_call'],
    ['src/lib/server/identity.ts', 'admin_governance'],
    ['src/lib/server/inventory.ts', 'inventory_call'],
    ['src/lib/server/lending.ts', 'lending_call'],
    ['src/lib/server/reports.ts', 'admin_report'],
  ]) {
    const source = read(path);
    const statement = source.match(new RegExp('SELECT lab\\.' + name + '\\([^\\n]+'));
    assert.ok(statement, `Missing ${name} in ${path}`);
    assert.match(statement[0], /::jsonb/, `${name} must cast JSONB`);
  }
  const google = read('src/lib/server/google-oauth.ts');
  assert.match(google, /googleRegister\(identity, profile\)/);
  assert.doesNotMatch(google, /lab\.google_student_(login|register|options)/);
});

test('SQL migrations and function authorization remain authoritative', () => {
  const schema = read('prisma/schema.prisma');
  const pkg = JSON.parse(read('package.json'));
  assert.match(schema, /datasource db/);
  assert.match(schema, /@@schema\("lab"\)/);
  assert.ok(pkg.dependencies['@prisma/adapter-pg']);
  assert.ok(pkg.devDependencies.prisma);
  assert.ok(!pkg.scripts['db:migrate'].includes('prisma'));
  assert.match(read('database/023_basic_lending.sql'), /SECURITY DEFINER/);
  assert.match(read('database/035_lending_lifecycle.sql'), /lend_reserve/);
  assert.match(read('src/lib/server/lending.ts'), /lab\.lending_call/);
});
