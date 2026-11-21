import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { retrySnapshot } from './transaction-retry';

/**
 * Server-only, least-privilege Prisma Client. Browser code must never import
 * this module or receive connection information. The app no longer uses the
 * historical lab_runtime SQL RPC adapter.
 */
let client: PrismaClient | undefined;

function restrictedConnection(): PrismaClient {
  const raw = process.env.ORM_DATABASE_URL;
  if (!raw) throw new Error('ORM_DATABASE_URL is required');
  const parsed = new URL(raw);
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) ||
      decodeURIComponent(parsed.username).split('.')[0] !== 'lab_orm') {
    throw new Error('A restricted lab_orm PostgreSQL connection is required');
  }
  client ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: raw,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    }),
  });
  return client;
}

/**
 * Every authenticated read/write runs inside the same Prisma transaction as
 * its session authorization. SQL advisory locks are retained for concurrent
 * stock conservation, not for legacy application stored procedures.
 */
export async function nativeOrmTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel } = {},
): Promise<T> {
  const transaction = () => restrictedConnection().$transaction(work, {
    isolationLevel: options.isolationLevel ?? 'ReadCommitted',
    maxWait: 3000,
    timeout: 30000,
  });
  // Snapshot reads touch session activity and may race other dashboard reads.
  // Retain snapshot isolation; retry only transactions rolled back by PostgreSQL.
  try {
    return await (options.isolationLevel === 'RepeatableRead'
      ? retrySnapshot(transaction) : transaction());
  } catch (error) {
    // Safe metadata only: no query text, connection details or session values.
    console.error('DB_TRANSACTION_FAILED', JSON.stringify({
      at: new Date().toISOString(), isolation: options.isolationLevel ?? 'ReadCommitted',
      code: typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code) : 'UNKNOWN',
    }));
    throw error;
  }
}
