import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  return next.length > 0 && next.length <= max ? next : null;
}

function validSpecs(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  return entries.length <= 30 &&
    Buffer.byteLength(JSON.stringify(record), 'utf8') <= 12000 &&
    entries.every(([key, text]) =>
      key.length > 0 && key.length <= 80 &&
      typeof text === 'string' && text.length <= 500
    );
}

export async function mutateInventoryItem(
  token: string,
  csrf: string,
  operation: 'items' | 'patch_items',
  body: Record<string, unknown>,
) {
  const keys = operation === 'items'
    ? ['commandId', 'name', 'categoryId', 'kind', 'uom', 'specifications']
    : ['commandId', 'id', 'expectedVersion', 'name', 'active', 'categoryId', 'kind', 'uom', 'specifications'];
  if (Object.keys(body).some(k => !keys.includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  if (!isUuid(body.commandId))
    return { status: 422, code: 'COMMAND_REQUIRED' };
  if ((operation === 'items' && (!trimmed(body.name, 120)
    || !isUuid(body.categoryId)
    || !['RETURNABLE', 'CONSUMABLE'].includes(String(body.kind))
    || !trimmed(body.uom, 40))) ||
    (operation === 'patch_items' && (!isUuid(body.id)
      || !Number.isSafeInteger(body.expectedVersion)
      || (body.expectedVersion as number) < 0
      || (body.name !== undefined && !trimmed(body.name, 120))
      || (body.active !== undefined && typeof body.active !== 'boolean')
      || (body.categoryId !== undefined && !isUuid(body.categoryId))
      || (body.kind !== undefined && !['RETURNABLE','CONSUMABLE'].includes(String(body.kind)))
      || (body.uom !== undefined && !trimmed(body.uom, 40)))) ||
    (body.specifications !== undefined && !validSpecs(body.specifications)))
    return { status: 422, code: 'INVALID' };

  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, { csrf, requiredRoles: ['ADMIN'] });
      if (isAuthFailure(auth)) return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      const previous = await tx.inv_commands.findUnique({
        where: {
          actor_id_command_id: {
            actor_id: auth.userId, command_id: body.commandId as string,
          },
        },
        select: { operation: true, payload: true, result: true },
      });
      if (previous) {
        if (previous.operation !== operation || canonical(previous.payload) !== canonical(body))
          return { status: 409, code: 'IDENTITY_CONFLICT' };
        return previous.result as Record<string, unknown>;
      }
      const catId = body.categoryId as string | undefined;
      let id: string;
      let result: { id: string; version: number; active: boolean };
      let details: Prisma.InputJsonValue | undefined;
      if (operation === 'items') {
        const category = await tx.inv_categories.findUnique({
          where: { id: catId! }, select: { active: true },
        });
        if (!category?.active) return { status: 422, code: 'INVALID' };
        id = randomUUID();
        result = await tx.inv_items.create({
          data: {
            id, category_id: catId!,
            name: trimmed(body.name, 120)!,
            kind: body.kind as string,
            uom: trimmed(body.uom, 40)!,
            ...(body.specifications !== undefined
              ? { specifications: body.specifications as Prisma.InputJsonValue } : {}),
          },
          select: { id: true, active: true, version: true },
        });
      } else {
        id = body.id as string;
        const current = await tx.inv_items.findUnique({
          where: { id },
          select: {
            id: true, category_id: true, name: true, kind: true,
            uom: true, specifications: true, active: true, version: true,
          },
        });
        if (!current) return { status: 404, code: 'NOT_FOUND' };
        if (current.version !== body.expectedVersion)
          return { status: 409, code: 'STALE_VERSION' };
        const categoryId = catId ?? current.category_id;
        const category = await tx.inv_categories.findUnique({
          where: { id: categoryId }, select: { active: true },
        });
        if ((catId && !category?.active) ||
          ((body.active ?? current.active) && !category?.active))
          return { status: 409, code: 'STATE_CONFLICT' };
        const nextKind = body.kind === undefined ? current.kind : String(body.kind);
        const nextUom = body.uom === undefined ? current.uom : trimmed(body.uom, 40)!;
        const structuralChange = nextKind !== current.kind || nextUom !== current.uom;
        if (structuralChange) {
          const [movement, lending] = await Promise.all([
            tx.inv_movements.count({ where: { item_id: id } }),
            tx.lend_lines.count({ where: { item_id: id } }),
          ]);
          if (movement || lending) return { status: 409, code: 'STATE_CONFLICT' };
        }
        if (body.active === false) {
          const [stock, activeLending] = await Promise.all([
            tx.inv_cells.count({
              where: {
                item_id: id, quantity: { gt: 0 },
                state: { notIn: ['CONSUMED','RETIRED','LOST'] },
              },
            }),
            tx.lend_lines.count({
              where: { item_id: id, stage: { in: ['LECTURER','HOD','APPROVED'] } },
            }),
          ]);
          if (stock || activeLending) return { status: 409, code: 'STATE_CONFLICT' };
        }
        const next = {
          name: body.name === undefined ? current.name : trimmed(body.name, 120)!,
          category_id: categoryId,
          kind: nextKind,
          uom: nextUom,
          active: body.active === undefined ? current.active : body.active as boolean,
          version: current.version + 1,
          specifications: body.specifications === undefined
            ? current.specifications as Prisma.InputJsonValue
            : body.specifications as Prisma.InputJsonValue,
        };
        const changed = await tx.inv_items.updateMany({
          where: { id, version: current.version }, data: next,
        });
        if (changed.count !== 1) return { status: 409, code: 'STALE_VERSION' };
        result = { id, version: next.version, active: next.active };
        details = { before: current as unknown as Prisma.InputJsonValue,
          after: { ...current, ...next } as Prisma.InputJsonValue };
      }
      await tx.inv_commands.create({
        data: {
          actor_id: auth.userId,
          command_id: body.commandId as string,
          operation, payload: body as Prisma.InputJsonValue,
          result,
        },
      });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId, target_id: id,
          action: operation === 'items' ? 'INVENTORY_CREATE_ITEMS' : 'INVENTORY_UPDATE_ITEMS',
          ...(details ? { details } : {}),
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return { status: 409, code: 'DUPLICATE' };
      if (error.code === 'P2003') return { status: 409, code: 'STATE_CONFLICT' };
    }
    throw error;
  }
}
