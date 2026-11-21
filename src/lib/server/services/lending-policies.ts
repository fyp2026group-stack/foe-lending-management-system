import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

type PolicyPage = {
  items: { itemId: string; name: string; policy: string; hodId: string | null }[];
  limit: number;
  offset: number;
};
type ApiFailure = { status: number; code: string };

function parsePage(payload: Record<string, unknown>):
  | { limit: number; offset: number }
  | null {
  if (Object.keys(payload).some((k) => !['limit', 'offset'].includes(k))) return null;
  const read = (value: unknown, fallback: number) =>
    value === undefined ? fallback
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  const limit = read(payload.limit, 50);
  const offset = read(payload.offset, 0);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100
    && Number.isSafeInteger(offset) && offset >= 0 && offset <= 100000
    ? { limit, offset }
    : null;
}

/**
 * Replaces the read_policies stored-function operation.
 * Native session validation and Prisma SELECTs share a transaction.
 * The restricted ORM role has column-level SELECT grants only for the necessary
 * catalogue and policy columns. No global table or write access is granted.
 */
export async function readLendingPolicies(
  token: string,
  payload: Record<string, unknown>
): Promise<PolicyPage | ApiFailure> {
  const page = parsePage(payload);
  if (!page) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async (tx) => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const rows = await tx.inv_items.findMany({
      select: {
        id: true,
        name: true,
        lend_policies: { select: { policy: true, hod_id: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: page.offset,
      take: page.limit,
    });
    return {
      items: rows.map((item) => ({
        itemId: item.id,
        name: item.name,
        policy: item.lend_policies?.policy ?? 'UNCONFIGURED',
        hodId: item.lend_policies?.hod_id ?? null,
      })),
      ...page,
    };
  });
}
