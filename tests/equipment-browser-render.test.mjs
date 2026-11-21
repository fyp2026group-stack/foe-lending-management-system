import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the real shared component with synthetic API responses. UI primitives
// are replaced so this needs no browser, DOM package, server, or new dependency.
const require = createRequire(import.meta.url);
const fixture = { itemId: 'synthetic-item', labId: 'synthetic-lab', locationId: 'synthetic-store', item: 'Synthetic oscilloscope', lab: 'Synthetic laboratory', location: 'Synthetic shelf', category: 'Measurement', kind: 'RETURNABLE', policy: 'NONE', availableQuantity: 4, uom: 'units' };
function render({ rows = [fixture], selected = [], disabled = false, error, hydration = [], total = rows.length, knownSources = [] } = {}) {
  const buttons = [], calls = [], requests = [], sourceCalls = [];
  const primitive = name => function TestPrimitive(props) {
    if (name === 'Button') buttons.push(props);
    if (['Dialog', 'Sheet', 'PopoverContent'].includes(name) && !props.open) return null;
    const tag = name === 'Button' ? 'button' : 'div';
    return React.createElement(tag, { disabled: props.disabled, role: props.role, 'aria-label': props['aria-label'] }, props.children);
  };
  const output = ts.transpileModule(readFileSync(new URL('../src/components/lending/equipment-browser.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const localRequire = id => {
    if (id.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, name) => primitive(name) });
    if (id === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (id === './shared') return { useLending: path => { requests.push(path); return { data: error ? undefined : { items: rows, total }, error }; } };
    if (id === './browser-source-selection') return require('../src/components/lending/browser-source-selection.ts');
    if (id === './selected-sources') return { useSelectedSources: () => ({ data: { items: hydration } }) };
    if (id === './student-model') return { sourceKey: s => [s.itemId, s.labId, s.locationId].join(':'), approvalPath: () => 'No academic approval' };
    if (id === './request-options') return { quantityLimit: s => s.kind === 'RETURNABLE' ? 20 : 1000 };
    return require(id);
  };
  runInNewContext(output, { exports, require: localRequire, URLSearchParams });
  const html = renderToStaticMarkup(React.createElement(exports.EquipmentBrowser, {
    selected, knownSources, disabled, onQuantity: (s, n) => { calls.push([s.itemId, n]); sourceCalls.push([s, n]); }, onContinue: () => calls.push('continue'),
  }));
  return { html, buttons, calls, requests, sourceCalls };
}
const button = (result, label) => result.buttons.find(b => b['aria-label'] === label || b.children === label);

test('shared browser renders authorized rows and Add dispatches the actual source', () => {
  const result = render();
  assert.match(result.html, /Synthetic oscilloscope/);
  assert.match(result.html, /Synthetic laboratory/);
  assert.match(result.html, /Measurement/);
  assert.match(result.html, /1 equipment sources/);
  assert.equal(button(result, '+ Add').disabled, false);
  button(result, '+ Add').onClick();
  assert.deepEqual(result.calls, [[fixture.itemId, 1]]);
  assert.equal(result.requests[0], 'sources?limit=20&offset=0&q=');
});

test('selection hydrates outside the visible page and removal and continuation dispatch', () => {
  const result = render({ rows: [], selected: [{ ...fixture, quantity: 2 }], hydration: [fixture] });
  assert.match(result.html, /Synthetic oscilloscope/);
  assert.match(result.html, /2 total units/);
  button(result, 'Remove Synthetic oscilloscope').onClick();
  result.buttons.find(b => Array.isArray(b.children) && b.children[0] === 'Continue to request ').onClick();
  assert.deepEqual(result.calls, [[fixture.itemId, 0], 'continue']);
});

test('quantity controls enforce stock, selection cap, and read-only state', () => {
  const full = render({ selected: [{ ...fixture, quantity: 4 }] });
  assert.equal(button(full, 'Increase Synthetic oscilloscope').disabled, true);
  button(full, 'Decrease Synthetic oscilloscope').onClick();
  assert.deepEqual(full.calls, [[fixture.itemId, 3]]);
  assert.equal(button(render({ rows: [{ ...fixture, availableQuantity: 0 }] }), '+ Add').disabled, true);
  assert.equal(button(render({ selected: Array.from({ length: 20 }, (_, i) => ({ itemId: 'other-' + i, quantity: 1 })) }), '+ Add').disabled, true);
  const locked = render({ disabled: true });
  assert.equal(button(locked, '+ Add').disabled, true);
  button(locked, '+ Add').onClick();
  assert.deepEqual(locked.calls, []);
});

test('empty and failed responses render useful states without catalogue rows', () => {
  assert.match(render({ rows: [] }).html, /No equipment matches/);
  const result = render({ error: 'Synthetic access failure' });
  assert.match(result.html, /role="alert"[^>]*>Synthetic access failure/);
  assert.doesNotMatch(result.html, /Synthetic oscilloscope/);
});

test('same equipment on another page cannot replace selected laboratory, approval or capacity', () => {
  const other = { ...fixture, labId: 'lab-b', lab: 'Other laboratory', locationId: 'store-b', availableQuantity: 12, policy: 'HOD' };
  const selected = [{ ...fixture, quantity: 4 }];
  for (const rows of [[other], []]) {
    const result = render({ rows, selected, hydration: [other, fixture] });
    assert.match(result.html, /Synthetic laboratory \/ Synthetic shelf/);
    assert.match(result.html, /Max 4 units/);
    assert.equal(button(result, 'Increase Synthetic oscilloscope').disabled, true);
    button(result, 'Decrease Synthetic oscilloscope').onClick();
    assert.equal(result.sourceCalls[0][0].labId, fixture.labId);
    assert.equal(result.sourceCalls[0][0].locationId, fixture.locationId);
    if (rows.length) assert.equal(button(result, 'Selected elsewhere').disabled, true);
  }
  const missing = render({ rows: [other], selected, hydration: [other] });
  assert.match(missing.html, /Selected source unavailable/);
  assert.equal(button(missing, 'Increase Synthetic oscilloscope'), undefined);
});

test('equipment-only request summary uses assigned source before current-page alternatives', () => {
  const assigned = { ...fixture, labId: 'assigned-lab', lab: 'Assigned laboratory', locationId: 'assigned-store', availableQuantity: 2 };
  const result = render({ rows: [fixture], selected: [{ itemId: fixture.itemId, quantity: 2 }], knownSources: [assigned], hydration: [fixture, assigned] });
  assert.match(result.html, /Assigned laboratory/);
  assert.match(result.html, /Max 2 units/);
  assert.equal(button(result, 'Increase Synthetic oscilloscope').disabled, true);
  button(result, 'Decrease Synthetic oscilloscope').onClick();
  assert.equal(result.sourceCalls[0][0].labId, assigned.labId);
  assert.equal(button(result, 'Selected elsewhere').disabled, true);
});
