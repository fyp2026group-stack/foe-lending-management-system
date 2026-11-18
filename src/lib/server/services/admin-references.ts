import { nativeOrmTransaction, prismaTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

type Denial = { status: number; code: string };
type BatchSummary = { id: string; name: string; active: boolean; membershipCount: number };
type LabSummary = { id: string; name: string; active: boolean; staffCount: number; locationCount: number };

export type AdminReferenceResponse =
  | { items: BatchSummary[] }
  | { items: LabSummary[] }
  | Denial;

/** Native Prisma admin-only reference listings; authorization and reads share one transaction. */
export async function readAdminReferences(
  token: string,
  resource: 'batches' | 'laboratories'
): Promise<AdminReferenceResponse> {
  return nativeOrmTransaction(async (tx) => {
    const auth = await authorizePrismaSession(tx, token, { requiredRoles: ['ADMIN'] });
    if (isAuthFailure(auth)) return auth;

    if (resource === 'batches') {
      const [batches, membershipCounts] = await Promise.all([
        tx.batches.findMany({
          select: { id: true, name: true, active: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        tx.user_batch_memberships.groupBy({
          by: ['batch_id'],
          where: { ended_at: null },
          _count: { _all: true },
        }),
      ]);
      const counts = new Map(membershipCounts.map((row) => [row.batch_id, row._count._all]));
      return {
        items: batches.map((row) => ({
          id: row.id,
          name: row.name,
          active: row.active,
          membershipCount: counts.get(row.id) ?? 0,
        })),
      };
    }

    const labs = await tx.laboratories.findMany({
      select: {
        id: true, name: true, active: true,
        _count: { select: { staff_labs: true, inv_locations: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return {
      items: labs.map((row) => ({
        id: row.id,
        name: row.name,
        active: row.active,
        staffCount: row._count.staff_labs,
        locationCount: row._count.inv_locations,
      })),
    };
  });
}

/**
 * User patches that omit batchIds must preserve the existing membership set.
 * Load the current memberships and apply the protected governance operation in
 * one Prisma transaction. Do not replace missing batchIds with an empty array.
 */
export async function patchUserPreservingBatches(
  token: string,
  csrf: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return prismaTransaction(async (tx) => {
    const auth = await authorizePrismaSession(tx, token, { requiredRoles: ['ADMIN'] });
    if (isAuthFailure(auth)) return auth;

    const memberships = await tx.user_batch_memberships.findMany({
      where: { user_id: userId, ended_at: null },
      select: { batch_id: true },
      orderBy: { batch_id: 'asc' },
    });
    const body = JSON.stringify({
      ...payload,
      batchIds: memberships.map((membership) => membership.batch_id),
    });
    const response = await tx.$queryRaw<{ result: Record<string, unknown> }[]>`
      SELECT lab.admin_governance(
        ${token}, ${csrf}, ${'patch_user'},
        ${userId}::uuid, ${body}::jsonb
      ) AS result
    `;
    return response[0]?.result ?? { status: 503, code: 'DATABASE_UNAVAILABLE' };
  });
}
