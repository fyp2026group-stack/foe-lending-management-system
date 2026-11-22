import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { retrySnapshot } from './transaction-retry';
import { X509Certificate } from 'node:crypto';

export function databaseTlsConfiguration(raw: string, ca?: string) {
  const url = new URL(raw);
  if (!ca) return { connectionString: raw };
  if (url.searchParams.getAll('sslmode').length !== 1 ||
      url.searchParams.get('sslmode') !== 'verify-full' ||
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
      ['ssl', 'sslcert', 'sslkey', 'sslrootcert', 'sslaccept', 'sslidentity', 'sslpassword',
        'uselibpqcompat', 'host', 'hostaddr', 'port', 'user', 'password'].some(key => url.searchParams.has(key))) {
    throw new Error('Custom database CA requires verify-full without connection or TLS overrides');
  }
  if (!new X509Certificate(ca).ca) throw new Error('DATABASE_CA_CERT must contain a CA certificate');
  // pg URL TLS parameters replace the explicit ssl object. Validate first,
  // then remove sslmode so the PEM and verification options survive parsing.
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.href,
    ssl: { ca, rejectUnauthorized: true, servername: url.hostname },
  };
}

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
      decodeURIComponent(parsed.username).split('.')[0] !== 'lab_orm' ||
      parsed.searchParams.has('user')) {
    throw new Error('A restricted lab_orm PostgreSQL connection is required');
  }
  client ??= new PrismaClient({
    adapter: new PrismaPg({
      ...databaseTlsConfiguration(raw, process.env.DATABASE_CA_CERT),
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
