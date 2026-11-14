import { api, ApiError } from '@/components/identity/api';
export type Named = {
  id: string;
  name: string;
  labId?: string;
  active?: boolean;
  version?: number;
};
export type Item = Named & {
  kind: string;
  categoryId?: string;
  uom?: string;
  available?: number;
  reserved?: number;
  borrowed?: number;
  inspection?: number;
  maintenance?: number;
  specifications?: Record<string, string>;
};
export type Stock = {
  id: string;
  itemId: string;
  labId: string;
  locationId: string;
  assetId?: string | null;
  state: string;
  quantity: number;
  version: number;
};
export type Asset = { id: string; itemId: string; serial?: string | null; state?: string };
export type Movement = {
  id: string;
  itemId?: string;
  reason?: string;
  createdAt: string;
  kind: string;
  entries?: {
    cellId: string | null;
    account: string;
    delta: number;
    locationName?: string | null;
    state?: string | null;
    assetId?: string | null;
  }[];
};
export type Adjustment = {
  id: string;
  itemId: string;
  labId: string;
  locationId: string;
  quantity: number;
  reason: string;
  proposer: string;
  state: string;
  direction: string;
};
export type Page<T> = { items: T[]; limit: number; offset: number };
export type Preview = {
  id: string;
  committed?: boolean;
  rowCount: number;
  rows: Record<string, unknown>[];
};
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        key === 'specifications' ? item : normalize(item),
      ])
    );
  return value;
}
export async function inventoryRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  return normalize(
    await api<unknown>(path.startsWith('/api/') ? path : '/api/inventory/' + path, { signal })
  ) as T;
}
export type ImportIssue = { row: number; column: string; code: string };
export class InventoryError extends ApiError {
  constructor(
    status: number,
    message: string,
    public issues: ImportIssue[] = [],
    public code?: string
  ) {
    super(status, message);
  }
}
export async function inventoryWrite<T>(
  path: string,
  body: unknown,
  csrfToken: string,
  method: 'POST' | 'PATCH' = 'POST'
): Promise<T> {
  const response = await fetch('/api/inventory/' + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const issues: ImportIssue[] = Array.isArray(data?.errors)
      ? data.errors.filter(
          (issue: ImportIssue) =>
            Number.isInteger(issue?.row) &&
            typeof issue.column === 'string' &&
            typeof issue.code === 'string'
        )
      : [];
    const code = typeof data?.code === 'string' ? data.code : undefined;
    const conflicts: Record<string, string> = {
      STALE_VERSION: 'This record changed. Refresh records and review its current version.',
      STATE_CONFLICT:
        'This change conflicts with linked stock, active records or pending requests. Review those records before trying again.',
      DUPLICATE: 'A record with these details already exists. Review existing records.',
      IDENTITY_CONFLICT:
        'The original command has different details. Reconcile its result before continuing.',
    };
    throw new InventoryError(
      response.status,
      response.status === 409
        ? (conflicts[code ?? ''] ?? 'Conflict: reload current stock and review again.')
        : response.status === 403
          ? 'Permission denied.'
          : response.status === 401
            ? 'Session ended. Sign in again.'
            : issues.length
              ? 'Server validation rejected the file. Review the row errors.'
              : response.status === 422
                ? 'The server rejected these values. Check required fields, units and active references.'
                : 'Request failed. Check history before repeating an uncertain operation.',
      issues,
      code
    );
  }
  return data as T;
}
export function commandId() {
  return crypto.randomUUID();
}
