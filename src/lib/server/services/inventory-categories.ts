import { prismaTransaction } from '../db';

type CataloguePage = {
  items: { id: string; name: string; active: boolean; version: number }[];
  limit: number;
  offset: number;
};
type ApiFailure = { status: number; code: string };
type Query = {
  limit: number;
  offset: number;
  query: string;
  active?: boolean;
  sort: 'name' | 'id';
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function catalogueQuery(payload: Record<string, unknown>): Query | null {
  const allowed = new Set([
    'limit','offset','q','labId','itemId','categoryId','kind','assetId','active','sort',
  ]);
  if (Object.keys(payload).some(k => !allowed.has(k) || typeof payload[k] !== 'string')) {
    return null;
  }
  const integer = (value: unknown, fallback: number) =>
    value === undefined ? fallback
      : typeof value === 'string' && /^\d+$/.test(value) ? Number(value)
      : Number.NaN;
  const limit = integer(payload.limit, 20);
  const offset = integer(payload.offset, 0);
  const q = payload.q ?? '';
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isSafeInteger(offset) || offset < 0 || offset > 10000 ||
    typeof q !== 'string' || q.length > 120) return null;

  for (const key of ['labId', 'itemId', 'categoryId', 'assetId']) {
    if (payload[key] !== undefined && !uuid.test(String(payload[key]))) return null;
  }
  if (payload.kind !== undefined && !['CONSUMABLE', 'RETURNABLE'].includes(String(payload.kind))) {
    return null;
  }
  if (payload.active !== undefined && !['true', 'false'].includes(String(payload.active))) {
    return null;
  }
  if (payload.sort !== undefined && !['name','id'].includes(String(payload.sort))) return null;
  return {
    limit, offset, query: q,
    active: payload.active === undefined ? undefined : payload.active === 'true',
    sort: payload.sort === 'name' ? 'name' : 'id',
  };
}

/** Authenticated, typed category listing with column-only runtime grants. */
export async function readInventoryCategories(
  token: string,
  payload: Record<string, unknown>
): Promise<CataloguePage | ApiFailure> {
  const query = catalogueQuery(payload);
  if (!query) return { status: 422, code: 'INVALID' };

  return prismaTransaction(async tx => {
    const validation = await tx.$queryRaw<{
      result: { user?: { roles?: string[] } };
    }[]>`
      SELECT lab.identity_call(
        ${token}, ${''}, ${'me'}, NULL::uuid, '{}'::jsonb
      ) AS result
    `;
    const user = validation[0]?.result.user;
    if (!user) return { status: 401, code: 'UNAUTHENTICATED' };
    if (!user.roles?.some(role =>
      ['ADMIN','STUDENT','LECTURER','TECHNICAL_OFFICER'].includes(role)
    )) return { status: 403, code: 'DENIED' };

    const rows = await tx.inv_categories.findMany({
      select: { id:true, name:true, active:true, version:true },
      where: {
        ...(query.active === undefined ? {} : { active: query.active }),
        ...(query.query ? { name: { contains: query.query, mode: 'insensitive' as const } } : {}),
      },
      orderBy: query.sort === 'name'
        ? [{ name: 'asc' as const },{ id: 'asc' as const }]
        : [{ id: 'asc' as const }],
      skip: query.offset,
      take: query.limit,
    });
    return { items: rows, limit: query.limit, offset: query.offset };
  });
}
