import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { parseSourceQuery } from './lending-source-query';

/** Available bulk sources with feasible non-self approval; never asset identities. */
export async function readBorrowingSources(token: string, payload: Record<string, unknown>) {
  const p = parseSourceQuery(payload);
  if (!p) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    // One statement counts and pages the same snapshot; EXISTS cannot multiply stock.
    const [result] = await tx.$queryRaw<Array<{ items: unknown[]; total: number }>>`
      WITH eligible AS (
        SELECT i.id AS "itemId", i.name AS item, i.kind, i.uom,
          cat.id AS "categoryId", cat.name AS category, i.specifications,
          l.id AS "labId", l.name AS lab, loc.id AS "locationId", loc.name AS location,
          sum(c.quantity)::bigint AS "availableQuantity", pol.policy
        FROM lab.inv_cells c
        JOIN lab.inv_items i ON i.id = c.item_id AND i.active
        JOIN lab.inv_categories cat ON cat.id = i.category_id AND cat.active
        JOIN lab.laboratories l ON l.id = c.lab_id AND l.active
        JOIN lab.inv_locations loc ON loc.id = c.location_id AND loc.lab_id = c.lab_id AND loc.active
        JOIN lab.lend_policies pol ON pol.item_id = i.id
        WHERE c.state = 'AVAILABLE' AND c.asset_id IS NULL AND c.quantity > 0
          AND (${p.labId}::uuid IS NULL OR l.id = ${p.labId}::uuid)
          AND (${p.categoryId}::uuid IS NULL OR cat.id = ${p.categoryId}::uuid)
          AND (${p.itemId}::uuid IS NULL OR i.id = ${p.itemId}::uuid)
          AND (${p.kind}::text IS NULL OR i.kind = ${p.kind})
          AND (${p.policy}::text IS NULL OR pol.policy = ${p.policy})
          AND (${p.q} = '' OR strpos(lower(concat_ws(' ', i.name, cat.name, l.name, loc.name,
            i.id::text, cat.id::text, l.id::text, loc.id::text)), lower(${p.q})) > 0)
          AND (pol.policy NOT IN ('HOD', 'BOTH') OR (
            pol.hod_id <> ${auth.userId}::uuid AND EXISTS (
              SELECT 1 FROM lab.users h JOIN lab.user_roles hr ON hr.user_id = h.id
              WHERE h.id = pol.hod_id AND NOT h.disabled AND hr.role = 'ADMIN')))
          AND (pol.policy NOT IN ('LECTURER', 'BOTH') OR EXISTS (
            SELECT 1 FROM lab.users u
            JOIN lab.user_roles ur ON ur.user_id = u.id AND ur.role = 'LECTURER'
            JOIN lab.staff_labs sl ON sl.user_id = u.id AND sl.laboratory_id = l.id
            WHERE NOT u.disabled AND u.id <> ${auth.userId}::uuid
              AND (pol.hod_id IS NULL OR u.id <> pol.hod_id)))
        GROUP BY i.id, cat.id, l.id, loc.id, pol.item_id
      ), page AS (
        SELECT * FROM eligible ORDER BY item, lab, location, "itemId", "labId", "locationId"
        LIMIT ${p.limit} OFFSET ${p.offset}
      )
      SELECT (SELECT count(*)::int FROM eligible) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY item, lab, location,
          "itemId", "labId", "locationId") FROM page), '[]'::jsonb) AS items
    `;
    return { ...result, limit: p.limit, offset: p.offset };
  });
}
