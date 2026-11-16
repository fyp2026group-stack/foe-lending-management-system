import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// All application database calls run through the existing security-definer
// PostgreSQL RPC layer. Prisma supplies pooling and transaction management;
// it must not replace authorization, inventory posting, or audit functions.
// JSONB inputs are explicitly cast at their SQL call sites.
// Existing stored functions return heterogeneous JSON envelopes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
export type Client = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Row[] }>;
};

let prisma: PrismaClient | undefined;

function connection(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('Local database required');
  }
  prisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
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
 * Native Prisma mutation boundary for explicitly migrated services.
 * The lab_orm account has narrowly scoped column grants; it is not the
 * legacy lab_runtime user or the migration owner. Database and hostname
 * must agree with the legacy connection to prevent cross-database writes.
 */
let ormClient: PrismaClient | undefined;
function ormConnection(): PrismaClient {
  const raw = process.env.ORM_DATABASE_URL;
  const legacy = process.env.DATABASE_URL;
  if (!raw || !legacy) throw new Error('ORM database configuration required');
  const target = new URL(raw);
  const expected = new URL(legacy);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
      || target.hostname !== expected.hostname
      || target.port !== expected.port
      || target.pathname !== expected.pathname
      || decodeURIComponent(target.username) !== 'lab_orm') {
    throw new Error('Restricted ORM database connection required');
  }
  ormClient ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: raw,
      max: 5,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
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
