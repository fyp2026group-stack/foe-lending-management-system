import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Transitional adapter: existing RPC routes remain until they have native Prisma service replacements.
// Native Prisma mutations use the restricted ORM role, and both adapters use parameterized inputs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
export type Client = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Row[] }>;
};

let prisma: PrismaClient | undefined;

function connection(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const parsed = new URL(url);
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    throw new Error('PostgreSQL connection required');
  }
  prisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    }),
  });
  return prisma;
}

/**
 * Preserve the existing restricted transaction interface while using Prisma
 * for every database connection and every transaction.
 *
 * Only trusted, constant SQL is passed by server-side callers. All user inputs
 * remain parameterized. SQL functions continue to enforce access controls.
 */
export async function transaction<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  return connection().$transaction(async (tx) => {
    const client: Client = {
      async query(sql, values = []) {
        if (sql === 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') {
          // The report exporter uses one consistent transaction snapshot.
          await tx.$executeRawUnsafe(sql);
          return { rows: [] };
        }
        const params = values.map((value) =>
          value !== null && typeof value === 'object' ? JSON.stringify(value) : value
        );
        const rows = await tx.$queryRawUnsafe<Row[]>(sql, ...params);
        return { rows };
      },
    };
    return fn(client);
  }, { maxWait: 3000, timeout: 30000 });
}

/**
 * Typed Prisma transaction for migrated domain services. Keep security
 * verification and the scoped model reads in the SAME database transaction.
 * Do not export the unrestricted PrismaClient to route handlers.
 */
export async function prismaTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return connection().$transaction(fn, {
    isolationLevel: 'RepeatableRead',
    maxWait: 3000,
    timeout: 30000,
  });
}

/**
 * Dedicated ORM connection. Supabase pooler credentials may append a project
 * suffix to the role name (lab_orm.<project-ref>).
 * Grant least-privilege access to this database role before enabling writes.
 * Legacy and ORM credentials must point to the same PostgreSQL database;
 * the deployment operator must verify this when using separate poolers.
 */
let ormClient: PrismaClient | undefined;
function ormConnection(): PrismaClient {
  const raw = process.env.ORM_DATABASE_URL;
  const legacy = process.env.DATABASE_URL;
  if (!raw || !legacy) throw new Error('ORM database configuration required');
  const target = new URL(raw);
  const expected = new URL(legacy);
  if (!['postgresql:', 'postgres:'].includes(target.protocol)
      || !['postgresql:', 'postgres:'].includes(expected.protocol)
      || decodeURIComponent(target.username).split('.')[0] !== 'lab_orm') {
    throw new Error('Restricted lab_orm PostgreSQL connection required');
  }
  ormClient ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: raw,
      max: 5,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    }),
  });
  return ormClient;
}

export async function nativeOrmTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return ormConnection().$transaction(fn, {
    isolationLevel: 'ReadCommitted',
    maxWait: 3000,
    timeout: 30000,
  });
}
