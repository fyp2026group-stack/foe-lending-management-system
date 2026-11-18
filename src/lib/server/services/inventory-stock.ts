import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

type Page = {
  limit: number; offset: number; labId?: string; itemId?: string;
};
const allowed = new Set([
  'limit','offset','q','labId','itemId','categoryId','kind','assetId','active','sort',
]);
function parse(payload: Record<string, unknown>): Page | null {
  if (Object.keys(payload).some(k => !allowed.has(k))) return null;
  const n = (x: unknown, fallback: number) =>
    x === undefined ? fallback :
    typeof x === 'number' && Number.isSafeInteger(x) ? x :
    typeof x === 'string' && /^\\d+$/.test(x) ? Number(x) : NaN;
  const limit = n(payload.limit, 20), offset = n(payload.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return null;
  for (const key of ['labId','itemId','categoryId','assetId']) {
    if (payload[key] !== undefined && !isUuid(payload[key])) return null;
  }
  if (payload.q !== undefined &&
      (typeof payload.q !== 'string' || payload.q.length > 120)) return null;
  if (payload.kind !== undefined &&
      !['RETURNABLE','CONSUMABLE'].includes(String(payload.kind))) return null;
  if (payload.active !== undefined && !['true','false'].includes(String(payload.active))) return null;
  if (payload.sort !== undefined && !['id','name'].includes(String(payload.sort))) return null;
  return { limit, offset, labId: payload.labId as string | undefined, itemId: payload.itemId as string | undefined };
}

/** Role- and laboratory-scoped inventory cell listing via native Prisma. */
export async function readInventoryStock(token: string, payload: Record<string, unknown>) {
  const p = parse(payload);
  if (!p) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const admin = auth.roles.includes('ADMIN');
    const officer = auth.roles.includes('TECHNICAL_OFFICER');
    if (!admin && !officer) return { items: [], limit: p.limit, offset: p.offset };
    let labIds: string[] | undefined;
    if (!admin) {
      const assigned = await tx.staff_labs.findMany({
        where: { user_id: auth.userId }, select: { laboratory_id: true },
      });
      labIds = assigned.map(x => x.laboratory_id);
      if (!labIds.length) return { items: [], limit: p.limit, offset: p.offset };
    }
    const items = await tx.inv_cells.findMany({
      where: {
        ...(p.labId ? { lab_id: p.labId } : {}),
        ...(p.itemId ? { item_id: p.itemId } : {}),
        ...(labIds ? { lab_id: { in: p.labId ? labIds.filter(id => id === p.labId) : labIds } } : {}),
      },
      select: {
        id: true, item_id: true, lab_id: true, location_id: true,
        asset_id: true, state: true, quantity: true, version: true,
      },
      orderBy: { id: 'asc' },
      skip: p.offset,
      take: p.limit,
    });
    return { items, limit: p.limit, offset: p.offset };
  });
}
