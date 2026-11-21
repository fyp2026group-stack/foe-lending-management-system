import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

/** HOD-only user directory. Password hashes and session secrets are never read. */
export async function readAdminUsers(token: string) {
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token, { requiredRoles: ['ADMIN'] });
    if (isAuthFailure(auth)) return auth;
    const users = await tx.users.findMany({
      select: {
        id: true, email: true, display_name: true, disabled: true,
        batch_id: true, registration_number: true,
        user_roles: { select: { role: true }, orderBy: { role: 'asc' } },
        staff_labs: { select: { laboratory_id: true }, orderBy: { laboratory_id: 'asc' } },
        user_batch_memberships_user_batch_memberships_user_idTousers: {
          select: { batch_id: true, started_at: true, ended_at: true },
          orderBy: [{ started_at: 'asc' }, { batch_id: 'asc' }],
        },
      },
      orderBy: [{ display_name: 'asc' }, { id: 'asc' }],
    });
    return {
      items: users.map(user => {
        const history = user.user_batch_memberships_user_batch_memberships_user_idTousers;
        return {
          id: user.id, email: user.email, displayName: user.display_name,
          disabled: user.disabled, batchId: user.batch_id,
          registrationNumber: user.registration_number,
          roles: user.user_roles.map(x => x.role),
          laboratoryIds: user.staff_labs.map(x => x.laboratory_id),
          batchIds: history.filter(x => x.ended_at === null).map(x => x.batch_id).sort(),
          batchHistory: history.map(x => ({
            batchId: x.batch_id, startedAt: x.started_at, endedAt: x.ended_at,
          })),
        };
      }),
    };
  });
}
