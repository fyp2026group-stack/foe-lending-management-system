import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  catalogueRows,
  itemBalances,
  stockLabel,
  definitionPayload,
} from '../src/components/inventory/catalogue-model.ts';

const items = [
  {
    id: '1',
    name: 'Meter 10',
    kind: 'RETURNABLE',
    available: 4,
    reserved: 2,
    borrowed: 1,
    inspection: 3,
    maintenance: 0,
  },
  {
    id: '2',
    name: 'Meter 2',
    kind: 'RETURNABLE',
    available: 7,
    reserved: 0,
    borrowed: 3,
    inspection: 0,
    maintenance: 1,
  },
  {
    id: '3',
    name: 'Gloves',
    kind: 'CONSUMABLE',
    available: 100,
    reserved: 5,
    borrowed: 0,
    inspection: 0,
    maintenance: 0,
  },
];
test('catalogue balances retain server totals without inferring undisclosed states', () => {
  assert.deepEqual(itemBalances(items[0]), {
    available: 4,
    reserved: 2,
    borrowed: 1,
    inspection: 3,
    maintenance: 0,
  });
  const partial = itemBalances({ id: 'p', name: 'Partial', kind: 'RETURNABLE', available: 6 });
  assert.equal(partial.available, 6);
  assert.equal(partial.reserved, undefined);
  assert.equal(partial.borrowed, undefined);
});
test('physical balances conserve quantities and exclude other items', () => {
  const cells = [
    { itemId: '1', state: 'AVAILABLE', quantity: 4 },
    { itemId: '1', state: 'AVAILABLE', quantity: 2 },
    { itemId: '1', state: 'BORROWED', quantity: 3 },
    { itemId: '2', state: 'AVAILABLE', quantity: 99 },
  ];
  const balance = itemBalances(items[0], cells);
  assert.equal(balance.available, 6);
  assert.equal(balance.borrowed, 3);
  assert.equal(balance.reserved, 0);
});
test('state filtering precedes sorting and pagination across the complete catalogue', () => {
  const filtered = catalogueRows(items, undefined, 'borrowed', 'borrowed', true);
  assert.deepEqual(
    filtered.map((row) => row.item.id),
    ['2', '1']
  );
  assert.deepEqual(
    catalogueRows(items, undefined, '', 'name', false).map((row) => row.item.name),
    ['Gloves', 'Meter 2', 'Meter 10']
  );
  assert.deepEqual(
    catalogueRows(items, undefined, 'inspection', 'available', false).map((row) => row.item.id),
    ['1']
  );
  assert.equal(catalogueRows(items, undefined, 'maintenance', 'name', false).length, 1);
  assert.equal(filtered.slice(0, 1)[0].item.id, '2');
  assert.equal(filtered.slice(1, 2)[0].item.id, '1');
  assert.deepEqual(
    items.map((item) => item.id),
    ['1', '2', '3']
  );
});
test('stock terminology uses operational labels', () => {
  assert.equal(stockLabel('BORROWED'), 'Borrowed equipment');
  assert.equal(stockLabel('ISSUE'), 'Handover');
});
test('definition PATCH bodies contain changed fields and cannot move a location to another lab', () => {
  const item = {
    id: 'i',
    name: 'Meter',
    kind: 'RETURNABLE',
    uom: 'unit',
    categoryId: 'c',
    active: true,
    version: 4,
  };
  assert.deepEqual(definitionPayload('items', item, { ...item, name: 'Updated' }, false), {
    expectedVersion: 4,
    name: 'Updated',
  });
  assert.deepEqual(definitionPayload('items', item, { ...item, name: 'Ignored' }, true), {
    expectedVersion: 4,
    active: false,
  });
  assert.deepEqual(
    definitionPayload(
      'locations',
      { id: 'l', name: 'Store', labId: 'original', active: true, version: 0 },
      { name: 'Renamed', labId: 'other', active: true },
      false
    ),
    { expectedVersion: 0, name: 'Renamed' }
  );
  assert.deepEqual(
    definitionPayload('locations', undefined, { name: 'Store', labId: 'original' }, false),
    { name: 'Store', labId: 'original' }
  );
  assert.deepEqual(
    definitionPayload(
      'categories',
      { id: 'c', name: 'Category', version: 0, active: false },
      { name: 'Category', active: true },
      false
    ),
    { expectedVersion: 0, active: true }
  );
});

// Exercise the actual browser adapter with a fake transport, without needing a live session.
const moduleUrl = (source) =>
  'data:text/javascript;base64,' +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64');
const identityUrl = moduleUrl(
  readFileSync(new URL('../src/components/identity/api.ts', import.meta.url), 'utf8')
);
const inventorySource = readFileSync(
  new URL('../src/components/inventory/api.ts', import.meta.url),
  'utf8'
).replace('@/components/identity/api', identityUrl);
const { inventoryWrite, inventoryRead, InventoryError } = await import(moduleUrl(inventorySource));
test('catalogue PATCH preserves CSRF, credentials, versions and command identity', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 'item', version: 2 });
  };
  try {
    const body = { commandId: 'same-command', name: 'Updated', expectedVersion: 1, active: false };
    await inventoryWrite('items/item', body, 'csrf-token', 'PATCH');
    await inventoryWrite('items/item', body, 'csrf-token', 'PATCH');
    assert.equal(calls[0].url, '/api/inventory/items/item');
    assert.equal(calls[0].options.method, 'PATCH');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.headers['X-CSRF-Token'], 'csrf-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), body);
    assert.equal(calls[0].options.body, calls[1].options.body);
    await inventoryWrite('categories', { commandId: 'create', name: 'Category' }, 'csrf-token');
    assert.equal(calls[2].options.method, 'POST');
  } finally {
    globalThis.fetch = original;
  }
});
test('catalogue conflicts stay failures; read normalization retains new DTO fields', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ code: 'STALE_VERSION' }, { status: 409 });
    await assert.rejects(
      () => inventoryWrite('locations/location', { expectedVersion: 0 }, 'csrf', 'PATCH'),
      (error) => error instanceof InventoryError && error.status === 409
    );
    globalThis.fetch = async () =>
      Response.json({
        items: [
          {
            id: 'i',
            category_id: 'c',
            currently_borrowed: 3,
            borrowed: 3,
            version: 0,
            active: false,
            specifications: { model_no: 'MX-10' },
          },
        ],
      });
    const result = await inventoryRead('items');
    assert.equal(result.items[0].currentlyBorrowed, 3);
    assert.equal(result.items[0].categoryId, 'c');
    assert.equal(result.items[0].version, 0);
    assert.equal(result.items[0].active, false);
    assert.deepEqual(result.items[0].specifications, { model_no: 'MX-10' });
  } finally {
    globalThis.fetch = original;
  }
});
