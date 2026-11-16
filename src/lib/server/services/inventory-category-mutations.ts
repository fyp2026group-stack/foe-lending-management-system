import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';

type Result = Record<string, unknown>;
type Failure = { status: number; code: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (status: number, code: string): Failure => ({ status, code });

/** A semantic JSON comparison, independent of user-supplied property order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(record[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
function sha(text: string) {
  return createHash('sha256').update(text).digest('hex');
}
function csrfMatches(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
function nameValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 120 ? trimmed : undefined;
}
function allowedKeys(payload: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(payload).every(key => keys.includes(key));
}
export function uuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

/**
 * Replaces POST/PATCH inventory category business logic using Prisma ORM.
 *
 * This service runs with lab_orm, which has no access to credentials, stock,
 * lending, or full audit history. It obtains the SAME advisory locks used by
 * legacy inventory writes so both implementations serialize their commands.
 * All writes, replay checks and audit insertion share one transaction.
 */
export async function mutateInventoryCategory(
  token: string,
  csrf: string,
  operation: 'categories' | 'patch_categories',
  payload: Record<string, unknown>
): Promise<Result> {
  try {
    return await nativeOrmTransaction(async tx => {
      // Existing inventory RPC uses these locks in this order.
      // Booleans avoid decoding PostgreSQL's unsupported void result.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const session = token ? await tx.sessions.findUnique({
        where: { token_hash: sha(token) },
        select: {
          user_id: true, csrf_hash: true, expires_at: true,
          last_seen_at: true, revoked: true,
        },
      }) : null;
      const now = new Date();
      if (!session || session.revoked || session.expires_at <= now
        || session.last_seen_at.getTime() <= now.getTime() - 30 * 60_000) {
        return failure(401, 'UNAUTHENTICATED');
      }
      const user = await tx.users.findUnique({
        where: { id: session.user_id }, select: { id: true, disabled: true },
      });
      if (!user || user.disabled) return failure(401, 'UNAUTHENTICATED');
      if (!csrfMatches(session.csrf_hash, sha(csrf))) return failure(403, 'CSRF_DENIED');
      const roles = await tx.user_roles.findMany({
        where: { user_id: user.id }, select: { role: true },
      });
      if (!roles.some(role => role.role === 'ADMIN')) return failure(403, 'DENIED');
      await tx.sessions.updateMany({
        where: { token_hash: sha(token) },
        data: { last_seen_at: now },
      });

      // Avoid races with legacy SQL function callers, including commands
      // affecting inventory catalogue references.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      const keys = operation === 'categories'
        ? ['commandId', 'name']
        : ['commandId', 'id', 'expectedVersion', 'name', 'active'];
      if (!allowedKeys(payload, keys)) return failure(422, 'UNSUPPORTED_FIELD');
      if (!uuid(payload.commandId)) return failure(422, 'COMMAND_REQUIRED');
      const commandId = payload.commandId;

      const previous = await tx.inv_commands.findUnique({
        where: {
          actor_id_command_id: { actor_id: user.id, command_id: commandId },
        },
        select: { operation: true, payload: true, result: true },
      });
      if (previous) {
        if (previous.operation !== operation
          || canonical(previous.payload) !== canonical(payload)) {
          return failure(409, 'IDENTITY_CONFLICT');
        }
        return previous.result as Result;
      }

      let result: Result;
      let auditAction: string;
      let targetId: string;
      let before: Record<string, unknown> | undefined;
      let after: Record<string, unknown> | undefined;

      if (operation === 'categories') {
        const name = nameValue(payload.name);
        if (!name) return failure(422, 'INVALID');
        const created = await tx.inv_categories.create({
          data: { id: randomUUID(), name, active: true, version: 0 },
          select: { id: true, active: true, version: true },
        });
        result = created;
        targetId = created.id;
        auditAction = 'INVENTORY_CREATE_CATEGORIES';
      } else {
        if (!uuid(payload.id)) return failure(422, 'INVALID');
        if (!Number.isSafeInteger(payload.expectedVersion)
          || (payload.expectedVersion as number) < 0) return failure(422, 'INVALID');
        if (payload.name !== undefined && !nameValue(payload.name)) return failure(422, 'INVALID');
        if (payload.active !== undefined && typeof payload.active !== 'boolean') {
          return failure(422, 'INVALID');
        }
        targetId = payload.id;
        const existing = await tx.inv_categories.findUnique({
          where: { id: targetId },
          select: { id: true, name: true, active: true, version: true },
        });
        if (!existing) return failure(404, 'NOT_FOUND');
        if (existing.version !== payload.expectedVersion) return failure(409, 'STALE_VERSION');
        if (payload.active === false && await tx.inv_items.count({
          where: { category_id: targetId, active: true },
        }) > 0) return failure(409, 'STATE_CONFLICT');
        const next = {
          name: nameValue(payload.name) ?? existing.name,
          active: typeof payload.active === 'boolean' ? payload.active : existing.active,
          version: existing.version + 1,
        };
        const updated = await tx.inv_categories.updateMany({
          where: { id: targetId, version: existing.version },
          data: next,
        });
        if (updated.count !== 1) return failure(409, 'STALE_VERSION');
        before = existing;
        after = { ...existing, ...next };
        result = { id: targetId, version: next.version, active: next.active };
        auditAction = 'INVENTORY_UPDATE_CATEGORIES';
      }

      await tx.inv_commands.createMany({
        data: [{
          actor_id: user.id,
          command_id: commandId,
          operation,
          payload: payload as Prisma.InputJsonValue,
          result: result as Prisma.InputJsonValue,
        }],
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(),
          actor_id: user.id,
          target_id: targetId,
          action: auditAction,
          ...(before && after
            ? { details: { before, after } as Prisma.InputJsonValue }
            : {}),
        }],
      });
      return result;
    });
  } catch (error) {
    if (process.env.M2_TEST_ENABLE === 'synthetic-only') {
      const issue = error as { code?: string; meta?: { code?: string }; constructor?: { name?: string } };
      console.warn('Native Prisma category transaction diagnostic', {
        errorType: issue.constructor?.name,
        prismaCode: issue.code,
        sqlState: issue.meta?.code,
      });
    }
    // Expected PostgreSQL uniqueness and foreign-key violations are mapped
    // without leaking internal database error details to API clients.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return failure(409, 'DUPLICATE');
      if (error.code === 'P2003') return failure(409, 'STATE_CONFLICT');
    }
    throw error; // unexpected problems remain a generic 503 at the route
  }
}
