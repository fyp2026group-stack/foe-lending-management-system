import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createConfirmationGate } from '../src/components/ui/confirmation-model.ts';

test('staging and cancelling never write; focus is restored after dialog closes', async () => {
  const gate = createConfirmationGate();
  let writes = 0,
    focus = 0;
  gate.stage(
    async () => {
      writes++;
    },
    () => focus++
  );
  assert.equal(writes, 0);
  assert.equal(gate.cancel(), true);
  assert.equal(await gate.confirm(), false);
  assert.equal(writes, 0);
  gate.restoreFocus();
  assert.equal(focus, 1);
  gate.restoreFocus();
  assert.equal(focus, 1);
});
test('explicit confirm alone writes and synchronously blocks double confirmation and closing', async () => {
  const gate = createConfirmationGate();
  let writes = 0,
    release;
  gate.stage(
    async () => {
      writes++;
      await new Promise((resolve) => (release = resolve));
    },
    () => {}
  );
  const first = gate.confirm();
  assert.equal(writes, 1);
  assert.equal(gate.pending, true);
  assert.equal(await gate.confirm(), false);
  assert.equal(gate.cancel(), false);
  assert.equal(
    gate.stage(
      async () => writes++,
      () => {}
    ),
    false
  );
  release();
  assert.equal(await first, true);
  assert.equal(gate.pending, false);
  assert.equal(await gate.confirm(), false);
  assert.equal(writes, 1);
});
test('failed confirmation remains staged for exact retry and preserves focus return', async () => {
  const gate = createConfirmationGate();
  let attempts = 0,
    focus = 0;
  gate.stage(
    async () => {
      if (++attempts === 1) throw Error('unknown result');
    },
    () => focus++
  );
  await assert.rejects(gate.confirm(), /unknown result/);
  assert.equal(gate.staged, true);
  assert.equal(gate.pending, false);
  await gate.confirm();
  gate.restoreFocus();
  assert.equal(attempts, 2);
  assert.equal(focus, 1);
});

// Exercise the actual form handlers and AlertDialog controls with deterministic hook/DOM adapters.
// Radix owns its focus trap; these checks verify our explicit close/focus and mutation wiring.
const moduleUrl = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const runtime = moduleUrl(
  `export const slots=[];let cursor=0;export function reset(){cursor=0;}export function clear(){slots.length=0;cursor=0;}export function useRef(value){const i=cursor++;return slots[i]??=( {current:value});}export function useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];}`
);
const hooks = await import(runtime);
const jsx = moduleUrl(
  `export const Fragment='fragment';export function jsx(type,props){return {type,props};}export const jsxs=jsx;`
);
const primitives = moduleUrl(
  `export const AlertDialog='AlertDialog',AlertDialogContent='AlertDialogContent',AlertDialogHeader='AlertDialogHeader',AlertDialogTitle='AlertDialogTitle',AlertDialogDescription='AlertDialogDescription',AlertDialogFooter='AlertDialogFooter',AlertDialogCancel='AlertDialogCancel',AlertDialogAction='AlertDialogAction',Button='Button';export function useReviewLock(){}`
);
const model = moduleUrl(
  ts.transpileModule(
    readFileSync(new URL('../src/components/ui/confirmation-model.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext } }
  ).outputText
);
let source = ts.transpileModule(
  readFileSync(new URL('../src/components/ui/final-confirmation.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText;
for (const [name, url] of [
  ['react/jsx-runtime', jsx],
  ['react', runtime],
  ['./alert-dialog', primitives],
  ['./review-sheet', primitives],
  ['./button', primitives],
  ['./confirmation-model', model],
])
  source = source
    .replaceAll('"' + name + '"', '"' + url + '"')
    .replaceAll("'" + name + "'", "'" + url + "'");
const { ConfirmedForm, ConfirmedAction, formSummary } = await import(moduleUrl(source));
function find(node, type) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, type);
    if (found) return found;
  }
}
const event = () => ({ preventDefault() {} });
test('actual ConfirmedForm validates first, cancels without mutation, restores submit focus, and locks pending controls', async () => {
  hooks.clear();
  let writes = 0,
    focus = 0,
    release;
  const originalFormData = globalThis.FormData;
  globalThis.FormData = class {
    constructor(form) {
      this.quantity = form.quantity;
    }
  };
  try {
    const origin = {
      isConnected: true,
      focus() {
        focus++;
      },
    };
    const form = {
      quantity: 3,
      reportValidity: () => true,
      querySelectorAll: () => [],
      elements: [],
      querySelector: () => origin,
    };
    const props = {
      title: 'Receive return',
      onConfirmed: async (data) => {
        writes++;
        assert.equal(data.quantity, 3);
        await new Promise((resolve) => (release = resolve));
      },
      children: null,
    };
    const render = () => {
      hooks.reset();
      return ConfirmedForm(props);
    };
    let tree = render();
    find(tree, 'form').props.onSubmit({
      ...event(),
      currentTarget: form,
      nativeEvent: { submitter: origin },
    });
    tree = render();
    assert.equal(find(tree, 'AlertDialog').props.open, true);
    assert.equal(writes, 0);
    find(tree, 'AlertDialogCancel').props.onClick(event());
    tree = render();
    assert.equal(find(tree, 'AlertDialog').props.open, false);
    assert.equal(writes, 0);
    find(tree, 'AlertDialogContent').props.onCloseAutoFocus(event());
    assert.equal(focus, 1);
    form.reportValidity = () => false;
    find(tree, 'form').props.onSubmit({
      ...event(),
      currentTarget: form,
      nativeEvent: { submitter: origin },
    });
    tree = render();
    assert.equal(find(tree, 'AlertDialog').props.open, false);
    form.reportValidity = () => true;
    find(tree, 'form').props.onSubmit({
      ...event(),
      currentTarget: form,
      nativeEvent: { submitter: origin },
    });
    form.quantity = 99;
    tree = render();
    find(tree, 'AlertDialogAction').props.onClick(event());
    tree = render();
    assert.equal(writes, 1);
    assert.equal(find(tree, 'AlertDialogCancel').props.disabled, true);
    assert.equal(find(tree, 'AlertDialogAction').props.disabled, true);
    find(tree, 'AlertDialogAction').props.onClick(event());
    find(tree, 'AlertDialog').props.onOpenChange(false);
    tree = render();
    assert.equal(writes, 1);
    assert.equal(find(tree, 'AlertDialog').props.open, true);
    let prevented = false;
    find(tree, 'AlertDialogContent').props.onEscapeKeyDown({
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, true);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    tree = render();
    assert.equal(find(tree, 'AlertDialog').props.open, false);
  } finally {
    globalThis.FormData = originalFormData;
  }
});

for (const title of [
  'Physical handover',
  'Receive return',
  'Inspection decision',
  'Stock receipt',
  'Adjustment proposal',
  'Asset identification',
  'Commit receipt import',
])
  test(`${title}: final dialog confirmation is the only mutation entry`, async () => {
    hooks.clear();
    let writes = 0,
      focus = 0;
    const props = {
      title,
      onConfirmed: async () => {
        writes++;
      },
      summary: [{ label: 'Quantity', value: '1' }],
      children: title,
    };
    const render = () => {
      hooks.reset();
      return ConfirmedAction(props);
    };
    let tree = render();
    find(tree, 'Button').props.onClick({
      currentTarget: {
        isConnected: true,
        focus() {
          focus++;
        },
      },
    });
    tree = render();
    assert.equal(writes, 0);
    find(tree, 'AlertDialogCancel').props.onClick(event());
    tree = render();
    find(tree, 'AlertDialogContent').props.onCloseAutoFocus(event());
    assert.equal(writes, 0);
    assert.equal(focus, 1);
    find(tree, 'Button').props.onClick({ currentTarget: { isConnected: true, focus() {} } });
    tree = render();
    find(tree, 'AlertDialogAction').props.onClick(event());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(writes, 1);
    tree = render();
    assert.equal(find(tree, 'AlertDialog').props.open, false);
  });

test('handover textarea remarks appear trimmed in the actual final confirmation summary', () => {
  const originals = [
    globalThis.HTMLInputElement,
    globalThis.HTMLSelectElement,
    globalThis.HTMLTextAreaElement,
  ];
  globalThis.HTMLInputElement = class {};
  globalThis.HTMLSelectElement = class {};
  globalThis.HTMLTextAreaElement = class {};
  try {
    const remarks = new globalThis.HTMLTextAreaElement();
    Object.assign(remarks, {
      name: 'remarks',
      type: 'textarea',
      value: '  Cable checked.  ',
      labels: [{ textContent: 'Factual handover remarks (optional)' }],
    });
    assert.deepEqual(formSummary({ querySelectorAll: () => [], elements: [remarks] }), [
      { label: 'Factual handover remarks (optional)', value: 'Cable checked.' },
    ]);
  } finally {
    [globalThis.HTMLInputElement, globalThis.HTMLSelectElement, globalThis.HTMLTextAreaElement] =
      originals;
  }
});
