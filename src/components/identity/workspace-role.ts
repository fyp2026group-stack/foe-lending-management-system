import type { Role } from './api';

const priority: readonly Role[] = ['ADMIN', 'TECHNICAL_OFFICER', 'LECTURER', 'STUDENT'];
/**
 * Local preference is not an entitlement; every selected role must still appear
 * in the fresh server-authenticated session. No server permission is changed.
 */
export function selectWorkspaceRole(assigned: string[], preferred: string | null): Role {
  if (preferred && priority.includes(preferred as Role) && assigned.includes(preferred))
    return preferred as Role;
  return priority.find((role) => assigned.includes(role)) ?? 'STUDENT';
}
