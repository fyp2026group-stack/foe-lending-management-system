import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

type Filters = {
  limit: number;
  offset: number;
  q: string;
  labId?: string;
  itemId?: string;
  categoryId?: string;
  kind?: string;
  active?: boolean;
  sort: 'id' | 'name';
};

const permitted = new Set([
  'limit', 'offset', 'q', 'labId', 'itemId', 'categoryId',
  'kind', 'assetId', 'active', 'sort',
]);

function parse(payload: Record<string, unknown>): Filters | null {
  if (Object.keys(payload).some(key => !permitted.has(key))) return null;
  const num = (value: unknown, fallback: number) =>
    value === undefined ? fallback :
    typeof value === 'number' && Number.isSafeInteger(value) ? value :
    typeof value === 'string' && /^\\d+$/.test(value) ? Number(value) : Number.NaN;
  const limit = num(payload.limit, 20);
  const offset = num(payload.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return null;
  for (const key of ['labId', 'itemId', 'categoryId', 'assetId']) {
    if (payload[key] !== undefined && !isUuid(payload[key])) return null;
  }
  if (payload.q !== undefined &&
    (typeof payload.q !== 'string' || payload.q.length > 120)) return null;
  if (payload.kind !== undefined &&
    !['RETURNABLE', 'CONSUMABLE'].includes(String(payload.kind))) return null;
  if (payload.active !== undefined &&
    !['true', 'false'].includes(String(payload.active))) return null;
  if (payload.sort !== undefined &&
    !['id', 'name'].includes(String(payload.sort))) return null;
  return {
    limit, offset,
    q: (payload.q as string | undefined) ?? '',
    labId: payload.labId as string | undefined,
    itemId: payload.itemId as string | undefined,
    categoryId: payload.categoryId as string | undefined,
    kind: payload.kind as string | undefined,
    active: payload.active === undefined ? undefined : payload.active === 'true',
    sort: payload.sort === 'name' ? 'name' : 'id',
  };
}

/**
 * Native Prisma catalogue listing. The restricted runtime connection has
 * SELECT access only to public item fields and aggregate stock columns.
 * The session and both inventory reads are inside one protected transaction.
 * This is a compatibility response: item field names remain snake_case and
 * available remains the sum of AVAILABLE cells.
 */
export async function readInventoryItems(
  token: string,
  payload: Record<string, unknown>,
) {
  const p = parse(payload);
  if (!p) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;

    const items = await tx.inv_items.findMany({
      where: {
        ...(p.itemId ? { id: p.itemId } : {}),
        ...(p.categoryId ? { category_id: p.categoryId } : {}),
        ...(p.kind ? { kind: p.kind } : {}),
        ...(p.active === undefined ? {} : { active: p.active }),
        ...(p.q ? { name: { contains: p.q, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true, category_id: true, name: true, kind: true, uom: true,
        active: true, version: true, specifications: true,
      },
      orderBy: p.sort === 'name'
        ? [{ name: 'asc' as const }, { id: 'asc' as const }]
        : [{ id: 'asc' as const }],
      skip: p.offset,
      take: p.limit,
    });
    const ids = items.map(item => item.id);
    if (!ids.length) return { items: [], limit: p.limit, offset: p.offset };

    const totals = await tx.inv_cells.groupBy({
      by: ['item_id'],
      where: {
        item_id: { in: ids },
        state: 'AVAILABLE',
        ...(p.labId ? { lab_id: p.labId } : {}),
      },
      _sum: { quantity: true },
    });
    const available = new Map(totals.map(row => [row.item_id, row._sum.quantity ?? 0]));
    return {
      items: items.map(item => ({ ...item, available: available.get(item.id) ?? 0 })),
      limit: p.limit,
      offset: p.offset,
    };
  });
}
