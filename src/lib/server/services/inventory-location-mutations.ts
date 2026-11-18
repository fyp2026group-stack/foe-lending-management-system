import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(k =>
      JSON.stringify(k) + ':' + canonical(record[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
const nameOf = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 120 ? name : null;
};

/**
 * Native Prisma inventory location creation and version-controlled patch.
 * The historical lock order is shared with legacy catalogue writers.
 */
export async function mutateInventoryLocation(
  token: string,
  csrf: string,
  operation: 'locations' | 'patch_locations',
  body: Record<string, unknown>,
) {
  const keys = operation === 'locations'
    ? ['commandId', 'labId', 'name']
    : ['commandId', 'id', 'expectedVersion', 'name', 'active'];
  if (Object.keys(body).some(k => !keys.includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(body.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  if (operation === 'locations' && (!isUuid(body.labId) || !nameOf(body.name)))
    return { status: 422, code: 'INVALID' };
  if (operation === 'patch_locations' && (!isUuid(body.id)
      || !Number.isSafeInteger(body.expectedVersion)
      || (body.expectedVersion as number) < 0
      || (body.name !== undefined && !nameOf(body.name))
      || (body.active !== undefined && typeof body.active !== 'boolean')))
    return { status: 422, code: 'INVALID' };
  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, { csrf, requiredRoles: ['ADMIN'] });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      const old = await tx.inv_commands.findUnique({
        where: {
          actor_id_command_id: { actor_id: auth.userId, command_id: body.commandId as string },
        },
        select: { operation: true, payload: true, result: true },
      });
      if (old) {
        if (old.operation !== operation || canonical(old.payload) !== canonical(body))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return old.result as Record<string, unknown>;
      }

      let targetId: string;
      let result: { id: string; version: number; active: boolean };
      let details: Prisma.InputJsonValue | undefined;
      if (operation === 'locations') {
        const lab = await tx.laboratories.findUnique({
          where: { id: body.labId as string },
          select: { active: true },
        });
        if (!lab?.active) return { status: 422, code: 'INVALID' };
        targetId = randomUUID();
        const row = await tx.inv_locations.create({
          data: { id: targetId, lab_id: body.labId as string, name: nameOf(body.name)! },
          select: { id: true, version: true, active: true },
        });
        result = row;
      } else {
        targetId = body.id as string;
        const row = await tx.inv_locations.findUnique({
          where: { id: targetId },
          select: { id: true, lab_id: true, name: true, active: true, version: true },
        });
        if (!row) return { status: 404, code: 'NOT_FOUND' };
        if (row.version !== body.expectedVersion) return { status: 409, code: 'STALE_VERSION' };
        if (body.active === false) {
          const [stock, pending] = await Promise.all([
            tx.inv_cells.count({
              where: {
                location_id: targetId, quantity: { gt: 0 },
                state: { notIn: ['CONSUMED', 'RETIRED', 'LOST'] },
              },
            }),
            tx.lend_lines.count({
              where: { location_id: targetId, stage: { in: ['LECTURER', 'HOD', 'APPROVED'] } },
            }),
          ]);
          if (stock || pending) return { status: 409, code: 'STATE_CONFLICT' };
        }
        const next = {
          name: body.name === undefined ? row.name : nameOf(body.name)!,
          active: typeof body.active === 'boolean' ? body.active : row.active,
          version: row.version + 1,
        };
        const updated = await tx.inv_locations.updateMany({
          where: { id: targetId, version: row.version },
          data: next,
        });
        if (updated.count !== 1) return { status: 409, code: 'STALE_VERSION' };
        details = { before: row, after: { ...row, ...next } };
        result = { id: targetId, version: next.version, active: next.active };
      }
      await tx.inv_commands.create({
        data: {
          actor_id: auth.userId, command_id: body.commandId as string,
          operation, payload: body as Prisma.InputJsonValue, result,
        },
      });
      await tx.audit.create({
        data: {
          id: randomUUID(), actor_id: auth.userId, target_id: targetId,
          action: operation === 'locations' ? 'INVENTORY_CREATE_LOCATIONS' : 'INVENTORY_UPDATE_LOCATIONS',
          ...(details ? { details } : {}),
        },
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return { status: 409, code: 'DUPLICATE' };
      if (error.code === 'P2003') return { status: 409, code: 'STATE_CONFLICT' };
    }
    throw error;
  }
}
