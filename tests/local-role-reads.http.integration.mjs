// Read-only application checks against existing synthetic local accounts.
// Load .verification/m2.env into the process before running this opt-in suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from './m2-guard.mjs';

test('all four local role accounts and dashboard reads', async () => {
  const { origin } = configuration(process.env);
  const password = process.env.SYNTHETIC_ADMIN_PASSWORD;
  assert.ok(password, 'Synthetic account password must be configured');
  const common = [
    'auth/me',
    ...['requests', 'drafts', 'loans', 'borrower-history', 'allocations',
      'sources', 'lecturers', 'history', 'policies', 'extensions', 'expected',
      'inspections', 'metrics'].map(x => 'lending/' + x),
    ...['items', 'stock', 'assets', 'movements', 'adjustments', 'categories',
      'locations'].map(x => 'inventory/' + x),
  ];
  const admin = [
    'admin/users', 'admin/laboratories', 'admin/batches',
    ...['borrowing', 'overdue', 'inventory', 'approvals', 'audit']
      .map(x => 'admin/reports?report=' + x),
    'admin/reports?report=borrowing&kind=RETURNABLE&status=BORROWED&limit=1',
    'admin/reports?report=overdue&kind=RETURNABLE&limit=5',
  ];
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const operations = 'lending/operations-summary?' + new URLSearchParams({
    from: start.toISOString(), to: end.toISOString(),
  });
  for (const [account, role] of [
    ['admin', 'ADMIN'], ['student', 'STUDENT'],
    ['lecturer', 'LECTURER'], ['officer', 'TECHNICAL_OFFICER'],
  ]) {
    const login = await fetch(origin + '/api/auth/login', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account + '@example.invalid', password }),
    });
    assert.equal(login.status, 200, account + ' login');
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie, account + ' session cookie');
    await login.arrayBuffer();
    for (const path of [...common, ...admin, operations]) {
      const response = await fetch(origin + '/api/' + path, {
        redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Cookie: cookie },
      });
      const expected = admin.includes(path) ? (role === 'ADMIN' ? 200 : 403)
        : path === operations ? (role === 'TECHNICAL_OFFICER' ? 200 : 403) : 200;
      assert.equal(response.status, expected, account + ' GET /api/' + path);
      const body = await response.json();
      if (expected === 403) assert.equal(body.code, 'DENIED');
      if (path === 'auth/me') {
        assert.equal(body.user.email, account + '@example.invalid');
        assert.ok(body.user.roles.includes(role));
      }
      if (role === 'ADMIN' && path.includes('admin/reports?')) {
        assert.ok(Array.isArray(body.items));
        assert.ok(Number.isSafeInteger(body.total));
        assert.equal(typeof body.metrics, 'object');
      }
    }
    console.log(account + ': login, identity and 32 GET checks passed');
    // Rendered dashboards fetch these concurrently with the same session.
    // Sequential reads alone miss snapshot/session activity write conflicts.
    const dashboard = role === 'ADMIN' ? [...admin.slice(-2),
      'auth/me', 'lending/requests', 'lending/history', 'lending/inspections', 'inventory/items',
      'lending/loans', 'lending/allocations', 'lending/sources', 'lending/metrics']
      : role === 'TECHNICAL_OFFICER' ? [operations, 'lending/allocations',
        'lending/expected', 'lending/inspections'] : [];
    for (let round = 0; round < 10 && dashboard.length; round++) {
      // Include overlapping effect loads during initial rendering.
      await Promise.all([...dashboard, ...dashboard].map(async path => {
        const response = await fetch(origin + '/api/' + path, {
          redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { Cookie: cookie, Origin: origin },
        });
        await response.arrayBuffer();
        assert.equal(response.status, 200, account + ' concurrent GET /api/' + path);
      }));
    }
  }
});
