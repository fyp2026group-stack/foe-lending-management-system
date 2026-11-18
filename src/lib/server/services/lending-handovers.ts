import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { ensureCell, postStockMovement } from './stock-ledger';
import { requestApprovalGate } from './request-approval-gate';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return '{' + Object.keys(v).sort().map(k =>
      JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Physical handover, stock transfer, loan and custody receipt are atomic. */
export async function issueLendingAllocation(
  token: string, csrf: string, payload: Record<string, unknown>,
) {
  const keys = ['commandId','allocationId','quantity','assetId','serial','expectedVersion','remarks'];
  if (Object.keys(payload).some(k => !keys.includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(payload.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  const q = payload.quantity;
  if (!isUuid(payload.allocationId) ||
      !Number.isSafeInteger(q) || (q as number) < 1 || (q as number) > 1000 ||
      (payload.assetId !== undefined && !isUuid(payload.assetId)) ||
      (payload.serial !== undefined &&
       (typeof payload.serial !== 'string' || !payload.serial.trim() ||
        payload.serial.trim().length > 120)) ||
      (payload.remarks !== undefined &&
       (typeof payload.remarks !== 'string' || payload.remarks.length > 1000)) ||
      (payload.expectedVersion !== undefined &&
       (!Number.isSafeInteger(payload.expectedVersion) || (payload.expectedVersion as number) < 0)))
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

      const allocation = await tx.lend_allocations.findUnique({
        where: { id: payload.allocationId as string },
        select: {
          id: true, cell_id: true, quantity: true, issued: true, cancelled: true,
          lend_lines: {
            select: {
              id: true, request_id: true, item_id: true, lab_id: true,
              location_id: true, stage: true, version: true,
              lend_requests: {
                select: { borrower_id: true, return_at: true },
              },
              inv_items: { select: { kind: true } },
            },
          },
        },
      });
      if (!allocation) return { status: 403, code: 'DENIED' };
      const line = allocation.lend_lines;
      const borrowerId = line.lend_requests.borrower_id;
      const assigned = await tx.staff_labs.findUnique({
        where: { user_id_laboratory_id: {
          user_id: auth.userId, laboratory_id: line.lab_id,
        } },
        select: { user_id: true },
      });
      if (!assigned || auth.userId === borrowerId)
        return { status: 403, code: 'DENIED' };
      const borrower = await tx.users.findUnique({
        where: { id: borrowerId },
        select: { disabled: true, user_roles: { select: { role: true } } },
      });
      if (!borrower || borrower.disabled || !borrower.user_roles.some(x =>
        ['ADMIN','STUDENT','LECTURER','TECHNICAL_OFFICER'].includes(x.role)))
        return { status: 403, code: 'DENIED' };

      const previous = await tx.lend_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: payload.commandId as string,
        } },
        select: { operation: true, payload: true, result: true },
      });
      if (previous) {
        if (previous.operation !== 'issues' ||
            canonical(previous.payload) !== canonical(payload))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return previous.result as Record<string, unknown>;
      }
      if (payload.expectedVersion !== undefined && line.version !== payload.expectedVersion)
        return { status: 409, code: 'STALE_VERSION' };
      if (line.stage !== 'APPROVED' ||
          allocation.issued + allocation.cancelled + (q as number) > allocation.quantity)
        return { status: 409, code: 'STATE_CONFLICT' };

      const lines = await tx.lend_lines.findMany({
        where: { request_id: line.request_id },
        select: { id: true, policy: true, quantity: true, cancelled: true,
          lend_decisions: { select: { line_id: true, stage: true, decision: true } } },
      });
      const gate = requestApprovalGate(
        lines.map(x => ({
          id: x.id, policy: x.policy as 'NONE' | 'LECTURER' | 'HOD' | 'BOTH',
          quantity: x.quantity, cancelledQuantity: x.cancelled,
        })),
        lines.flatMap(x => x.lend_decisions.map(d => ({
          lineId: d.line_id, role: d.stage as 'LECTURER' | 'HOD',
          decision: d.decision as 'APPROVE' | 'REJECT',
        }))),
      );
      if (gate.state !== 'APPROVED')
        return { status: 409, code: 'REQUEST_APPROVAL_INCOMPLETE' };

      let sourceCellId = allocation.cell_id;
      let assetId: string | null = null;
      let loanReturned = 0;
      let dueAt: Date | null = null;
      if (line.inv_items.kind === 'RETURNABLE') {
        if (q !== 1 || line.lend_requests.return_at <= new Date())
          return { status: 422, code: 'INVALID' };
        dueAt = line.lend_requests.return_at;
        const allocatedCell = await tx.inv_cells.findUnique({
          where: { id: allocation.cell_id },
          select: { asset_id: true, state: true },
        });
        if (!allocatedCell || allocatedCell.state !== 'RESERVED')
          return { status: 409, code: 'STATE_CONFLICT' };
        assetId = (payload.assetId as string | undefined) ?? allocatedCell.asset_id;
        if (assetId) {
          if (payload.serial !== undefined) return { status: 409, code: 'STATE_CONFLICT' };
          const selected = await tx.inv_cells.findFirst({
            where: {
              asset_id: assetId, quantity: 1, item_id: line.item_id,
              lab_id: line.lab_id, location_id: line.location_id,
              OR: [{ state: 'AVAILABLE' }, { id: allocation.cell_id, state: 'RESERVED' }],
            },
            select: { id: true, state: true },
          });
          if (!selected) return { status: 409, code: 'STATE_CONFLICT' };
          if (selected.state === 'AVAILABLE') {
            if (allocatedCell.asset_id !== null)
              return { status: 409, code: 'STATE_CONFLICT' };
            const available = await ensureCell(tx, {
              itemId: line.item_id, labId: line.lab_id,
              locationId: line.location_id, state: 'AVAILABLE',
            });
            await postStockMovement(tx, {
              actorId: auth.userId, itemId: line.item_id, labId: line.lab_id,
              sourceCellId: allocation.cell_id, destCellId: available.id,
              quantity: 1, kind: 'RELEASE_RESERVATION',
              reason: 'identified asset selected',
            });
          }
          sourceCellId = selected.id;
        } else {
          assetId = randomUUID();
          await tx.inv_assets.createMany({
            data: [{
              id: assetId, item_id: line.item_id, lab_id: line.lab_id,
              serial: (payload.serial as string | undefined)?.trim() ?? null,
            }],
          });
          const named = await ensureCell(tx, {
            itemId: line.item_id, labId: line.lab_id,
            locationId: line.location_id, assetId, state: 'RESERVED',
          });
          await postStockMovement(tx, {
            actorId: auth.userId, itemId: line.item_id, labId: line.lab_id,
            sourceCellId: allocation.cell_id, destCellId: named.id,
            quantity: 1, kind: 'MATERIALIZE',
            reason: 'physical handover identity',
          });
          sourceCellId = named.id;
        }
      } else {
        if (payload.assetId !== undefined || payload.serial !== undefined)
          return { status: 422, code: 'INVALID' };
        loanReturned = q as number;
      }
      const destination = await ensureCell(tx, {
        itemId: line.item_id, labId: line.lab_id,
        locationId: line.location_id, assetId,
        state: assetId ? 'BORROWED' : 'CONSUMED',
      });
      const loanId = randomUUID();
      await tx.lend_loans.createMany({
        data: [{
          id: loanId, allocation_id: allocation.id, borrower_id: borrowerId,
          asset_id: assetId, quantity: q as number, returned: loanReturned,
          issued_by: auth.userId, due_at: dueAt, original_due_at: dueAt,
        }],
      });
      const movementId = await postStockMovement(tx, {
        actorId: auth.userId, itemId: line.item_id, labId: line.lab_id,
        sourceCellId, destCellId: destination.id,
        quantity: q as number, kind: 'ISSUE', reason: 'physical handover',
      });
      await tx.lend_allocations.updateMany({
        where: { id: allocation.id },
        data: { issued: { increment: q as number } },
      });
      await tx.lend_handovers.createMany({
        data: [{
          loan_id: loanId, actor_id: auth.userId, movement_id: movementId,
          remarks: typeof payload.remarks === 'string' ? payload.remarks.trim() : null,
        }],
      });
      const result = {
        loanId, assetId, movementId, version: line.version, loanVersion: 0,
      };
      await tx.lend_commands.create({
        data: {
          actor_id: auth.userId, command_id: payload.commandId as string,
          operation: 'issues', payload: payload as Prisma.InputJsonValue, result,
        },
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId,
          action: 'LENDING_ISSUES', target_id: loanId,
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'STATE_CONFLICT' };
    throw error;
  }
}
