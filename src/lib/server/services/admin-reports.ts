import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

export type ReportName = 'borrowing' | 'overdue' | 'inventory' | 'approvals' | 'audit';
type ReportItem = Record<string, unknown>;
type ReportResponse = {
  report: ReportName; items: ReportItem[]; total: number;
  limit: number; offset: number; metrics: Record<string, number>;
};
const allowed = new Set([
  'batchId','labId','categoryId','itemId','borrowerId','lecturerId',
  'officerId','from','to','status','stage','kind','scope','sort',
  'direction','limit','offset',
]);
const idFields = ['batchId','labId','categoryId','itemId','borrowerId','lecturerId','officerId'];
const securityActions = new Set([
  'LOGIN','LOGOUT','LOGIN_DENIED','GOVERNANCE_DENIED','LENDING_DENIED',
  'INVENTORY_DENIED','REQUEST_DENIED','REPORT_VIEW',
]);

function parse(payload: Record<string, unknown>, all: boolean) {
  if (Object.keys(payload).some(k => !allowed.has(k)) ||
      idFields.some(k => payload[k] !== undefined && !isUuid(payload[k])))
    return null;
  const n = (v: unknown, d: number) =>
    v === undefined ? d : typeof v === 'number' && Number.isSafeInteger(v) ? v :
      typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  const limit = n(payload.limit, 50), offset = n(payload.offset, 0);
  const sort = payload.sort ?? 'date', direction = payload.direction ?? 'desc';
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 100000 ||
      !['date','borrower','item','laboratory','status','quantity'].includes(String(sort)) ||
      !['asc','desc'].includes(String(direction)) ||
      (payload.kind !== undefined && !['RETURNABLE','CONSUMABLE'].includes(String(payload.kind))) ||
      (payload.scope !== undefined && !['operations','security'].includes(String(payload.scope))))
    return null;
  const from = payload.from === undefined ? null : new Date(String(payload.from));
  const to = payload.to === undefined ? null : new Date(String(payload.to));
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) ||
      (from && to && from >= to)) return null;
  return { limit: all ? 100000 : limit, offset: all ? 0 : offset,
    requestedLimit: limit, requestedOffset: offset,
    sort: String(sort), direction: String(direction), from, to };
}

function matches(value: unknown, filter: unknown) {
  return filter === undefined || String(value ?? '') === String(filter);
}
function timeBetween(value: unknown, from: Date | null, to: Date | null) {
  const timestamp = new Date(String(value));
  return (!from || timestamp >= from) && (!to || timestamp < to);
}
function order(items: ReportItem[], sort: string, direction: string) {
  const field = sort === 'date' ? 'date' : sort;
  const ascending = direction === 'asc' ? 1 : -1;
  return items.sort((a, b) => {
    const av = a[field], bv = b[field];
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av ?? '').localeCompare(String(bv ?? ''));
    return ascending * cmp || String(a.id).localeCompare(String(b.id));
  });
}
const scopeOf = (action: string) => securityActions.has(action) ||
  action.startsWith('IDENTITY_') || action.endsWith('_USER') ? 'security' : 'operations';

export async function readAdminReport(
  token: string, report: ReportName,
  body: Record<string, unknown>, all = false,
): Promise<ReportResponse | { status: number; code: string }> {
  const p = parse(body, all);
  if (!p) return { status: 422, code: 'INVALID' };
  const activity = await nativeOrmTransaction(tx =>
    authorizePrismaSession(tx, token, { requiredRoles: ['ADMIN'] }));
  if (isAuthFailure(activity)) return activity;
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token, {
      requiredRoles: ['ADMIN'], activityAlreadyTouched: true,
    });
    if (isAuthFailure(auth)) return auth;
    const now = new Date();
    let rows: ReportItem[] = [];
    let metrics: Record<string, number> = {};
    if (report === 'audit') {
      const source = await tx.audit.findMany({
        where: {
          ...(p.from || p.to ? { occurred_at: {
            ...(p.from ? { gte: p.from } : {}),
            ...(p.to ? { lt: p.to } : {}),
          } } : {}),
        },
        select: {
          id: true, occurred_at: true, action: true, target_id: true,
          details: true, users: { select: { display_name: true } },
        },
        take: 100001,
      });
      rows = source.map(x => ({
        id: x.id, date: x.occurred_at, action: x.action,
        actor: x.users?.display_name ?? null, targetId: x.target_id,
        details: x.details, scope: scopeOf(x.action),
      })).filter(x => matches(x.scope, body.scope) && matches(x.action, body.status));
      metrics = { events: rows.length };
    } else if (report === 'inventory') {
      const source = await tx.inv_cells.findMany({
        select: {
          id: true, quantity: true, state: true, lab_id: true,
          inv_items: {
            select: {
              id: true, name: true, category_id: true, kind: true, uom: true,
              inv_categories: { select: { name: true } },
              lend_policies: { select: { policy: true } },
            },
          },
          laboratories: { select: { name: true } },
          inv_locations: { select: { name: true } },
        },
        take: 100001,
      });
      const grouped = new Map<string, ReportItem>();
      for (const cell of source) {
        const item = cell.inv_items;
        if (!matches(cell.lab_id, body.labId) ||
            !matches(item.category_id, body.categoryId) ||
            !matches(item.id, body.itemId) ||
            !matches(item.kind, body.kind)) continue;
        const key = [item.id,cell.lab_id,cell.inv_locations.name].join('/');
        let row = grouped.get(key);
        if (!row) {
          row = {
            id: item.id, item: item.name, category: item.inv_categories.name,
            kind: item.kind, uom: item.uom, laboratory: cell.laboratories.name,
            location: cell.inv_locations.name, policy: item.lend_policies?.policy ?? 'UNCONFIGURED',
            available: 0, reserved: 0, borrowed: 0, inspection: 0, maintenance: 0,
          };
          grouped.set(key,row);
        }
        const state = cell.state.toLowerCase();
        if (['available','reserved','borrowed','inspection','maintenance'].includes(state))
          row[state] = Number(row[state]) + cell.quantity;
      }
      rows = [...grouped.values()];
      metrics = { positions: rows.length };
    } else if (report === 'approvals') {
      const source = await tx.lend_decisions.findMany({
        select: {
          id: true, created_at: true, actor_id: true, stage: true,
          decision: true, remarks: true,
          users: { select: { display_name: true } },
          lend_lines: {
            select: {
              quantity: true, lab_id: true, lecturer_id: true, policy: true, item_id: true,
              laboratories: { select: { name: true } },
              inv_items: { select: { name: true, category_id: true } },
              lend_requests: {
                select: {
                  borrower_id: true, purpose: true,
                  users: { select: {
                    display_name: true, registration_number: true,
                    batch_id: true, batches: { select: { name: true } },
                  } },
                },
              },
            },
          },
        },
        take: 100001,
      });
      rows = source.map(x => {
        const line = x.lend_lines, request = line.lend_requests;
        return {
          id: x.id, date: x.created_at,
          borrower: request.users.display_name,
          registrationNumber: request.users.registration_number,
          batch: request.users.batches?.name ?? null,
          batchId: request.users.batch_id,
          item: line.inv_items.name, itemId: line.item_id,
          categoryId: line.inv_items.category_id,
          laboratory: line.laboratories.name, labId: line.lab_id,
          quantity: line.quantity, policy: line.policy, stage: x.stage,
          decision: x.decision, remarks: x.remarks,
          approver: x.users.display_name, purpose: request.purpose,
          borrowerId: request.borrower_id,
          lecturerId: x.stage === 'LECTURER' ? x.actor_id : null,
        };
      }).filter(x =>
        matches(x.batchId, body.batchId) && matches(x.labId, body.labId) &&
        matches(x.categoryId, body.categoryId) && matches(x.itemId, body.itemId) &&
        matches(x.borrowerId, body.borrowerId) && matches(x.lecturerId, body.lecturerId) &&
        matches(x.stage, body.stage) && matches(x.decision, body.status) &&
        timeBetween(x.date, p.from, p.to)
      ).map(({ batchId,labId,categoryId,itemId,borrowerId,lecturerId,...display }) => display);
      metrics = { decisions: rows.length };
    } else {
      const source = await tx.lend_loans.findMany({
        select: {
          id: true, quantity: true, returned: true, due_at: true,
          issued_at: true, borrower_id: true, issued_by: true,
          users_lend_loans_borrower_idTousers: {
            select: {
              display_name: true, registration_number: true,
              batch_id: true, batches: { select: { name: true } },
            },
          },
          users_lend_loans_issued_byTousers: { select: { display_name: true } },
          lend_allocations: {
            select: { lend_lines: {
              select: {
                item_id: true, lab_id: true, lecturer_id: true,
                inv_items: {
                  select: {
                    name: true, category_id: true, kind: true,
                    inv_categories: { select: { name: true } },
                  },
                },
                laboratories: { select: { name: true } },
                inv_locations: { select: { name: true } },
                lend_requests: { select: { purpose: true } },
              },
            } },
          },
        },
        take: 100001,
      });
      rows = source.map(loan => {
        const line = loan.lend_allocations.lend_lines;
        const user = loan.users_lend_loans_borrower_idTousers;
        const status = loan.returned >= loan.quantity ? 'RETURNED'
          : loan.due_at && loan.due_at < now ? 'OVERDUE' : 'BORROWED';
        return {
          id: loan.id, date: loan.issued_at, borrower: user.display_name,
          registrationNumber: user.registration_number,
          batchId: user.batch_id, batch: user.batches?.name ?? null,
          itemId: line.item_id, item: line.inv_items.name,
          categoryId: line.inv_items.category_id,
          category: line.inv_items.inv_categories.name,
          kind: line.inv_items.kind,
          labId: line.lab_id, laboratory: line.laboratories.name,
          location: line.inv_locations.name,
          quantity: loan.quantity, returned: loan.returned,
          dueAt: loan.due_at,
          officerId: loan.issued_by,
          technicalOfficer: loan.users_lend_loans_issued_byTousers.display_name,
          purpose: line.lend_requests.purpose,
          lecturerId: line.lecturer_id,
          borrowerId: loan.borrower_id, status,
        };
      }).filter(x =>
        (report !== 'overdue' || x.status === 'OVERDUE') &&
        matches(x.batchId, body.batchId) && matches(x.labId, body.labId) &&
        matches(x.categoryId, body.categoryId) && matches(x.itemId, body.itemId) &&
        matches(x.borrowerId, body.borrowerId) && matches(x.officerId, body.officerId) &&
        matches(x.lecturerId, body.lecturerId) && matches(x.kind, body.kind) &&
        matches(x.status, body.status) && timeBetween(x.date, p.from, p.to)
      ).map(({ batchId,labId,categoryId,itemId,borrowerId,officerId,lecturerId,...display }) => display);
      metrics = {
        records: rows.length,
        outstandingUnits: rows.reduce((sum, x) =>
          sum + Number(x.quantity) - Number(x.returned), 0),
      };
    }
    if (rows.length > 100000)
      return { status: 413, code: 'EXPORT_TOO_LARGE' };
    order(rows, p.sort, p.direction);
    const total = rows.length;
    const items = rows.slice(p.offset, p.offset + p.limit);
    await tx.audit.createMany({
      data: [{
        id: randomUUID(), actor_id: auth.userId, action: 'REPORT_VIEW',
        details: { report, filters: Object.fromEntries(Object.entries(body).filter(([key]) =>
          key !== 'offset')) } as Prisma.InputJsonValue,
      }],
    });
    return {
      report, items, total,
      limit: p.requestedLimit, offset: p.requestedOffset, metrics,
    };
  }, { isolationLevel: 'RepeatableRead' });
}
