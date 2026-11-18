import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Policy changes are admin-only, idempotent, serialized with legacy requests. */
export async function changeLendingPolicy(
  token: string,
  csrf: string,
  p: Record<string, unknown>,
) {
  if (Object.keys(p).some(k => !['commandId', 'itemId', 'policy', 'hodId'].includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(p.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  if (!isUuid(p.itemId) || !['NONE','LECTURER','HOD','BOTH'].includes(String(p.policy)) ||
    (p.hodId !== undefined && p.hodId !== null && !isUuid(p.hodId)))
    return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      const auth = await authorizePrismaSession(tx, token, { csrf, requiredRoles: ['ADMIN'] });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731944) IS NULL AS locked`;
      const old = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: { actor_id: auth.userId, command_id: p.commandId as string } },
        select: { operation: true, payload: true, result: true },
      });
      if (old) {
        if (old.operation !== 'policies' || canonical(old.payload) !== canonical(p))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return old.result as Record<string, unknown>;
      }

      const item = await tx.inv_items.findUnique({
        where: { id: p.itemId as string }, select: { id: true },
      });
      if (!item) return { status: 404, code: 'NOT_FOUND' };
      const policy = p.policy as string;
      const hodId = (p.hodId as string | null | undefined) ?? null;
      if (policy === 'HOD' || policy === 'BOTH') {
        if (!hodId) return { status: 422, code: 'INVALID' };
        const hod = await tx.users.findFirst({
          where: {
            id: hodId, disabled: false,
            user_roles: { some: { role: 'ADMIN' } },
          },
          select: { id: true },
        });
        if (!hod) return { status: 422, code: 'INVALID' };
      }

      await tx.lend_policies.upsert({
        where: { item_id: item.id },
        create: { item_id: item.id, policy, hod_id: hodId },
        update: { policy, hod_id: hodId },
      });
      const result = { itemId: item.id };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId, command_id: p.commandId as string,
          operation: 'policies', payload: p as Prisma.InputJsonValue, result,
        },
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId,
          action: 'LENDING_POLICIES', target_id: null,
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
