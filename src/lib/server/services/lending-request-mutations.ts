import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

type LineInput = {
  itemId: string;
  labId: string;
  locationId: string;
  quantity: number;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k =>
      JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function parse(body: Record<string, unknown>) {
  const keys = ['commandId', 'purpose', 'collectAt', 'returnAt', 'lecturerId', 'lines'];
  if (Object.keys(body).some(key => !keys.includes(key))) return null;
  if (!isUuid(body.commandId) || typeof body.purpose !== 'string' ||
    body.purpose.trim().length < 1 || body.purpose.trim().length > 1000 ||
    typeof body.collectAt !== 'string' || typeof body.returnAt !== 'string' ||
    (body.lecturerId !== undefined && !isUuid(body.lecturerId)) ||
    !Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 20)
    return null;
  const collectAt = new Date(body.collectAt);
  const returnAt = new Date(body.returnAt);
  if (!Number.isFinite(collectAt.getTime()) || !Number.isFinite(returnAt.getTime()) ||
      returnAt <= collectAt) return null;
  const lines: LineInput[] = [];
  const unique = new Set<string>();
  for (const input of body.lines) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const row = input as Record<string, unknown>;
    if (Object.keys(row).some(k => !['itemId','labId','locationId','quantity'].includes(k)) ||
      !isUuid(row.itemId) || !isUuid(row.labId) || !isUuid(row.locationId) ||
      !Number.isSafeInteger(row.quantity) || (row.quantity as number) < 1 ||
      (row.quantity as number) > 1000) return null;
    const key = [row.itemId,row.labId,row.locationId].join('/');
    if (unique.has(key)) return null;
    unique.add(key);
    lines.push(row as LineInput);
  }
  return {
    commandId: body.commandId as string,
    purpose: body.purpose.trim(),
    collectAt, returnAt,
    lecturerId: body.lecturerId as string | undefined,
    lines,
  };
}

/**
 * Request creation retains the per-line approval snapshot. Reservation must
 * wait until every required approval on the entire request is complete.
 * Authorization, command replay and inserts are committed atomically.
 */
export async function createLendingRequest(
  token: string, csrf: string, payload: Record<string, unknown>,
) {
  if (Object.keys(payload).some(k => ![
    'commandId','purpose','collectAt','returnAt','lecturerId','lines',
  ].includes(k))) return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(payload.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  const p = parse(payload);
  if (!p) return { status: 422, code: 'INVALID' };
  try {
    return await nativeOrmTransaction(async tx => {
      const auth = await authorizePrismaSession(tx, token, { csrf });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731944) IS NULL AS locked`;
      const old = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: p.commandId,
        }},
        select: { operation: true, payload: true, result: true },
      });
      if (old) {
        if (old.operation !== 'requests' || canonical(old.payload) !== canonical(payload))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return old.result as Record<string, unknown>;
      }

      const ids = [...new Set(p.lines.map(line => line.itemId))];
      const items = await tx.inv_items.findMany({
        where: { id: { in: ids }, active: true },
        select: { id: true, category_id: true },
      });
      const itemSet = new Set(items.map(i => i.id));
      if (itemSet.size !== ids.length) return { status: 422, code: 'INVALID' };

      const categories = await tx.inv_categories.findMany({
        where: {
          id: { in: [...new Set(items.map(i => i.category_id))] }, active: true,
        },
        select: { id: true },
      });
      if (categories.length !== new Set(items.map(i => i.category_id)).size)
        return { status: 422, code: 'INVALID' };

      const policies = await tx.lend_policies.findMany({
        where: { item_id: { in: ids } },
        select: { item_id: true, policy: true, hod_id: true },
      });
      const byItem = new Map(policies.map(policy => [policy.item_id, policy]));
      const labs = [...new Set(p.lines.map(line => line.labId))];
      const locations = await tx.inv_locations.findMany({
        where: {
          OR: p.lines.map(line => ({
            id: line.locationId, lab_id: line.labId, active: true,
          })),
        },
        select: { id: true, lab_id: true },
      });
      const allowedLocations = new Set(locations.map(l => l.lab_id + '/' + l.id));
      if (p.lines.some(line => !allowedLocations.has(line.labId + '/' + line.locationId)))
        return { status: 422, code: 'INVALID' };

      const needsLecturer = p.lines.some(line =>
        ['LECTURER','BOTH'].includes(byItem.get(line.itemId)?.policy ?? ''));
      const lecturer = needsLecturer && p.lecturerId
        ? await tx.users.findFirst({
            where: {
              id: p.lecturerId, disabled: false,
              user_roles: { some: { role: 'LECTURER' } },
            },
            select: { id: true },
          })
        : null;
      if (needsLecturer && (!lecturer || lecturer.id === auth.userId))
        return { status: 422, code: 'INVALID' };
      const lecturerLabs = lecturer
        ? new Set((await tx.staff_labs.findMany({
            where: { user_id: lecturer.id, laboratory_id: { in: labs } },
            select: { laboratory_id: true },
          })).map(x => x.laboratory_id))
        : new Set<string>();

      for (const line of p.lines) {
        const policy = byItem.get(line.itemId);
        if (!policy || !['NONE','LECTURER','HOD','BOTH'].includes(policy.policy))
          return { status: 409, code: 'POLICY_REQUIRED' };
        if (['LECTURER','BOTH'].includes(policy.policy) && !lecturerLabs.has(line.labId))
          return { status: 422, code: 'INVALID' };
        if (['HOD','BOTH'].includes(policy.policy)) {
          if (!policy.hod_id || policy.hod_id === auth.userId ||
              (policy.policy === 'BOTH' && policy.hod_id === p.lecturerId))
            return { status: 422, code: 'INVALID' };
          const hod = await tx.users.findFirst({
            where: {
              id: policy.hod_id, disabled: false,
              user_roles: { some: { role: 'ADMIN' } },
            },
            select: { id: true },
          });
          if (!hod) return { status: 422, code: 'INVALID' };
        }
      }

      const requestId = randomUUID();
      await tx.lend_requests.create({
        data: {
          id: requestId, borrower_id: auth.userId,
          purpose: p.purpose, collect_at: p.collectAt, return_at: p.returnAt,
        },
        select: { id: true },
      });
      await tx.lend_lines.createMany({
        data: p.lines.map(line => {
          const policy = byItem.get(line.itemId)!;
          return {
            id: randomUUID(), request_id: requestId,
            item_id: line.itemId, lab_id: line.labId, location_id: line.locationId,
            quantity: line.quantity, policy: policy.policy,
            lecturer_id: p.lecturerId ?? null,
            hod_id: policy.hod_id,
            stage: policy.policy === 'NONE' ? 'APPROVED' :
              policy.policy === 'HOD' ? 'HOD' : 'LECTURER',
          };
        }),
      });
      const result = { id: requestId };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId, command_id: p.commandId,
          operation: 'requests', payload: payload as Prisma.InputJsonValue, result,
        },
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId,
          action: 'LENDING_REQUESTS', target_id: requestId,
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return { status: 409, code: 'STATE_CONFLICT' };
      if (error.code === 'P2003') return { status: 422, code: 'INVALID' };
    }
    throw error;
  }
}
