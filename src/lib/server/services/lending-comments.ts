import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Prisma as PrismaTypes } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure, type AuthorizedSession } from './prisma-session';
import { isUuid } from './uuid';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

async function visible(
  tx: PrismaTypes.TransactionClient,
  auth: AuthorizedSession,
  requestId: string
) {
  const scopedStaff = auth.roles.includes('TECHNICAL_OFFICER') ||
    auth.roles.includes('LECTURER');
  const coverage = scopedStaff
    ? (await tx.staff_labs.findMany({
        where: { user_id: auth.userId },
        select: { laboratory_id: true },
      })).map(x => x.laboratory_id)
    : [];
  const scope: PrismaTypes.lend_linesWhereInput[] = [
    { lend_requests: { borrower_id: auth.userId } },
  ];
  if (auth.roles.includes('LECTURER') && coverage.length)
    scope.push({ lecturer_id: auth.userId, lab_id: { in: coverage } });
  if (auth.roles.includes('TECHNICAL_OFFICER') && coverage.length)
    scope.push({ lab_id: { in: coverage } });
  const match = await tx.lend_lines.findFirst({
    where: { request_id: requestId, ...(auth.roles.includes('ADMIN') ? {} : { OR: scope }) },
    select: { id: true },
  });
  return Boolean(match);
}

export async function readLendingComments(token: string, payload: Record<string, unknown>) {
  if (Object.keys(payload).some(k => k !== 'requestId') || !isUuid(payload.requestId))
    return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    if (!await visible(tx, auth, payload.requestId as string))
      return { status: 403, code: 'DENIED' };
    const rows = await tx.lend_comments.findMany({
      where: { request_id: payload.requestId as string },
      select: {
        id: true, request_id: true, author_id: true, body: true,
        corrects_id: true, created_at: true,
        users: { select: { display_name: true } },
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map(x => ({
      id: x.id, requestId: x.request_id, authorId: x.author_id,
      author: x.users.display_name, body: x.body, correctsId: x.corrects_id,
      createdAt: x.created_at,
    })) };
  });
}

/** Append-only comments, corrections, idempotency and audit share a transaction. */
export async function writeLendingComment(
  token: string,
  csrf: string,
  payload: Record<string, unknown>,
) {
  const keys = ['commandId', 'requestId', 'body', 'correctsId'];
  if (Object.keys(payload).some(k => !keys.includes(k))
    || !isUuid(payload.commandId) || !isUuid(payload.requestId)
    || typeof payload.body !== 'string'
    || payload.body.trim().length === 0 || payload.body.trim().length > 2000
    || (payload.correctsId !== undefined && !isUuid(payload.correctsId)))
    return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      const auth = await authorizePrismaSession(tx, token, { csrf });
      if (isAuthFailure(auth)) return auth;
      // Serialize with preexisting stored-function writers during migration.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731944) IS NULL AS locked`;
      const old = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: payload.commandId as string,
        }},
        select: { operation: true, payload: true, result: true },
      });
      if (old) {
        if (old.operation !== 'comments' || canonical(old.payload) !== canonical(payload))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return old.result as Record<string, unknown>;
      }
      if (!await visible(tx, auth, payload.requestId as string))
        return { status: 403, code: 'DENIED' };
      if (payload.correctsId) {
        const prior = await tx.lend_comments.findUnique({
          where: { id: payload.correctsId as string },
          select: { request_id: true, author_id: true },
        });
        if (!prior || prior.author_id !== auth.userId
          || prior.request_id !== payload.requestId) return { status: 403, code: 'DENIED' };
      }

      const created = await tx.lend_comments.create({
        data: {
          id: randomUUID(),
          request_id: payload.requestId as string,
          author_id: auth.userId,
          body: (payload.body as string).trim(),
          ...(payload.correctsId ? { corrects_id: payload.correctsId as string } : {}),
        },
        select: { id: true },
      });
      const result = { id: created.id };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId,
          command_id: payload.commandId as string,
          operation: 'comments',
          payload: payload as Prisma.InputJsonValue,
          result,
        },
      });
      await tx.audit.create({
        data: {
          id: randomUUID(), actor_id: auth.userId,
          target_id: payload.requestId as string, action: 'LENDING_COMMENTS',
        },
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'IDENTITY_CONFLICT' };
    throw error;
  }
}
