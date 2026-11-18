import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

type Page = {
  limit: number; offset: number; labId?: string;
  itemId?: string; assetId?: string;
};
const allowed = new Set([
  'limit','offset','q','labId','itemId','categoryId','kind','assetId','active','sort',
]);
function filters(p: Record<string, unknown>): Page | null {
  if (Object.keys(p).some(k => !allowed.has(k))) return null;
  const n = (v: unknown, d: number) =>
    v === undefined ? d : typeof v === 'number' && Number.isSafeInteger(v) ? v
    : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  const limit = n(p.limit, 20), offset = n(p.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return null;
  for (const k of ['labId','itemId','categoryId','assetId']) {
    if (p[k] !== undefined && !isUuid(p[k])) return null;
  }
  if (p.q !== undefined && (typeof p.q !== 'string' || p.q.length > 120)) return null;
  if (p.kind !== undefined && !['CONSUMABLE','RETURNABLE'].includes(String(p.kind))) return null;
  if (p.active !== undefined && !['true','false'].includes(String(p.active))) return null;
  if (p.sort !== undefined && !['name','id'].includes(String(p.sort))) return null;
  return {
    limit, offset,
    labId: p.labId as string | undefined,
    itemId: p.itemId as string | undefined,
    assetId: p.assetId as string | undefined,
  };
}

/** Officer-authorized stock movement history. No student-facing stock access. */
export async function readInventoryMovements(
  token: string, payload: Record<string, unknown>,
) {
  const p = filters(payload);
  if (!p) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const admin = auth.roles.includes('ADMIN');
    if (!admin && !auth.roles.includes('TECHNICAL_OFFICER'))
      return { items: [], limit: p.limit, offset: p.offset };
    const labs = admin ? undefined :
      (await tx.staff_labs.findMany({
        where: { user_id: auth.userId },
        select: { laboratory_id: true },
      })).map(r => r.laboratory_id);
    if (labs && labs.length === 0)
      return { items: [], limit: p.limit, offset: p.offset };

    const movements = await tx.inv_movements.findMany({
      where: {
        ...(p.labId ? { lab_id: p.labId } : {}),
        ...(labs ? { lab_id: { in: p.labId ? labs.filter(id => id === p.labId) : labs } } : {}),
        ...(p.itemId ? { item_id: p.itemId } : {}),
        ...(p.assetId ? { inv_entries: {
          some: { inv_cells: { asset_id: p.assetId } },
        }} : {}),
      },
      select: {
        id: true, actor_id: true, item_id: true, lab_id: true,
        kind: true, reason: true, created_at: true,
        inv_entries: {
          select: {
            id: true, cell_id: true, account: true, delta: true,
            inv_cells: {
              select: {
                state: true, location_id: true, asset_id: true,
                inv_locations: { select: { name: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { id: 'asc' }, skip: p.offset, take: p.limit,
    });
    return {
      items: movements.map(m => ({
        id: m.id, actor_id: m.actor_id, item_id: m.item_id, lab_id: m.lab_id,
        kind: m.kind, reason: m.reason, created_at: m.created_at,
        entries: m.inv_entries.map(e => ({
          cell_id: e.cell_id, account: e.account, delta: e.delta,
          state: e.inv_cells?.state ?? null,
          location_id: e.inv_cells?.location_id ?? null,
          location_name: e.inv_cells?.inv_locations?.name ?? null,
          asset_id: e.inv_cells?.asset_id ?? null,
        })),
      })),
      limit: p.limit, offset: p.offset,
    };
  });
}
