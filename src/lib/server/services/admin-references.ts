import { prismaTransaction } from '../db';

type SessionIdentity = {
  status?: number;
  code?: string;
  user?: { id: string; roles: string[] };
};
type Denial = { status: number; code: string };
type BatchSummary = { id: string; name: string; active: boolean; membershipCount: number };
type LabSummary = { id: string; name: string; active: boolean; staffCount: number; locationCount: number };

export type AdminReferenceResponse =
  | { items: BatchSummary[] }
  | { items: LabSummary[] }
  | Denial;

/**
 * Migrated Prisma ORM reference-data reads.
 *
 * The existing identity function remains the session authority for this
 * transitional stage. Both authentication and all ORM reads occur inside a
 * single repeatable-read transaction; the runtime role receives only SELECT
 * on the five necessary reference tables, NEVER on credentials, session
 * records, audit, lending or inventory stock tables.
 */
export async function readAdminReferences(
  token: string,
  resource: 'batches' | 'laboratories'
): Promise<AdminReferenceResponse> {
  return prismaTransaction(async (tx) => {
    const response = await tx.$queryRaw<{ result: SessionIdentity }[]>`
      SELECT lab.identity_call(
        ${token}, ${''}, ${'me'}, NULL::uuid, '{}'::jsonb
      ) AS result
    `;
    const authenticated = response[0]?.result;
    if (!authenticated?.user) {
      return { status: 401, code: 'UNAUTHENTICATED' };
    }
    if (!authenticated.user.roles.includes('ADMIN')) {
      return { status: 403, code: 'DENIED' };
    }

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
    const verified = await tx.$queryRaw<{ result: SessionIdentity }[]>`
      SELECT lab.identity_call(
        ${token}, ${''}, ${'me'}, NULL::uuid, '{}'::jsonb
      ) AS result
    `;
    const identity = verified[0]?.result;
    if (!identity?.user) return { status: 401, code: 'UNAUTHENTICATED' };
    if (!identity.user.roles.includes('ADMIN')) return { status: 403, code: 'DENIED' };

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
