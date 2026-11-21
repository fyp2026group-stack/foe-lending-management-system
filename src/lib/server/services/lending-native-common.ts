import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { isUuid } from './uuid';

export const samePayload = (a: unknown, b: unknown): boolean => {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      return '{' + Object.keys(obj).sort().map(k =>
        JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
    }
    return JSON.stringify(v) ?? 'null';
  };
  return canonical(a) === canonical(b);
};

export function commandInput(p: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(p).some(k => !allowed.includes(k))) return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(p.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  return null;
}

export async function checkCommand(tx: Prisma.TransactionClient, actorId: string,
  operation: string, payload: Record<string, unknown>) {
  const row = await tx.lend_commands.findUnique({
    where: { actor_id_command_id: {
      actor_id: actorId, command_id: payload.commandId as string,
    } },
    select: { operation: true, payload: true, result: true },
  });
  if (!row) return null;
  if (row.operation !== operation || !samePayload(row.payload, payload))
    return { status: 409, code: 'IDENTITY_CONFLICT' };
  return row.result as Record<string, unknown>;
}

export async function recordCommand(tx: Prisma.TransactionClient, actorId: string,
  operation: string, payload: Record<string, unknown>,
  result: Record<string, unknown>, target: string | null = null) {
  await tx.lend_commands.create({
    data: { actor_id: actorId, command_id: payload.commandId as string,
      operation, payload: payload as Prisma.InputJsonValue,
      result: result as Prisma.InputJsonValue },
  });
  await tx.audit.create({
    data: { id: randomUUID(), actor_id: actorId,
      action: 'LENDING_' + operation.toUpperCase().replaceAll('-', '_'),
      target_id: target, details: result as Prisma.InputJsonValue },
    select: { id: true },
  });
}

export async function lockLending(tx: Prisma.TransactionClient) {
  // Preserve original authorization/stock/lending lock ordering across old
  // and new entry points during phased deployment.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(731944) IS NULL AS locked`;
}

export function expectedVersion(v: unknown) {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 2_147_483_647;
}
