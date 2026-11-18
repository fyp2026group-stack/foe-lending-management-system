import { transaction } from './db';
import { importRows, importIssues } from './inventory-import';
import { boundedBody } from './work';
import { readInventoryCategories } from './services/inventory-categories';
import { readInventoryItems } from './services/inventory-items';
import { readInventoryStock } from './services/inventory-stock';
import { readInventoryImports, readInventoryImportDetail } from './services/inventory-imports';
import { readInventoryAdjustments } from './services/inventory-adjustments';
import { readInventoryLocations } from './services/inventory-locations';
import { mutateInventoryCategory } from './services/inventory-category-mutations';
import { mutateInventoryLocation } from './services/inventory-location-mutations';
const resources = [
  'categories',
  'items',
  'locations',
  'stock',
  'assets',
  'movements',
  'receipts',
  'adjustments',
  'imports',
];
export async function inventory(request: Request, path: string[]) {
  const write = ['POST', 'PATCH'].includes(request.method),
    url = new URL(request.url);
  const token =
    request.headers
      .get('cookie')
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('lab_session='))
      ?.slice(12) ?? '';
  const csrf = request.headers.get('x-csrf-token') ?? '';
  const rpc = (op: string, p: unknown) =>
    transaction(
      async (c) =>
        (await c.query('SELECT lab.inventory_call($1,$2,$3,$4::jsonb) AS result', [token, csrf, op, p]))
          .rows[0].result
    );
  let op = path[0];
  if (!resources.includes(op)) return { status: 404, code: 'NOT_FOUND' };
  if (!write && op === 'imports' && path.length === 2) {
    if (url.searchParams.size) return { status: 422, code: 'INVALID' };
    return readInventoryImportDetail(token, path[1]);
  }
  if (!write) {
    if (path.length !== 1) return { status: 404, code: 'NOT_FOUND' };
    const p: Record<string, unknown> = {};
    for (const [key, value] of url.searchParams) {
      if (key in p) return { status: 422, code: 'INVALID' };
      if (['limit', 'offset'].includes(key)) {
        if (!/^[0-9]+$/.test(value)) return { status: 422, code: 'INVALID' };
        p[key] = Number(value);
      } else p[key] = value;
    }
    if (op === 'categories') return readInventoryCategories(token, p);
    if (op === 'items') return readInventoryItems(token, p);
    if (op === 'stock') return readInventoryStock(token, p);
    if (op === 'imports') return readInventoryImports(token, p);
    if (op === 'adjustments') return readInventoryAdjustments(token, p);
    if (op === 'locations') return readInventoryLocations(token, p);
    return rpc('read_' + op, p);
  }
  if (request.headers.get('origin') !== (process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000'))
    return { status: 403, code: 'ORIGIN_DENIED' };
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    return { status: 415, code: 'JSON_REQUIRED' };
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(await boundedBody(request, 750000));
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error();
  } catch {
    return { status: 422, code: 'INVALID' };
  }
  if (request.method === 'PATCH') {
    if (path.length !== 2 || !['categories', 'items', 'locations'].includes(op))
      return { status: 404, code: 'NOT_FOUND' };
    if (url.searchParams.size || 'id' in p) return { status: 422, code: 'UNSUPPORTED_FIELD' };
    if (op === 'categories') return mutateInventoryCategory(token, csrf, 'patch_categories', { ...p, id: path[1] });
    if (op === 'locations') return mutateInventoryLocation(token, csrf, 'patch_locations', { ...p, id: path[1] });
    return rpc('patch_' + op, { ...p, id: path[1] });
  }
  if (path[0] === 'imports' && path[1] === 'preview' && path.length === 2) {
    if (Object.keys(p).some((k) => !['commandId', 'format', 'content'].includes(k)))
      return { status: 422, code: 'UNSUPPORTED_FIELD' };
    const admit = await transaction(
      async (c) =>
        (await c.query('SELECT lab.inventory_import_admit($1,$2) AS result', [token, csrf])).rows[0]
          .result
    );
    if (admit.status) return admit;
    try {
      p = { commandId: p.commandId, rows: await importRows(p.format, p.content) };
    } catch (error) {
      return { status: 422, code: 'VALIDATION_FAILED', errors: importIssues(error) };
    }
    op = 'preview';
  } else if (
    path.length === 3 &&
    ((path[0] === 'adjustments' && path[2] === 'approve') ||
      (path[0] === 'imports' && path[2] === 'commit'))
  ) {
    if (Object.keys(p).some((k) => k !== 'commandId'))
      return { status: 422, code: 'UNSUPPORTED_FIELD' };
    p = { ...p, id: path[1] };
    op = path[2];
  } else if (
    path.length !== 1 ||
    !['categories', 'items', 'locations', 'receipts', 'assets', 'stock', 'adjustments'].includes(op)
  )
    return { status: 404, code: 'NOT_FOUND' };
  if (op === 'categories') return mutateInventoryCategory(token, csrf, 'categories', p);
  if (op === 'locations') return mutateInventoryLocation(token, csrf, 'locations', p);
  return rpc(op, p);
}
