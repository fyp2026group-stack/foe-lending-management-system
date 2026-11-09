export function configuration(env) {
  if (env.M2_TEST_ENABLE !== 'synthetic-only') throw new Error('M2 integration NOT RUN: explicit synthetic-only opt-in required');
  const database = new URL(env.M2_TEST_DATABASE_URL || '');
  const app = new URL(env.M2_TEST_APP_ORIGIN || '');
  const local = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !local(database.hostname) ||
      !/^\/lab_m2_test_[a-z0-9_]+$/.test(database.pathname)) throw new Error('Dedicated loopback lab_m2_test_* database required');
  if (app.protocol !== 'http:' || !local(app.hostname) || app.username || app.password || app.pathname !== '/' || app.search || app.hash)
    throw new Error('Plain loopback app origin required');
  return { database: database.href, databaseName: database.pathname.slice(1), origin: app.origin };
}
