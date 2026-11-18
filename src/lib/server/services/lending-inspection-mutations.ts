import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { ensureCell, postStockMovement } from './stock-ledger';
import { checkCommand, commandInput, expectedVersion, lockLending, recordCommand } from './lending-native-common';

type Operation = 'inspections' | 'maintenance';

export async function changePhysicalInspection(
  token: string, csrf: string, op: Operation, body: Record<string, unknown>
) {
  const keys = op === 'inspections'
    ? ['commandId','inspectionId','expectedVersion','outcome','condition','notes']
    : ['commandId','maintenanceId','expectedVersion','status','notes'];
  const invalid = commandInput(body, keys);
  if (invalid) return invalid;
  if (!expectedVersion(body.expectedVersion) ||
      typeof body.notes !== 'string' || body.notes.trim().length < 1 ||
      body.notes.trim().length > 1000 ||
      (op === 'inspections'
        ? !isUuid(body.inspectionId) ||
          !['UNRESOLVED','CLEAR_AVAILABLE','ROUTE_MAINTENANCE'].includes(String(body.outcome)) ||
          typeof body.condition !== 'string' || body.condition.trim().length < 1 ||
          body.condition.trim().length > 1000
        : !isUuid(body.maintenanceId) ||
          !['IN_PROGRESS','RESOLVED_AVAILABLE','RETIRED'].includes(String(body.status))))
    return { status: 422, code: 'INVALID' };
  try {
    return await nativeOrmTransaction(async tx => {
      const auth = await authorizePrismaSession(tx, token, {
        csrf, requiredRoles: ['TECHNICAL_OFFICER'],
      });
      if (isAuthFailure(auth)) return auth;
      await lockLending(tx);
      const inspection = op === 'inspections'
        ? await tx.lend_inspections.findUnique({
            where: { id: body.inspectionId as string },
            select: {
              id:true, asset_id:true, version:true, status:true,
              lend_returns: { select: { lend_loans: { select: {
                borrower_id:true, lend_allocations: { select: {
                  lend_lines: { select: { lab_id:true, item_id:true } },
                } },
              } } } },
            },
          })
        : null;
      const maintenance = op === 'maintenance'
        ? await tx.lend_maintenance.findUnique({
            where: { id: body.maintenanceId as string },
            select: {
              id:true, version:true, status:true, inspection_id:true,
              lend_inspections: {
                select: { asset_id:true, lend_returns: {
                  select: { lend_loans: { select: {
                    borrower_id:true, lend_allocations: { select: {
                      lend_lines: { select: { lab_id:true, item_id:true } },
                    } },
                  } } },
                },
              } },
            },
          })
        : null;
      if (!(inspection || maintenance)) return { status: 403, code: 'DENIED' };
      const asset = inspection?.asset_id ?? maintenance!.lend_inspections.asset_id;
      const loan = inspection?.lend_returns.lend_loans ??
        maintenance!.lend_inspections.lend_returns.lend_loans;
      const line = loan.lend_allocations.lend_lines;
      if (auth.userId === loan.borrower_id) return { status: 403, code: 'DENIED' };
      const assignment = await tx.staff_labs.findUnique({
        where: { user_id_laboratory_id: {
          user_id: auth.userId, laboratory_id: line.lab_id,
        } }, select: { user_id:true },
      });
      if (!assignment) return { status: 403, code: 'DENIED' };
      const replay = await checkCommand(tx, auth.userId, op, body);
      if (replay) return replay;
      const version = inspection?.version ?? maintenance!.version;
      if (body.expectedVersion !== version) return { status: 409, code: 'STALE_VERSION' };
      const cell = await tx.inv_cells.findFirst({
        where: { asset_id:asset, item_id:line.item_id,lab_id:line.lab_id,quantity:1 },
        select: { id:true,item_id:true,lab_id:true,location_id:true,state:true },
      });
      const expectedState = op === 'inspections' ? 'INSPECTION' : 'MAINTENANCE';
      if (!cell || cell.state !== expectedState ||
          (op === 'inspections' ? inspection!.status !== 'UNRESOLVED' :
            !['OPEN','IN_PROGRESS'].includes(maintenance!.status)))
        return { status: 409, code: 'STATE_CONFLICT' };
      let nextState: string | null = null;
      let result: Record<string,unknown>;
      if (op === 'inspections') {
        const nextVersion = inspection!.version + 1;
        const outcome = body.outcome as string;
        const updated = await tx.lend_inspections.updateMany({
          where: { id:inspection!.id, version:inspection!.version, status:'UNRESOLVED' },
          data: { status:outcome,version:{increment:1} },
        });
        if (updated.count !== 1) throw new Error('STALE_VERSION');
        await tx.lend_inspection_events.create({
          data: {
            inspection_id:inspection!.id, actor_id:auth.userId,
            outcome,condition:(body.condition as string).trim(),
            notes:(body.notes as string).trim(),version:nextVersion,
          }, select: { id:true },
        });
        let maintenanceId: string | null = null;
        if (outcome === 'CLEAR_AVAILABLE') nextState = 'AVAILABLE';
        if (outcome === 'ROUTE_MAINTENANCE') {
          nextState = 'MAINTENANCE';
          maintenanceId = randomUUID();
          await tx.lend_maintenance.create({
            data: { id:maintenanceId,inspection_id:inspection!.id,created_by:auth.userId },
            select: { id:true },
          });
          await tx.lend_maintenance_events.create({
            data: { maintenance_id:maintenanceId,actor_id:auth.userId,
              status:'OPEN',notes:(body.notes as string).trim(),version:0 },
            select: { id:true },
          });
        }
        result = { inspectionId:inspection!.id,version:nextVersion,
          status:outcome,maintenanceId,maintenanceVersion:maintenanceId ? 0 : null };
      } else {
        const next = body.status as string, nextVersion = maintenance!.version + 1;
        if (next === maintenance!.status) return { status:409,code:'STATE_CONFLICT' };
        const updated = await tx.lend_maintenance.updateMany({
          where: { id:maintenance!.id,version:maintenance!.version,
            status:{in:['OPEN','IN_PROGRESS']} },
          data: { status:next,version:{increment:1},updated_at:new Date() },
        });
        if (updated.count !== 1) throw new Error('STALE_VERSION');
        await tx.lend_maintenance_events.create({
          data: { maintenance_id:maintenance!.id,actor_id:auth.userId,status:next,
            notes:(body.notes as string).trim(),version:nextVersion },
          select: { id:true },
        });
        if (next === 'RESOLVED_AVAILABLE') nextState = 'AVAILABLE';
        if (next === 'RETIRED') nextState = 'RETIRED';
        result = { maintenanceId:maintenance!.id,status:next,version:nextVersion };
      }
      if (nextState) {
        const dest = await ensureCell(tx, {
          itemId:cell.item_id,labId:cell.lab_id,locationId:cell.location_id,
          assetId:asset,state:nextState,
        });
        const movementId = await postStockMovement(tx, {
          actorId:auth.userId,itemId:cell.item_id,labId:cell.lab_id,
          sourceCellId:cell.id,destCellId:dest.id,quantity:1,
          kind:op.toUpperCase(),reason:(body.notes as string).trim(),
        });
        result.movementId = movementId;
      }
      await recordCommand(tx,auth.userId,op,body,result,
        inspection?.id ?? maintenance!.id);
      return result;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE_VERSION')
      return { status:409,code:'STALE_VERSION' };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { status:409,code:'STATE_CONFLICT' };
    throw error;
  }
}
