import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { requestApprovalGate, assertRequestMayReserve } from './request-approval-gate';
import { ensureCell, postStockMovement } from './stock-ledger';

function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}

/** Reserve only after ALL requested equipment approvals have been completed. */
export async function reserveLendingLine(
  token: string, csrf: string, payload: Record<string, unknown>,
) {
  if (Object.keys(payload).some(k =>
    !['commandId','lineId','expectedVersion'].includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(payload.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  if (!isUuid(payload.lineId) ||
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
      const target = await tx.lend_lines.findUnique({
        where: { id: payload.lineId as string },
        select: {
          id: true, request_id: true, item_id: true,
          lab_id: true, location_id: true, quantity: true,
          cancelled: true, stage: true, version: true,
          lend_requests: { select: { borrower_id: true } },
          lend_allocations: { select: { id: true } },
        },
      });
      if (!target) return { status: 403, code: 'DENIED' };
      if (auth.userId !== target.lend_requests.borrower_id) {
        const assignment = auth.roles.includes('TECHNICAL_OFFICER')
          ? await tx.staff_labs.findUnique({
              where: { user_id_laboratory_id: {
                user_id: auth.userId, laboratory_id: target.lab_id,
              } }, select: { user_id: true },
            })
          : null;
        if (!assignment) return { status: 403, code: 'DENIED' };
      }
      const existing = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: payload.commandId as string,
        } },
        select: { operation: true, payload: true, result: true },
      });
      if (existing) {
        if (existing.operation !== 'reserve' ||
            canonical(existing.payload) !== canonical(payload))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return existing.result as Record<string, unknown>;
      }

      if (payload.expectedVersion !== undefined && target.version !== payload.expectedVersion)
        return { status: 409, code: 'STALE_VERSION' };
      if (target.stage !== 'APPROVED' || target.lend_allocations)
        return { status: 409, code: 'STATE_CONFLICT' };

      const requestLines = await tx.lend_lines.findMany({
        where: { request_id: target.request_id },
        select: { id: true, policy: true, quantity: true, cancelled: true,
          lend_decisions: { select: { line_id: true, stage: true, decision: true } } },
      });
      const gate = requestApprovalGate(
        requestLines.map(line => ({
          id: line.id, policy: line.policy as 'NONE' | 'LECTURER' | 'HOD' | 'BOTH',
          quantity: line.quantity, cancelledQuantity: line.cancelled,
        })),
        requestLines.flatMap(line => line.lend_decisions.map(d => ({
          lineId: d.line_id,
          role: d.stage as 'LECTURER' | 'HOD',
          decision: d.decision as 'APPROVE' | 'REJECT',
        }))),
      );
      try { assertRequestMayReserve(gate); }
      catch { return { status: 409, code: 'REQUEST_APPROVAL_INCOMPLETE' }; }

      const quantity = target.quantity - target.cancelled;
      if (quantity < 1) return { status: 409, code: 'STATE_CONFLICT' };
      const available = await tx.inv_cells.findFirst({
        where: {
          item_id: target.item_id, lab_id: target.lab_id,
          location_id: target.location_id,
          state: 'AVAILABLE', asset_id: null, quantity: { gte: quantity },
        },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!available) return { status: 409, code: 'INSUFFICIENT_STOCK' };
      const destination = await ensureCell(tx, {
        itemId: target.item_id, labId: target.lab_id,
        locationId: target.location_id, state: 'RESERVED',
      });
      const movementId = await postStockMovement(tx, {
        actorId: auth.userId, itemId: target.item_id, labId: target.lab_id,
        sourceCellId: available.id, destCellId: destination.id,
        quantity, kind: 'RESERVE', reason: 'approved lending request',
      });
      const allocationId = randomUUID();
      await tx.lend_allocations.createMany({
        data: [{
          id: allocationId, line_id: target.id, cell_id: destination.id,
          quantity, issued: 0, cancelled: 0,
        }],
      });
      const result = { allocationId, movementId };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId, command_id: payload.commandId as string,
          operation: 'reserve', payload: payload as Prisma.InputJsonValue, result,
        },
      });
      await tx.audit.createMany({
        data: [{ id: randomUUID(), actor_id: auth.userId,
          target_id: target.id, action: 'LENDING_RESERVE',
          details: { allocationId, movementId } }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'STATE_CONFLICT' };
    throw error;
  }
}
