import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { ensureCell, postStockMovement } from './stock-ledger';

function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return '{' + Object.keys(obj).sort().map(k =>
      JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}

/** Physical receipt moves identified equipment into mandatory inspection. */
export async function receiveLendingReturn(
  token: string, csrf: string, body: Record<string, unknown>,
) {
  if (Object.keys(body).some(k => ![
    'commandId','loanId','quantity','condition','expectedVersion',
  ].includes(k))) return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(body.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  if (!isUuid(body.loanId) ||
      (body.quantity !== undefined && body.quantity !== 1) ||
      typeof body.condition !== 'string' ||
      body.condition.trim().length < 1 || body.condition.trim().length > 1000 ||
      (body.expectedVersion !== undefined &&
        (!Number.isSafeInteger(body.expectedVersion) ||
         (body.expectedVersion as number) < 0)))
    return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, {
        csrf, requiredRoles: ['TECHNICAL_OFFICER'],
      });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731944) IS NULL AS locked`;

      const loan = await tx.lend_loans.findUnique({
        where: { id: body.loanId as string },
        select: {
          id: true, borrower_id: true, asset_id: true,
          quantity: true, returned: true, version: true,
          lend_allocations: {
            select: {
              lend_lines: {
                select: { item_id: true, lab_id: true, location_id: true },
              },
            },
          },
        },
      });
      if (!loan) return { status: 403, code: 'DENIED' };
      const line = loan.lend_allocations.lend_lines;
      const assigned = await tx.staff_labs.findUnique({
        where: { user_id_laboratory_id: {
          user_id: auth.userId, laboratory_id: line.lab_id,
        } },
        select: { user_id: true },
      });
      if (!assigned || auth.userId === loan.borrower_id)
        return { status: 403, code: 'DENIED' };
      const previous = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: body.commandId as string,
        } },
        select: { operation: true, payload: true, result: true },
      });
      if (previous) {
        if (previous.operation !== 'returns' ||
            canonical(previous.payload) !== canonical(body))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return previous.result as Record<string, unknown>;
      }
      if (body.expectedVersion !== undefined && body.expectedVersion !== loan.version)
        return { status: 409, code: 'STALE_VERSION' };
      if (!loan.asset_id || loan.returned + 1 > loan.quantity)
        return { status: 409, code: 'STATE_CONFLICT' };
      const borrowed = await tx.inv_cells.findFirst({
        where: {
          item_id: line.item_id, lab_id: line.lab_id,
          asset_id: loan.asset_id, state: 'BORROWED', quantity: 1,
        },
        select: { id: true, location_id: true },
      });
      if (!borrowed) return { status: 409, code: 'STATE_CONFLICT' };
      const destination = await ensureCell(tx, {
        itemId: line.item_id, labId: line.lab_id,
        locationId: borrowed.location_id, assetId: loan.asset_id,
        state: 'INSPECTION',
      });
      const movementId = await postStockMovement(tx, {
        actorId: auth.userId, itemId: line.item_id, labId: line.lab_id,
        sourceCellId: borrowed.id, destCellId: destination.id,
        quantity: 1, kind: 'RETURN', reason: 'received into inspection',
      });
      const updated = await tx.lend_loans.updateMany({
        where: { id: loan.id, version: loan.version, returned: loan.returned },
        data: { returned: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error('STALE_VERSION');
      const changed = await tx.lend_loans.findUniqueOrThrow({
        where: { id: loan.id }, select: { version: true },
      });
      const returnId = randomUUID(), inspectionId = randomUUID();
      await tx.lend_returns.createMany({
        data: [{
          id: returnId, loan_id: loan.id, actor_id: auth.userId,
          quantity: 1, condition: (body.condition as string).trim(),
        }],
      });
      await tx.lend_inspections.createMany({
        data: [{
          id: inspectionId, return_id: returnId,
          asset_id: loan.asset_id, borrower_id: loan.borrower_id,
        }],
      });
      const result = {
        loanId: loan.id, returnId, inspectionId, movementId,
        version: changed.version, inspectionVersion: 0,
      };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId, command_id: body.commandId as string,
          operation: 'returns', payload: body as Prisma.InputJsonValue,
          result,
        },
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId,
          action: 'LENDING_RETURNS', target_id: loan.id,
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') return { status: 409, code: 'STATE_CONFLICT' };
    if (error instanceof Error && error.message === 'STALE_VERSION')
      return { status: 409, code: 'STALE_VERSION' };
    throw error;
  }
}
