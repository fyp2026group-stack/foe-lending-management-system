/** Strict, bounded source query; no database dependencies. */
export function parseSourceQuery(p: Record<string, unknown>) {
  if (Object.keys(p).some(k => !['q','labId','categoryId','itemId','kind','policy','availableOnly','limit','offset'].includes(k))) return null;
  const numeric = (v: unknown, d: number) => v === undefined ? d : typeof v === 'number' && Number.isSafeInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  const limit = numeric(p.limit, 100), offset = numeric(p.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return null;
  for (const key of ['labId','categoryId','itemId']) {
    if (p[key] !== undefined && (typeof p[key] !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p[key]))) return null;
  }
  if (p.q !== undefined && (typeof p.q !== 'string' || p.q.length > 120)) return null;
  if (p.kind !== undefined && !['RETURNABLE','CONSUMABLE'].includes(p.kind as string)) return null;
  if (p.policy !== undefined && !['NONE','LECTURER','HOD','BOTH'].includes(p.policy as string)) return null;
  if (p.availableOnly !== undefined && ![true,false,'true','false'].includes(p.availableOnly as boolean)) return null;
  return { limit, offset, q: ((p.q as string | undefined) ?? '').trim(),
    labId: (p.labId as string | undefined) ?? null, categoryId: (p.categoryId as string | undefined) ?? null,
    itemId: (p.itemId as string | undefined) ?? null, kind: (p.kind as string | undefined) ?? null,
    policy: (p.policy as string | undefined) ?? null };
}
