import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { ensureCell, postStockMovement } from './stock-ledger';

type Operation = 'assets' | 'stock' | 'adjustments' | 'approve';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const r = value as Record<string, unknown>;
    return '{' + Object.keys(r).sort().map(k =>
      JSON.stringify(k) + ':' + canonical(r[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
const fields: Record<Operation, string[]> = {
  assets: ['commandId','itemId','labId','locationId','expectedVersion','serial'],
  stock: ['commandId','itemId','labId','locationId','expectedVersion','fromState','toState','quantity','assetId'],
  adjustments: ['commandId','itemId','labId','locationId','expectedVersion','quantity','direction','reason'],
  approve: ['commandId','id'],
};
const states = ['AVAILABLE','INSPECTION','MAINTENANCE'];

export async function changeInventoryStock(
  token: string, csrf: string, op: Operation, p: Record<string, unknown>,
) {
  if (Object.keys(p).some(k => !fields[op].includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(p.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  if (op === 'approve' ? !isUuid(p.id) : (
    !isUuid(p.itemId) || !isUuid(p.labId) || !isUuid(p.locationId) ||
    !Number.isSafeInteger(p.expectedVersion) || (p.expectedVersion as number) < 0 ||
    (op === 'assets' && p.serial !== undefined &&
      (typeof p.serial !== 'string' || p.serial.length > 120)) ||
    (op === 'stock' && (
      !states.includes(String(p.fromState)) || !states.includes(String(p.toState)) ||
      p.fromState === p.toState ||
      (p.assetId !== undefined && !isUuid(p.assetId)))) ||
    (op === 'adjustments' && (
      !['ADD','REMOVE'].includes(String(p.direction)) ||
      typeof p.reason !== 'string' || p.reason.trim().length < 1 ||
      p.reason.trim().length > 1000)) ||
    (['stock','adjustments'].includes(op) &&
      (!Number.isSafeInteger(p.quantity) || (p.quantity as number) < 1 ||
       (p.quantity as number) > 1_000_000))
  )) return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, {
        csrf, requiredRoles: op === 'approve' ? ['ADMIN'] : ['TECHNICAL_OFFICER'],
      });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      const prior = await tx.inv_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: p.commandId as string,
        } },
        select: { operation: true, payload: true, result: true },
      });
      if (prior) {
        if (prior.operation !== op || canonical(prior.payload) !== canonical(p))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return prior.result as Record<string, unknown>;
      }
      let result: Record<string, unknown>;
      let auditAction: string | null = null;
      let auditTarget: string | null = null;
      if (op === 'approve') {
        const adjustment = await tx.inv_adjustments.findUnique({
          where: { id: p.id as string },
          select: {
            id: true, proposer: true, item_id: true, lab_id: true,
            location_id: true, quantity: true, direction: true,
            reason: true, state: true, expected_version: true,
          },
        });
        if (!adjustment) return { status: 404, code: 'NOT_FOUND' };
        if (adjustment.proposer === auth.userId)
          return { status: 403, code: 'SELF_APPROVAL' };
        if (adjustment.state !== 'PENDING')
          return { status: 409, code: 'STATE_CONFLICT' };
        const source = await ensureCell(tx, {
          itemId: adjustment.item_id, labId: adjustment.lab_id,
          locationId: adjustment.location_id, state: 'AVAILABLE',
        });
        if (source.version !== adjustment.expected_version)
          return { status: 409, code: 'STALE_VERSION' };
        const movementId = await postStockMovement(tx, {
          actorId: auth.userId, itemId: adjustment.item_id,
          labId: adjustment.lab_id,
          sourceCellId: adjustment.direction === 'REMOVE' ? source.id : null,
          destCellId: adjustment.direction === 'ADD' ? source.id : null,
          quantity: adjustment.quantity, kind: 'ADJUSTMENT',
          reason: adjustment.reason,
        });
        const updated = await tx.inv_adjustments.updateMany({
          where: { id: adjustment.id, state: 'PENDING' },
          data: { state: 'APPROVED', approver: auth.userId, movement_id: movementId },
        });
        if (updated.count !== 1) return { status: 409, code: 'STATE_CONFLICT' };
        result = { id: adjustment.id, movementId };
        auditTarget = adjustment.id;
        auditAction = 'INVENTORY_ADJUSTMENT_APPROVE';
      } else {
        const permitted = await tx.staff_labs.findUnique({
          where: { user_id_laboratory_id: {
            user_id: auth.userId, laboratory_id: p.labId as string,
          } }, select: { user_id: true },
        });
        if (!permitted) return { status: 403, code: 'DENIED' };
        const item = await tx.inv_items.findUnique({
          where: { id: p.itemId as string },
          select: { kind: true, active: true, inv_categories: { select: { active: true } } },
        });
        const location = await tx.inv_locations.findFirst({
          where: { id: p.locationId as string, lab_id: p.labId as string, active: true },
          select: { id: true },
        });
        if (!item || !item.active || !item.inv_categories.active || !location)
          return { status: 409, code: 'STATE_CONFLICT' };
        if ((op === 'assets' || op === 'stock') && item.kind !== 'RETURNABLE')
          return { status: 422, code: 'INVALID' };

        const from = op === 'stock' ? String(p.fromState) : 'AVAILABLE';
        const key = {
          itemId: p.itemId as string, labId: p.labId as string,
          locationId: p.locationId as string,
        };
        const assetId = op === 'stock' ? (p.assetId as string | undefined) ?? null : null;
        const source = await ensureCell(tx, {
          ...key, assetId, state: from,
        });
        if (source.version !== p.expectedVersion)
          return { status: 409, code: 'STALE_VERSION' };
        const quantity = op === 'assets' ? 1 : p.quantity as number;
        if (op === 'assets') {
          const serial = typeof p.serial === 'string' ? p.serial.trim().toUpperCase() : '';
          if (serial && !/^[ -~]+$/.test(serial))
            return { status: 422, code: 'INVALID' };
          const createdId = randomUUID();
          await tx.inv_assets.createMany({
            data: [{
              id: createdId, item_id: key.itemId, lab_id: key.labId,
              serial: serial || null,
            }],
          });
          const destination = await ensureCell(tx, {
            ...key, assetId: createdId, state: 'AVAILABLE',
          });
          const movementId = await postStockMovement(tx, {
            actorId: auth.userId, itemId: key.itemId, labId: key.labId,
            sourceCellId: source.id, destCellId: destination.id,
            quantity: 1, kind: 'MATERIALIZE', reason: 'zero-net permanent identity conversion',
          });
          result = { assetId: createdId, movementId };
          auditTarget = createdId;
        } else if (op === 'stock') {
          if (assetId !== null && quantity !== 1)
            return { status: 422, code: 'INVALID' };
          const destination = await ensureCell(tx, {
            ...key, assetId, state: String(p.toState),
          });
          const movementId = await postStockMovement(tx, {
            actorId: auth.userId, itemId: key.itemId, labId: key.labId,
            sourceCellId: source.id, destCellId: destination.id,
            quantity, kind: 'STATE_CHANGE', reason: from + ' to ' + p.toState,
          });
          result = { movementId };
          auditTarget = movementId;
        } else {
          const id = randomUUID();
          await tx.inv_adjustments.createMany({
            data: [{
              id, proposer: auth.userId,
              item_id: key.itemId, lab_id: key.labId, location_id: key.locationId,
              quantity, direction: String(p.direction),
              reason: String(p.reason).trim(), expected_version: source.version,
            }],
          });
          result = { id };
          auditAction = 'INVENTORY_ADJUSTMENT_PROPOSE';
          auditTarget = id;
        }
      }
      await tx.inv_commands.create({
        data: {
          actor_id: auth.userId, command_id: p.commandId as string,
          operation: op, payload: p as Prisma.InputJsonValue,
          result: result as Prisma.InputJsonValue,
        },
      });
      if (auditAction) await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId,
          action: auditAction, target_id: auditTarget,
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'DUPLICATE' };
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK')
      return { status: 409, code: 'INSUFFICIENT_STOCK' };
    throw error;
  }
}
