import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

type Resource = 'batches' | 'laboratories';
function name(value: unknown) {
  return typeof value === 'string' && value.trim().length >= 1 &&
    value.trim().length <= 120 ? value.trim() : null;
}

/** Admin-only academic reference CRUD with guarded deactivation and audit. */
export async function changeAdminReference(
  token: string, csrf: string, resource: Resource,
  targetId: string | null, payload: Record<string, unknown>,
) {
  if (Object.keys(payload).some(key => !['name','active'].includes(key)) ||
      (targetId === null && (Object.keys(payload).length !== 1 || !name(payload.name))) ||
      (targetId !== null && (!isUuid(targetId) || typeof payload.active !== 'boolean' ||
        (payload.name !== undefined && !name(payload.name)))))
    return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, {
        csrf, requiredRoles: ['ADMIN'],
      });
      if (isAuthFailure(auth)) return auth;
      const kind = resource === 'batches' ? 'BATCH' : 'LABORATORY';
      if (targetId === null) {
        const id = randomUUID();
        if (resource === 'batches') {
          await tx.batches.createMany({ data: [{ id, name: name(payload.name)! }] });
        } else {
          await tx.laboratories.createMany({ data: [{ id, name: name(payload.name)! }] });
        }
        await tx.audit.createMany({
          data: [{ id: randomUUID(), actor_id: auth.userId,
            action: 'CREATE_' + kind, target_id: id }],
        });
        return { id, name: name(payload.name)! };
      }
      if (resource === 'batches') {
        const existing = await tx.batches.findUnique({
          where: { id: targetId }, select: { id: true, name: true, active: true },
        });
        if (!existing) return { status: 404, code: 'NOT_FOUND' };
        if (payload.active === false) {
          const current = await tx.user_batch_memberships.count({
            where: { batch_id: targetId, ended_at: null },
          });
          if (current) return { status: 409, code: 'ACTIVE_MEMBERSHIPS' };
        }
        const result = {
          id: targetId, name: name(payload.name) ?? existing.name,
          active: payload.active as boolean,
        };
        await tx.batches.updateMany({ where: { id: targetId },
          data: { name: result.name, active: result.active } });
        await tx.audit.createMany({
          data: [{ id: randomUUID(), actor_id: auth.userId,
            action: 'PATCH_BATCH', target_id: targetId,
            details: payload as Prisma.InputJsonValue }],
        });
        return result;
      }
      const existing = await tx.laboratories.findUnique({
        where: { id: targetId }, select: { id: true, name: true },
      });
      if (!existing) return { status: 404, code: 'NOT_FOUND' };
      if (payload.active === false) {
        const [assigned, stock] = await Promise.all([
          tx.staff_labs.count({ where: { laboratory_id: targetId } }),
          tx.inv_cells.count({ where: { lab_id: targetId, quantity: { gt: 0 } } }),
        ]);
        if (assigned || stock) return { status: 409, code: 'ACTIVE_LAB_REFERENCES' };
      }
      const result = {
        id: targetId, name: name(payload.name) ?? existing.name,
        active: payload.active as boolean,
      };
      await tx.laboratories.updateMany({ where: { id: targetId },
        data: { name: result.name, active: result.active } });
      await tx.audit.createMany({
        data: [{ id: randomUUID(), actor_id: auth.userId,
          action: 'PATCH_LABORATORY', target_id: targetId,
          details: payload as Prisma.InputJsonValue }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'CONFLICT' };
    throw error;
  }
}
