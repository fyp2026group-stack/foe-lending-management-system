import 'server-only';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { nativeOrmTransaction } from '@/lib/server/db';
import { authorizePrismaSession, isAuthFailure } from '@/lib/server/services/prisma-session';
import { canOpenBorrowingView } from '@/lib/role-policy';

type Role = 'STUDENT' | 'LECTURER' | 'TECHNICAL_OFFICER' | 'ADMIN';
type Profile = { user?: { id?: string; roles?: Role[] }; status?: number };
const PAGE_ROLES = ['STUDENT', 'LECTURER', 'TECHNICAL_OFFICER', 'ADMIN'] as const;

export async function requirePageRole(allowed: readonly Role[] = PAGE_ROLES): Promise<Profile> {
  const token = (await cookies()).get('lab_session')?.value ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) redirect('/login');
  let profile: Profile;
  try {
    profile = await nativeOrmTransaction(async tx => {
      const auth = await authorizePrismaSession(tx, token);
      return isAuthFailure(auth)
        ? { status: auth.status }
        : { user: { id: auth.userId, roles: auth.roles } };
    });
  } catch {
    // A DB outage is not a permission denial; do not disclose internal data.
    throw new Error('Unable to verify the current session.');
  }
  if (profile.status === 401 || !profile.user?.id) redirect('/login');
  const roles = profile.user.roles ?? [];
  if (!roles.some((role) => allowed.includes(role))) notFound();
  return profile;
}

export const allowedBorrowingView = canOpenBorrowingView;
