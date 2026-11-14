import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('officer source retains reference shell dimensions, tokens and distinct compositions', () => {
  const css = readFileSync(new URL('../src/app/workspace.css', import.meta.url), 'utf8');
  for (const token of [
    '--sidebar-width:238px',
    'height:27px',
    'height:62px',
    'padding:29px 34px 60px',
    'max-width:1680px',
    '#f7f8fa',
    '#e3e7ec',
    '#861727',
    'min-height:93px',
    'padding:12px 15px',
    'officer-support',
    'grid-template-columns:minmax(0,1.3fr) minmax(0,.9fr) minmax(0,.9fr)',
    '@media(max-width:600px)',
  ])
    assert.ok(css.includes(token), token);
  const page = readFileSync(
    new URL('../src/components/technical-officer/workspace.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(page.includes('className="officer-support"'));
  assert.ok(page.includes('className="officer-quick-icon"'));
  assert.ok(page.includes('className="officer-queue-metrics"'));
  const stock = readFileSync(
    new URL('../src/components/inventory/inventory.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(stock.includes('Common stock operations'));
  assert.ok(stock.includes('Recent inventory activity'));
  assert.ok(stock.includes('aria-label="Receipt import steps"'));
});

test('officer mobile/sidebar and per-screen actions are scoped without changing student breakpoint', () => {
  const shell = readFileSync(
    new URL('../src/components/identity/session.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(shell.includes('?901:768'));
  assert.ok(shell.includes("?'sidebar':'inset'"));
  for (const group of [
    "label:'Operations'",
    "label:'Inventory'",
    "label:'My Borrowing'",
    "label:'Reference'",
  ])
    assert.ok(shell.includes(group), group);
  for (const icon of [
    'LayoutGrid',
    'PackageOpen',
    'Undo2',
    'Check',
    'Boxes',
    'ClipboardList',
    'FileText',
    'List',
    'Package',
    'Clock3',
  ])
    assert.ok(shell.includes(icon), icon);
  assert.ok(shell.includes('className="officer-nav-count"'));
  assert.ok(shell.includes("useLendingChoices<Allocation>('allocations'"));
  assert.ok(shell.includes("useLendingChoices<Loan>('expected'"));
  assert.ok(shell.includes("useLendingChoices<Loan&{inspection?:{status:string}}>('inspections'"));
  const sidebar = readFileSync(
    new URL('../src/components/ui/sidebar.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(sidebar.includes('mobileBreakpoint = 768'));
  assert.ok(sidebar.includes('useIsMobile(mobileBreakpoint)'));
  const page = readFileSync(
    new URL('../src/components/technical-officer/workspace.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(page.includes('officer-view-${current}'));
  assert.ok(page.includes('officerHref(destination)'));
  assert.ok(page.includes('officer-panel-description'));
  assert.ok(page.includes('Loading authorized records</span>'));
});
