import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

const allowed = new Set([
  'limit', 'offset', 'q', 'labId', 'itemId', 'categoryId',
  'kind', 'assetId', 'active', 'sort',
]);

function params(body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !allowed.has(key))) return null;
  const integer = (v: unknown, fallback: number) =>
    v === undefined ? fallback : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) :
      typeof v === 'number' && Number.isSafeInteger(v) ? v : NaN;
  const limit = integer(body.limit, 20), offset = integer(body.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return null;
  for (const k of ['labId', 'itemId', 'categoryId', 'assetId'])
    if (body[k] !== undefined && !isUuid(body[k])) return null;
  if (body.kind !== undefined &&
      !['CONSUMABLE', 'RETURNABLE'].includes(String(body.kind))) return null;
  if (body.active !== undefined && !['true','false'].includes(String(body.active))) return null;
  if (body.sort !== undefined && !['name','id'].includes(String(body.sort))) return null;
  if (body.q !== undefined && (typeof body.q !== 'string' || body.q.length > 120)) return null;
  return {
    limit, offset,
    labId: body.labId as string | undefined,
  };
}

/** Replicates the protected adjustment directory: admins see all, officers only
 * proposals they authored in laboratories where they are currently assigned. */
export async function readInventoryAdjustments(
  token: string,
  body: Record<string, unknown>,
) {
  const p = params(body);
  if (!p) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const admin = auth.roles.includes('ADMIN');
    if (!admin && !auth.roles.includes('TECHNICAL_OFFICER'))
      return { items: [], limit: p.limit, offset: p.offset };

    let allowedLabs: string[] | undefined;
    if (!admin) {
      allowedLabs = (await tx.staff_labs.findMany({
        where: { user_id: auth.userId },
        select: { laboratory_id: true },
      })).map(row => row.laboratory_id);
      if (!allowedLabs.length)
        return { items: [], limit: p.limit, offset: p.offset };
    }

    const items = await tx.inv_adjustments.findMany({
      where: {
        ...(p.labId ? { lab_id: p.labId } : {}),
        ...(admin ? {} : {
          proposer: auth.userId,
          lab_id: { in: allowedLabs! },
        }),
      },
      select: {
        id: true, proposer: true, item_id: true, lab_id: true,
        location_id: true, quantity: true, direction: true,
        reason: true, expected_version: true, state: true,
        approver: true, movement_id: true,
      },
      orderBy: { id: 'asc' },
      skip: p.offset, take: p.limit,
    });
    return { items, limit: p.limit, offset: p.offset };
  });
}
