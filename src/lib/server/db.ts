import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// PostgreSQL result decoding is confined to this adapter; schema constraints remain authoritative.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
export type Client = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Row[] }>;
  release: () => void;
};
let pool: { connect: () => Promise<Client> } | undefined;
export async function transaction<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw new Error('Local database required');
  pool ??= new (require('pg').Pool)({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  const c = await pool!.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
