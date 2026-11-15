import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// All application database calls run through the existing security-definer
// PostgreSQL RPC layer. Prisma supplies pooling and transaction management;
// it must not replace authorization, inventory posting, or audit functions.
// JSONB inputs are explicitly cast at their SQL call sites.
type Row = Record<string, unknown>;
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
