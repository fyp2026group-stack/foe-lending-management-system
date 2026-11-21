import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

const keys = new Set([
  'limit','offset','q','labId','itemId','categoryId','kind','assetId','active','sort',
]);
function params(p: Record<string, unknown>) {
  if (Object.keys(p).some(k => !keys.has(k))) return null;
  const num = (value: unknown, fallback: number) =>
    value === undefined ? fallback
      : typeof value === 'number' && Number.isSafeInteger(value) ? value
      : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  const limit = num(p.limit, 20), offset = num(p.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return null;
  for (const k of ['labId','itemId','categoryId','assetId']) {
    if (p[k] !== undefined && !isUuid(p[k])) return null;
  }
  if (p.q !== undefined && (typeof p.q !== 'string' || p.q.length > 120)) return null;
  if (p.active !== undefined && !['true','false'].includes(String(p.active))) return null;
  if (p.kind !== undefined && !['CONSUMABLE','RETURNABLE'].includes(String(p.kind))) return null;
  if (p.sort !== undefined && !['name','id'].includes(String(p.sort))) return null;
  return {
    limit, offset, q: (p.q as string | undefined) ?? '',
    labId: p.labId as string | undefined,
    itemId: p.itemId as string | undefined,
  };
}

/** Current identified equipment with physical location and custody state. */
export async function readInventoryAssets(token: string, payload: Record<string, unknown>) {
  const p = params(payload);
  if (!p) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const admin = auth.roles.includes('ADMIN');
    if (!admin && !auth.roles.includes('TECHNICAL_OFFICER'))
      return { items: [], limit: p.limit, offset: p.offset };
    const labIds = admin ? undefined : (await tx.staff_labs.findMany({
      where: { user_id: auth.userId }, select: { laboratory_id: true },
    })).map(x => x.laboratory_id);
    if (labIds && !labIds.length)
      return { items: [], limit: p.limit, offset: p.offset };

    const rows = await tx.inv_cells.findMany({
      where: {
        quantity: 1, asset_id: { not: null },
        ...(p.labId ? { lab_id: p.labId } : {}),
        ...(p.itemId ? { item_id: p.itemId } : {}),
        ...(labIds ? { lab_id: { in: p.labId ? labIds.filter(l => l === p.labId) : labIds } } : {}),
        ...(p.q ? {
          inv_assets: {
            OR: [
              { serial: { contains: p.q, mode: 'insensitive' as const } },
              ...(isUuid(p.q) ? [{ id: p.q }] : []),
            ],
          },
        } : {}),
      },
      select: {
        state: true, location_id: true, version: true,
        inv_assets: {
          select: {
            id: true, item_id: true, lab_id: true,
            serial: true, created_at: true,
          },
        },
      },
      orderBy: { asset_id: 'asc' },
      skip: p.offset, take: p.limit,
    });
    return {
      items: rows.filter(r => r.inv_assets).map(r => ({
        ...r.inv_assets!,
        state: r.state,
        location_id: r.location_id,
        version: r.version,
      })),
      limit: p.limit, offset: p.offset,
    };
  });
}
