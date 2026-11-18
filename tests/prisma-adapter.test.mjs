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

test('All protected application handlers invoke native Prisma services', () => {
  const lending = read('src/lib/server/lending.ts');
  assert.match(lending, /changeLendingDraft\(/);
  assert.match(lending, /changePhysicalInspection\(/);
  assert.match(lending, /changeLendingExtension\(/);
  assert.match(lending, /readPhysicalLending\(/);
  assert.doesNotMatch(lending, /lab\.lending_call\(/);
  const inventory = read('src/lib/server/inventory.ts');
  assert.match(inventory, /changeInventoryStock\(/);
  assert.doesNotMatch(inventory, /lab\.inventory_call\(/);
  const identity = read('src/lib/server/identity.ts');
  assert.match(identity, /changeAdminUser\(/);
  assert.match(identity, /loginIdentity\(/);
  assert.doesNotMatch(identity, /lab\.(identity_call|admin_governance|login_start|login_finish)\(/);
  const report = read('src/lib/server/reports.ts');
  assert.match(report, /readAdminReport\(/);
  assert.doesNotMatch(report, /lab\.admin_report\(/);
  const google = read('src/lib/server/google-oauth.ts');
  assert.match(google, /googleRegister\(identity, profile\)/);
  assert.doesNotMatch(google, /lab\.google_student_(login|register|options)/);
});

test('Prisma migrations preserve baseline schema and historic protected invariants', () => {
  const schema = read('prisma/schema.prisma');
  const pkg = JSON.parse(read('package.json'));
  assert.match(schema, /datasource db/);
  assert.match(schema, /@@schema\("lab"\)/);
  assert.ok(pkg.dependencies['@prisma/adapter-pg']);
  assert.ok(pkg.devDependencies.prisma);
  assert.ok(!pkg.scripts['db:migrate'].includes('prisma'));
  assert.match(read('database/023_basic_lending.sql'), /SECURITY DEFINER/);
  assert.match(read('database/035_lending_lifecycle.sql'), /lend_reserve/);
  assert.doesNotMatch(read('src/lib/server/lending.ts'), /lab\.lending_call/);
});
