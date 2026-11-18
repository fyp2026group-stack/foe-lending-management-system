import pg from 'pg';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw Error('MIGRATION_DATABASE_URL is required');
const target = new URL(url);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  || !/^\\/(lab_inventory|lab_m2_test_[a-z0-9_]+)$/.test(target.pathname)) {
  throw Error('Empty database verification is restricted to a local test database');
}

const tables = [
  'users', 'user_roles', 'sessions', 'batches', 'laboratories',
  'inv_categories', 'inv_items', 'inv_locations', 'inv_cells',
  'inv_assets', 'inv_movements', 'inv_entries', 'inv_receipts',
  'inv_adjustments', 'inv_imports', 'lend_requests', 'lend_lines',
  'lend_decisions', 'lend_allocations', 'lend_loans', 'lend_returns',
  'lend_comments', 'lend_commands', 'audit',
];

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
await client.connect();
try {
  const remaining = [];
  for (const table of tables) {
    // Table identifiers are from a fixed source-code allowlist, not user input.
    const result = await client.query('SELECT count(*)::int AS n FROM lab.' + table);
    if (result.rows[0].n !== 0) remaining.push(table);
  }
  if (remaining.length) {
    throw Error('Local schema contains application records: ' + remaining.join(', '));
  }
  console.log('Empty application tables verified (' + tables.length + ' tables).');
} finally {
  await client.end();
}
