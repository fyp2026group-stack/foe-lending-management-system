export const officerViews = [
  'dashboard',
  'handovers',
  'returns',
  'inspections',
  'inventory',
  'stock',
  'imports',
  'requests',
  'borrowed',
  'activity',
] as const;
export type OfficerView = (typeof officerViews)[number];
export const officerLabels: Record<OfficerView, string> = {
  dashboard: 'Operations Dashboard',
  handovers: 'Equipment Handovers',
  returns: 'Receive Returns',
  inspections: 'Inspections',
  inventory: 'Inventory Catalogue',
  stock: 'Stock Operations',
  imports: 'Receipt Imports',
  requests: 'My Requests',
  borrowed: 'Borrowed Equipment',
  activity: 'Activity & History',
};
export const officerHref = (view: OfficerView) =>
  view === 'dashboard' ? '/workspace' : `/operations?view=${view}`;
export const operationalActions: Readonly<Record<string, string>> = {
  LENDING_ISSUES: 'Equipment handed over',
  LENDING_RETURNS: 'Equipment received',
  LENDING_INSPECTIONS: 'Inspection recorded',
  LENDING_MAINTENANCE: 'Maintenance recorded',
};
export function operationalEvents<T extends { action: string }>(events: T[]): T[] {
  return events.filter((event) => Object.hasOwn(operationalActions, event.action));
}
export function isDue(
  row: { dueAt: string | null; returned: number; quantity: number },
  now: number
) {
  return row.returned < row.quantity && Boolean(row.dueAt && Date.parse(row.dueAt) < now);
}

export const completedOperationsLabel = 'Completed lending operations';
export function laboratoryName(row: { labName?: string | null }) {
  return row.labName?.trim() || 'Assigned laboratory';
}
export function handoverRemarks(value: FormDataEntryValue | null): { remarks?: string } {
  if (value !== null && typeof value !== 'string') throw Error('Handover remarks must be text.');
  const remarks = (value ?? '').trim();
  if (remarks.length > 1000) throw Error('Handover remarks must be at most 1000 characters.');
  return remarks ? { remarks } : {};
}
function offsetTimestamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
/** Construct both local midnights independently, preserving timezone/DST changes. No paging on this endpoint. */
export function operationsSummaryQuery(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return (
    'operations-summary?' +
    new URLSearchParams({ from: offsetTimestamp(start), to: offsetTimestamp(end) }).toString()
  );
}
