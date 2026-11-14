import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { studentEmptyContent } from '../src/components/lending/student-empty-model.ts';

// Transpile the actual local UI composition for Node SSR, retaining its real React,
// Radix, Lucide, shadcn and TanStack dependencies rather than replacing components.
const cache = new Map();
function moduleUrl(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const source = readFileSync(filename, 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  output = output.replace(/from\s*['"]([^'"]+)['"]/g, (match, specifier) => {
    let target;
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/')
        ? resolve('src', specifier.slice(2))
        : resolve(dirname(filename), specifier);
      const local = ['', '.tsx', '.ts']
        .map((extension) => base + extension)
        .find((path) => existsSync(path));
      assert.ok(local, 'Local module exists: ' + specifier);
      target = moduleUrl(local);
    } else if (specifier === 'next/link') {
      const entry = import.meta.resolve('next/link.js');
      target =
        'data:text/javascript;base64,' +
        Buffer.from(
          'import Link from ' + JSON.stringify(entry) + ';export default Link.default??Link;'
        ).toString('base64');
    } else target = import.meta.resolve(specifier);
    return 'from ' + JSON.stringify(target);
  });
  const url = 'data:text/javascript;base64,' + Buffer.from(output).toString('base64');
  cache.set(filename, url);
  return url;
}
const { StudentEmptyState } = await import(
  moduleUrl(resolve('src/components/lending/student-empty-state.tsx'))
);
const { StudentDataTable } = await import(
  moduleUrl(resolve('src/components/lending/student-data-table.tsx'))
);
const columns = [{ id: 'name', title: 'Equipment', value: (row) => row.name }];
const recordId = (row) => row.id;

test('every student first-use empty state renders a labelled neutral panel with a useful navigation action', () => {
  for (const kind of [
    'equipment',
    'requests',
    'drafts',
    'borrowed',
    'history',
    'attention',
    'activity',
    'policies',
    'detail',
    'decisions',
    'comments',
    'unavailable',
    'equipmentDetail',
  ]) {
    const content = studentEmptyContent(kind);
    const html = renderToStaticMarkup(createElement(StudentEmptyState, { kind }));
    assert.match(html, /role="status"/);
    assert.match(html, /aria-labelledby=/);
    assert.ok(html.includes(content.title));
    assert.ok(html.includes(content.href));
    assert.ok(html.includes(content.action));
    assert.doesNotMatch(html, /<table|<tbody|\bpagination\b/);
  }
});
test('filtered-zero table renders Reset filters without table headers, result bars or pagination', () => {
  const html = renderToStaticMarkup(
    createElement(StudentDataTable, {
      data: [{ id: 'one', name: 'Camera' }],
      columns,
      recordId,
      query: 'microscope',
      label: 'Equipment',
      emptyKind: 'equipment',
      onReset: () => {},
    })
  );
  assert.match(html, /No matching results/);
  assert.match(html, /<button[^>]*>Reset filters<\/button>/);
  assert.doesNotMatch(
    html,
    /<table|<thead|<tbody|student-result-bar|\bpagination\b|Rows per page|Page 1/
  );
});
test('domain filters yielding no supplied rows still use filtered emptiness and reset action', () => {
  const html = renderToStaticMarkup(
    createElement(StudentDataTable, {
      data: [],
      columns,
      recordId,
      label: 'Requests',
      filtered: true,
      onReset: () => {},
    })
  );
  assert.match(html, /No matching results/);
  assert.match(html, /Reset filters/);
  assert.doesNotMatch(html, /<table|\bpagination\b/);
});
test('true zero-row table uses its own context and never exposes meaningless paging', () => {
  const html = renderToStaticMarkup(
    createElement(StudentDataTable, {
      data: [],
      columns,
      recordId,
      label: 'Borrowing history',
      emptyKind: 'history',
    })
  );
  assert.match(html, /No borrowing history yet/);
  assert.match(html, /Browse equipment/);
  assert.doesNotMatch(
    html,
    /Reset filters|<table|<thead|\bpagination\b|Rows per page|matching records/
  );
});
test('nonempty tables retain real headers and pagination', () => {
  const html = renderToStaticMarkup(
    createElement(StudentDataTable, {
      data: [{ id: 'one', name: 'Camera' }],
      columns,
      recordId,
      label: 'Equipment',
    })
  );
  assert.match(html, /<table/);
  assert.match(html, /Camera/);
  assert.match(html, /\bpagination\b/);
  assert.match(html, /Rows per page/);
  assert.doesNotMatch(html, /No matching results|No borrowing requests yet/);
});

const { StudentGuidance, StudentReminders, StudentQuickActions } = await import(
  moduleUrl(resolve('src/components/lending/student-guidance.tsx'))
);
test('dashboard reminders match the four-bullet guidance panel without policy-record leakage', () => {
  const html = renderToStaticMarkup(
    createElement(StudentReminders, {
      policies: [
        { name: 'Equipment 5c362a93-ea83-4f7f-97dc-12f29c9c0f07', policy: 'UNCONFIGURED' },
        { name: 'Synthetic Multimeter' },
      ],
    })
  );
  assert.match(html, /Policies and reminders/);
  assert.equal((html.match(/<li>/g) ?? []).length, 4);
  assert.match(html, /authorized academic work/);
  assert.match(html, /confirmation of readiness/);
  assert.match(html, /expected return date/);
  assert.match(html, /laboratory staff/);
  assert.match(html, /View borrowing guidance/);
  assert.doesNotMatch(html, /UNCONFIGURED|Synthetic|5c362a93|<table/);
  const dashboard = readFileSync(resolve('src/components/lending/student-workspace.tsx'), 'utf8');
  assert.doesNotMatch(dashboard, /useLendingChoices<Policy>|policies.data|action.replaceAll/);
});
test('student policies route uses the prototype Help hierarchy and six-step workflow without administration data', () => {
  const html = renderToStaticMarkup(createElement(StudentGuidance));
  assert.match(html, /Help &amp; borrowing guidance/);
  assert.match(html, /Understand the equipment request and return process/);
  assert.match(html, /How borrowing works/);
  assert.equal((html.match(/<ol/g) ?? []).length, 1);
  assert.equal((html.match(/<li>/g) ?? []).length, 6);
  assert.match(html, /eligible lecturer/);
  assert.match(html, /inspection clearance/);
  assert.match(html, /Item approval requirements appear/);
  assert.doesNotMatch(html, /UNCONFIGURED|Synthetic|<table|Rows per page/);
  const route = readFileSync(resolve('src/components/lending/workflow.tsx'), 'utf8');
  assert.match(route, /if\(student&&view==='policies'\)return <StudentGuidance\/>/);
});
test('prototype quick actions render four descriptive icon tiles with the borrowed-items destination', () => {
  const html = renderToStaticMarkup(createElement(StudentQuickActions));
  assert.equal((html.match(/class="student-action-tile"/g) ?? []).length, 4);
  assert.equal((html.match(/<small/g) ?? []).length, 4);
  for (const title of ['Browse equipment', 'Start request', 'My requests', 'Borrowed items'])
    assert.ok(html.includes(title));
  assert.match(html, /See equipment you currently hold/);
  assert.match(html, /href="\/borrowing\?view=loans"/);
  assert.equal((html.match(/student-tile-arrow/g) ?? []).length, 4);
});
