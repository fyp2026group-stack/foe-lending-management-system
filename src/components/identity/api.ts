import { personLabel } from '../display-labels';
export const roleLabels = {
  STUDENT: 'Student',
  LECTURER: 'Lecturer',
  TECHNICAL_OFFICER: 'Technical officer',
  ADMIN: 'Administrator',
} as const;
export type Role = keyof typeof roleLabels;
export const displayRoles = (roles: string[]) =>
  roles.map((role) => roleLabels[role as Role] ?? role).join(', ');
export type IdentityUser = {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  disabled?: boolean;
};
export type Session = { user: IdentityUser; csrfToken: string };
export type Resource = 'users' | 'batches' | 'laboratories';
export type RecordRow = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  roles?: string[];
  disabled?: boolean;
  active?: boolean;
  batchId?: string | null;
  batchIds?: string[];
  batchHistory?: unknown[];
  registrationNumber?: string | null;
  laboratoryIds?: string[];
  labIds?: string[];
  membershipCount?: number;
  staffCount?: number;
  locationCount?: number;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; csrfToken?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.csrfToken ? { 'X-CSRF-Token': options.csrfToken } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    // An expired authenticated session is a navigation event, not a full-page
    // error state. A login failure must remain on the login form instead.
    if (response.status === 401 && path !== '/api/auth/login' && typeof window !== 'undefined') {
      if (window.location.pathname !== '/login') window.location.replace('/login');
    }
    const fallback =
      response.status === 401
        ? 'Your session has ended. Sign in again.'
        : response.status === 403
          ? 'You do not have permission for this action.'
          : 'The request could not be completed. Please review your input and try again.';
    throw new ApiError(response.status, fallback);
  }
  return data as T;
}
export function readSession(value: Session): Session {
  if (
    !value?.user?.id ||
    !Array.isArray(value.user.roles) ||
    typeof value.csrfToken !== 'string' ||
    !value.csrfToken
  )
    throw new Error('The session response is incomplete. Please sign in again.');
  return { ...value, user: { ...value.user, displayName: personLabel(value.user) } };
}
export function readRows(value: unknown): RecordRow[] {
  const rows =
    value && typeof value === 'object' ? (value as { items?: unknown }).items : undefined;
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.id !== 'string'))
    throw new Error('The server returned an unsupported list format.');
  return rows;
}
