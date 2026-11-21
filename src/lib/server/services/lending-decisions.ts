import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

const equalPayload = (a: unknown, b: unknown): boolean => {
  const sorted = (value: unknown): string => {
    if (Array.isArray(value)) return '[' + value.map(sorted).join(',') + ']';
    if (value && typeof value === 'object') {
      const o = value as Record<string, unknown>;
      return '{' + Object.keys(o).sort().map(k =>
        JSON.stringify(k) + ':' + sorted(o[k])).join(',') + '}';
    }
    return JSON.stringify(value) ?? 'null';
  };
  return sorted(a) === sorted(b);
};

/** Current-stage approval with immutable decision history and command replay. */
export async function decideLendingRequest(
  token: string, csrf: string, payload: Record<string, unknown>,
) {
  if (Object.keys(payload).some(k => ![
    'commandId','lineId','decision','remarks','expectedVersion',
  ].includes(k))) return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(payload.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  if (!isUuid(payload.lineId) ||
    !['APPROVE','REJECT'].includes(String(payload.decision)) ||
    (payload.remarks !== undefined &&
     (typeof payload.remarks !== 'string' || payload.remarks.length > 1000)) ||
    (payload.expectedVersion !== undefined &&
      (!Number.isSafeInteger(payload.expectedVersion) || (payload.expectedVersion as number) < 0)))
    return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, { csrf });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731944) IS NULL AS locked`;
      const line = await tx.lend_lines.findUnique({
        where: { id: payload.lineId as string },
        select: {
          id: true, request_id: true, lab_id: true, lecturer_id: true,
          hod_id: true, policy: true, stage: true, version: true,
          lend_requests: { select: { borrower_id: true } },
        },
      });
      if (!line) return { status: 403, code: 'DENIED' };
      const previous = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: payload.commandId as string,
        } },
        select: { operation: true, payload: true, result: true },
      });
      if (previous && (previous.operation !== 'decisions' ||
          !equalPayload(previous.payload, payload)))
        return { status: 409, code: 'IDENTITY_CONFLICT' };

      const earlier = previous
        ? await tx.lend_decisions.findFirst({
            where: { line_id: line.id, actor_id: auth.userId },
            select: { stage: true },
            orderBy: { created_at: 'desc' },
          })
        : null;
      const stage = earlier?.stage ?? line.stage;
      const coverage = stage === 'LECTURER' &&
        auth.roles.includes('LECTURER') &&
        await tx.staff_labs.findUnique({
          where: { user_id_laboratory_id: {
            user_id: auth.userId, laboratory_id: line.lab_id,
          } }, select: { user_id: true },
        });
      const authorized = auth.userId !== line.lend_requests.borrower_id &&
        ((stage === 'LECTURER' && line.lecturer_id === auth.userId && Boolean(coverage)) ||
         (stage === 'HOD' && line.hod_id === auth.userId && auth.roles.includes('ADMIN')));
      if (!authorized) return { status: 403, code: 'DENIED' };
      if (previous) return previous.result as Record<string, unknown>;
      if (!['LECTURER','HOD'].includes(stage))
        return { status: 409, code: 'STATE_CONFLICT' };
      if (payload.expectedVersion !== undefined && line.version !== payload.expectedVersion)
        return { status: 409, code: 'STALE_VERSION' };

      const next = payload.decision === 'REJECT'
        ? 'REJECTED'
        : stage === 'LECTURER' && line.policy === 'BOTH' ? 'HOD' : 'APPROVED';
      await tx.lend_decisions.createMany({
        data: [{
          id: randomUUID(), line_id: line.id, actor_id: auth.userId,
          stage, decision: payload.decision as string,
          remarks: String(payload.remarks ?? '').trim(),
        }],
      });
      const changed = await tx.lend_lines.updateMany({
        where: { id: line.id, stage: line.stage, version: line.version },
        data: { stage: next },
      });
      if (changed.count !== 1) throw new Error('STALE_VERSION');
      const updated = await tx.lend_lines.findUniqueOrThrow({
        where: { id: line.id }, select: { version: true },
      });
      const result = { lineId: line.id, stage: next, version: updated.version };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId, command_id: payload.commandId as string,
          operation: 'decisions', payload: payload as Prisma.InputJsonValue,
          result,
        },
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId, target_id: line.id,
          action: 'LENDING_DECISIONS',
          details: { decision: payload.decision as string, stage, result },
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'STATE_CONFLICT' };
    if (error instanceof Error && error.message === 'STALE_VERSION')
      return { status: 409, code: 'STALE_VERSION' };
    throw error;
  }
}
