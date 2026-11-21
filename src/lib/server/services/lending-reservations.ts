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
      const available = await tx.inv_cells.findMany({
        where: {
          item_id: target.item_id, lab_id: target.lab_id,
          location_id: target.location_id,
          state: 'AVAILABLE', quantity: { gt: 0 },
        },
        orderBy: { id: 'asc' },
        select: { id: true, asset_id: true, quantity: true },
      });
      if (available.reduce((sum, cell) => sum + cell.quantity, 0) < quantity)
        return { status: 409, code: 'INSUFFICIENT_STOCK' };
      const destination = await ensureCell(tx, {
        itemId: target.item_id, labId: target.lab_id,
        locationId: target.location_id, state: 'RESERVED',
      });
      const allocationId = randomUUID();
      await tx.lend_allocations.createMany({
        data: [{
          id: allocationId, line_id: target.id, cell_id: destination.id,
          quantity, issued: 0, cancelled: 0,
        }],
      });
      let remaining = quantity;
      // Prefer anonymous units, then reserve specific identities. Returning
      // inspected equipment to AVAILABLE must make it lendable again.
      const ordered = [...available.filter(c => c.asset_id === null),
        ...available.filter(c => c.asset_id !== null)];
      let movementId!: string;
      for (const cell of ordered) {
        if (remaining === 0) break;
        const reserved = cell.asset_id ? await ensureCell(tx, {
          itemId: target.item_id, labId: target.lab_id,
          locationId: target.location_id, assetId: cell.asset_id, state: 'RESERVED',
        }) : destination;
        const moved = Math.min(remaining, cell.quantity);
        movementId = await postStockMovement(tx, {
          actorId: auth.userId, itemId: target.item_id, labId: target.lab_id,
          sourceCellId: cell.id, destCellId: reserved.id,
          quantity: moved, kind: 'RESERVE', reason: 'approved lending request',
        });
        if (cell.asset_id) await tx.lend_reserved_assets.createMany({
          data: [{ allocation_id: allocationId, asset_id: cell.asset_id,
            cell_id: reserved.id, released: false }],
        });
        remaining -= moved;
      }
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
