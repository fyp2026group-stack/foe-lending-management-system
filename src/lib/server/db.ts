import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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
  return restrictedConnection().$transaction(work, {
    isolationLevel: options.isolationLevel ?? 'ReadCommitted',
    maxWait: 3000,
    timeout: 30000,
  });
}
