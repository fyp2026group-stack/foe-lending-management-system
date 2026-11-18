import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
export type CellKey = {
  itemId: string; labId: string; locationId: string;
  assetId?: string | null; state: string;
};

/**
 * All callers MUST hold the shared inventory advisory lock 731943 before
 * calling these methods. The same lock is used by the legacy writer during
 * incremental cutover; stock transitions are never split across transactions.
 */
export async function ensureCell(tx: Tx, key: CellKey) {
  const where = {
    item_id: key.itemId, lab_id: key.labId, location_id: key.locationId,
    asset_id: key.assetId ?? null, state: key.state,
  };
  const found = await tx.inv_cells.findFirst({
    where, select: { id: true, quantity: true, version: true }, orderBy: { id: 'asc' },
  });
  if (found) return found;
  return tx.inv_cells.create({
    data: {
      id: randomUUID(), item_id: key.itemId, lab_id: key.labId,
      location_id: key.locationId, asset_id: key.assetId ?? null,
      state: key.state,
    },
    select: { id: true, quantity: true, version: true },
  });
}

export async function postStockMovement(
  tx: Tx,
  input: {
    actorId: string; itemId: string; labId: string;
    sourceCellId: string | null; destCellId: string | null;
    quantity: number; kind: string; reason: string;
  },
) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 ||
      input.quantity > 1_000_000 || input.sourceCellId === input.destCellId)
    throw new Error('INVALID_QUANTITY');
  const cellIds = [input.sourceCellId, input.destCellId].filter((id): id is string => id !== null).sort();
  for (const id of cellIds) {
    // Enforce scope for every transfer; never move another item's cell.
    const cell = await tx.inv_cells.findUnique({
      where: { id }, select: { item_id: true, lab_id: true },
    });
    if (!cell || cell.item_id !== input.itemId || cell.lab_id !== input.labId)
      throw new Error('STATE_CONFLICT');
  }
  if (input.sourceCellId) {
    const removed = await tx.inv_cells.updateMany({
      where: {
        id: input.sourceCellId, quantity: { gte: input.quantity },
      },
      data: {
        quantity: { decrement: input.quantity },
        version: { increment: 1 },
      },
    });
    if (removed.count !== 1) throw new Error('INSUFFICIENT_STOCK');
  }
  if (input.destCellId) {
    const increased = await tx.inv_cells.updateMany({
      where: { id: input.destCellId },
      data: {
        quantity: { increment: input.quantity },
        version: { increment: 1 },
      },
    });
    if (increased.count !== 1) throw new Error('STATE_CONFLICT');
  }
  const id = randomUUID();
  await tx.inv_movements.createMany({
    data: [{
      id, actor_id: input.actorId, item_id: input.itemId,
      lab_id: input.labId, kind: input.kind, reason: input.reason,
    }],
  });
  await tx.inv_entries.createMany({
    data: [
      {
        id: randomUUID(), movement_id: id, cell_id: input.sourceCellId,
        account: input.sourceCellId === null ? 'EXTERNAL' : 'STOCK',
        delta: -input.quantity,
      },
      {
        id: randomUUID(), movement_id: id, cell_id: input.destCellId,
        account: input.destCellId === null ? 'EXTERNAL' : 'STOCK',
        delta: input.quantity,
      },
    ],
  });
  await tx.audit.createMany({
    data: [{ id: randomUUID(), actor_id: input.actorId,
      action: 'INVENTORY_' + input.kind, target_id: id }],
  });
  return id;
}
