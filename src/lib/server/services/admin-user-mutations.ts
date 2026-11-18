import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

const validRoles = new Set(['ADMIN','STUDENT','LECTURER','TECHNICAL_OFFICER']);
function ids(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 100 ||
      value.some(v => !isUuid(v)) || new Set(value).size !== value.length) return null;
  return value as string[];
}
function roles(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4 ||
      value.some(v => typeof v !== 'string' || !validRoles.has(v)) ||
      new Set(value).size !== value.length) return null;
  return value as string[];
}
const bounded = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

export async function admitAdminHash(token: string, csrf: string) {
  return nativeOrmTransaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    const auth = await authorizePrismaSession(tx, token, {
      csrf, requiredRoles: ['ADMIN'],
    });
    if (isAuthFailure(auth)) return auth;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731945) IS NULL AS locked`;
    const keys = [
      'hash-admin:' + auth.userId,
      'hash-session:' + createHash('sha256').update(token).digest('hex'),
    ];
    const now = new Date(), expiry = new Date(now.getTime() + 60_000);
    for (const key of keys) {
      const found = await tx.login_limits.findUnique({ where: { key } });
      if (!found) {
        await tx.login_limits.createMany({
          data: [{ key, attempts: 1, until_at: expiry }],
        });
      } else if (found.until_at <= now) {
        await tx.login_limits.updateMany({
          where: { key }, data: { attempts: 1, until_at: expiry },
        });
      } else {
        if (found.attempts >= 5) return { status: 429, code: 'HASH_LIMITED' };
        await tx.login_limits.updateMany({
          where: { key }, data: { attempts: { increment: 1 } },
        });
      }
    }
    return { admitted: true };
  });
}

/** Native admin user create and edit, with immutable membership history. */
export async function changeAdminUser(
  token: string, csrf: string, userId: string | null,
  body: Record<string, unknown>,
) {
  const creating = userId === null;
  const valid = creating
    ? ['email','displayName','passwordHash','roles','batchId','batchIds','registrationNumber','laboratoryIds']
    : ['displayName','registrationNumber','roles','disabled','laboratoryIds','batchIds'];
  if (Object.keys(body).some(k => !valid.includes(k)))
    return { status: 422, code: 'UNSUPPORTED_FIELD' };
  const assignedRoles = roles(body.roles);
  const staffLabs = ids(body.laboratoryIds ?? []);
  const batchList = body.batchIds === undefined
    ? (creating && body.batchId ? ids([body.batchId]) : undefined)
    : ids(body.batchIds);
  if (!assignedRoles || !staffLabs ||
      batchList === null ||
      (creating && (!bounded(body.email, 254) ||
        !/^\S+@\S+\.\S+$/.test(String(body.email)) ||
        !bounded(body.displayName, 120) ||
        typeof body.passwordHash !== 'string' ||
        !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(body.passwordHash))) ||
      (!creating && (!isUuid(userId) || typeof body.disabled !== 'boolean')) ||
      (body.displayName !== undefined && !bounded(body.displayName, 120)) ||
      (body.registrationNumber !== undefined && !bounded(body.registrationNumber, 80)) ||
      (staffLabs.length > 0 &&
       !assignedRoles.some(r => r === 'LECTURER' || r === 'TECHNICAL_OFFICER')))
    return { status: 422, code: 'INVALID' };
  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731942) IS NULL AS locked`;
      const auth = await authorizePrismaSession(tx, token, {
        csrf, requiredRoles: ['ADMIN'],
      });
      if (isAuthFailure(auth)) return auth;
      if (!creating && userId === auth.userId)
        return { status: 403, code: 'SELF_CHANGE' };
      const current = creating ? null : await tx.users.findUnique({
        where: { id: userId! }, select: {
          id: true, email: true, batch_id: true, display_name: true,
          registration_number: true, disabled: true,
        },
      });
      if (!creating && !current) return { status: 404, code: 'NOT_FOUND' };

      const finalBatches = batchList ?? (await tx.user_batch_memberships.findMany({
        where: { user_id: userId!, ended_at: null },
        select: { batch_id: true },
      })).map(x => x.batch_id);
      if (assignedRoles.includes('STUDENT') &&
        (!finalBatches.length ||
         !(creating ? bounded(body.registrationNumber, 80) :
           bounded(body.registrationNumber ?? current?.registration_number, 80))))
        return { status: 422, code: 'STUDENT_PROFILE_REQUIRED' };
      const activeBatches = await tx.batches.findMany({
        where: { id: { in: finalBatches }, active: true },
        select: { id: true },
      });
      if (activeBatches.length !== finalBatches.length)
        return { status: 422, code: 'INVALID_BATCHES' };
      if (staffLabs.length) {
        const activeLabs = await tx.laboratories.findMany({
          where: { id: { in: staffLabs }, active: true },
          select: { id: true },
        });
        if (activeLabs.length !== staffLabs.length)
          return { status: 422, code: 'INVALID_LABS' };
      }

      const id = userId ?? randomUUID();
      const oldBatches = creating ? [] : (await tx.user_batch_memberships.findMany({
        where: { user_id: id, ended_at: null },
        select: { batch_id: true },
      })).map(x => x.batch_id);
      const nextName = body.displayName === undefined
        ? current!.display_name : String(body.displayName).trim();
      const nextRegistration = body.registrationNumber === undefined
        ? current?.registration_number ?? null : String(body.registrationNumber).trim();

      if (creating) {
        await tx.users.create({
          data: {
            id, email: String(body.email).trim().toLowerCase(),
            display_name: nextName,
            password_hash: String(body.passwordHash),
            batch_id: finalBatches[0] ?? null,
            registration_number: nextRegistration,
          },
          select: { id: true },
        });
      } else {
        await tx.users.updateMany({
          where: { id },
          data: {
            display_name: nextName,
            registration_number: nextRegistration,
            disabled: body.disabled as boolean,
            batch_id: finalBatches[0] ?? null,
          },
        });
        await tx.user_roles.deleteMany({ where: { user_id: id } });
        await tx.staff_labs.deleteMany({ where: { user_id: id } });
      }
      await tx.user_roles.createMany({
        data: assignedRoles.map(role => ({ user_id: id, role })),
      });
      if (staffLabs.length) {
        await tx.staff_labs.createMany({
          data: staffLabs.map(labId => ({ user_id: id, laboratory_id: labId })),
        });
      }
      const removed = oldBatches.filter(b => !finalBatches.includes(b));
      const added = finalBatches.filter(b => !oldBatches.includes(b));
      if (removed.length) {
        await tx.user_batch_memberships.updateMany({
          where: {
            user_id: id, batch_id: { in: removed }, ended_at: null,
          },
          data: { ended_at: new Date() },
        });
      }
      if (added.length) {
        await tx.user_batch_memberships.createMany({
          data: added.map(batchId => ({
            user_id: id, batch_id: batchId, changed_by: auth.userId,
          })),
        });
      }
      if (!creating) {
        await tx.sessions.updateMany({
          where: { user_id: id, revoked: false }, data: { revoked: true },
        });
      }
      const result = {
        id, displayName: nextName, roles: assignedRoles,
        laboratoryIds: staffLabs, batchIds: finalBatches,
      };
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: auth.userId, target_id: id,
          action: creating ? 'CREATE_USER' : 'PATCH_USER',
          details: {
            roles: assignedRoles, batchIds: finalBatches,
            laboratories: staffLabs, disabled: body.disabled ?? false,
          },
        }],
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return { status: 409, code: 'CONFLICT' };
      if (error.code === 'P2003') return { status: 422, code: 'INVALID' };
    }
    throw error;
  }
}
