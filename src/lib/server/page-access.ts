import 'server-only';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { transaction } from '@/lib/server/db';

type Role = 'STUDENT' | 'LECTURER' | 'TECHNICAL_OFFICER' | 'ADMIN';
type Profile = { user?: { id?: string; roles?: Role[] }; status?: number };
const PAGE_ROLES = ['STUDENT', 'LECTURER', 'TECHNICAL_OFFICER', 'ADMIN'] as const;

export async function requirePageRole(allowed: readonly Role[] = PAGE_ROLES): Promise<Profile> {
  const token = (await cookies()).get('lab_session')?.value ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) redirect('/login');
  let profile: Profile;
  try {
    profile = await transaction(async (client) =>
      (await client.query(
        "SELECT lab.identity_call($1,'','me',NULL,'{}'::jsonb) AS result",
        [token]
      )).rows[0].result as Profile
    );
  } catch {
    // A DB outage is not a permission denial; do not disclose internal data.
    throw new Error('Unable to verify the current session.');
  }
  if (profile.status === 401 || !profile.user?.id) redirect('/login');
  const roles = profile.user.roles ?? [];
  if (!roles.some((role) => allowed.includes(role))) notFound();
  return profile;
}

export function allowedBorrowingView(view: string, roles: readonly Role[]): boolean {
  if (['approvals'].includes(view))
    return roles.includes('LECTURER') || roles.includes('ADMIN');
  if (['collection', 'returns'].includes(view))
    return roles.includes('TECHNICAL_OFFICER');
  return ['requests', 'new', 'loans', 'history', 'policies'].includes(view);
}
