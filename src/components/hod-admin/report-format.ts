/** Report presentation is explicit: never infer a timestamp from a substring such as "at". */
const timestamps = new Set([
  'date', 'issuedAt', 'dueAt', 'createdAt', 'updatedAt',
  'returnedAt', 'occurredAt', 'collectAt', 'returnAt',
]);
export function formatReportValue(field: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (timestamps.has(field)) {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('en-GB') : '—';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replaceAll('_', ' ');
}
