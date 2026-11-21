import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { ensureCell, postStockMovement } from './stock-ledger';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return '{' + Object.keys(obj).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(obj[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Officer-only receipt. Both inventory projections and immutable ledger
 * entries commit together; duplicate provenance and command replay are safe. */
export async function receiveInventory(
  token: string, csrf: string, body: Record<string, unknown>,
) {
  if (Object.keys(body).some(key => ![
    'commandId','itemId','labId','locationId','quantity','provenance',
  ].includes(key))) return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(body.commandId)) return { status: 422, code: 'COMMAND_REQUIRED' };
  const quantity = body.quantity;
  const provenance = typeof body.provenance === 'string' ? body.provenance.trim() : '';
  if (!isUuid(body.itemId) || !isUuid(body.labId) || !isUuid(body.locationId) ||
      !Number.isSafeInteger(quantity) || (quantity as number) < 1 ||
      (quantity as number) > 1_000_000 || provenance.length < 1 ||
      provenance.length > 200) return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, {
        csrf, requiredRoles: ['TECHNICAL_OFFICER'],
      });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      const allowed = await tx.staff_labs.findUnique({
        where: { user_id_laboratory_id: {
          user_id: auth.userId, laboratory_id: body.labId as string,
        } }, select: { user_id: true },
      });
      if (!allowed) return { status: 403, code: 'DENIED' };

      const replay = await tx.inv_commands.findUnique({
        where: { actor_id_command_id: {
          actor_id: auth.userId, command_id: body.commandId as string,
        } },
        select: { operation: true, payload: true, result: true },
      });
      if (replay) {
        if (replay.operation !== 'receipts' ||
            canonical(replay.payload) !== canonical(body))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return replay.result as Record<string, unknown>;
      }
      const [item, location] = await Promise.all([
        tx.inv_items.findUnique({
          where: { id: body.itemId as string },
          select: {
            active: true,
            inv_categories: { select: { active: true } },
          },
        }),
        tx.inv_locations.findFirst({
          where: {
            id: body.locationId as string, lab_id: body.labId as string, active: true,
          },
          select: { id: true, laboratories: { select: { active: true } } },
        }),
      ]);
      if (!item?.active || !item.inv_categories.active ||
          !location?.laboratories.active) return { status: 409, code: 'STATE_CONFLICT' };
      const duplicate = await tx.inv_receipts.findUnique({
        where: {
          item_id_lab_id_provenance: {
            item_id: body.itemId as string,
            lab_id: body.labId as string,
            provenance,
          },
        },
        select: { id: true },
      });
      if (duplicate) return { status: 409, code: 'STATE_CONFLICT' };
      const cell = await ensureCell(tx, {
        itemId: body.itemId as string,
        labId: body.labId as string,
        locationId: body.locationId as string,
        state: 'AVAILABLE',
      });
      const movementId = await postStockMovement(tx, {
        actorId: auth.userId,
        itemId: body.itemId as string, labId: body.labId as string,
        sourceCellId: null, destCellId: cell.id,
        quantity: quantity as number, kind: 'RECEIPT', reason: provenance,
      });
      await tx.inv_receipts.createMany({
        data: [{ id: randomUUID(), item_id: body.itemId as string,
          lab_id: body.labId as string, provenance, movement_id: movementId }],
      });
      const result = { movementId };
      await tx.inv_commands.create({
        data: { actor_id: auth.userId,
          command_id: body.commandId as string, operation: 'receipts',
          payload: body as Prisma.InputJsonValue, result },
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status: 409, code: 'STATE_CONFLICT' };
    throw error;
  }
}
