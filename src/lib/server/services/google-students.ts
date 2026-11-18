import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import type { GoogleIdentity } from '../google-oauth';
import { isUuid } from './uuid';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const bounded = (value: unknown, min: number, max: number) =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const session = (userId: string) => {
  const token = randomBytes(32).toString('hex');
  const csrfToken = digest(token + ':csrf');
  return {
    token, csrfToken,
    row: {
      token_hash: digest(token),
      user_id: userId,
      csrf_hash: digest(csrfToken),
      expires_at: new Date(Date.now() + 8 * 3600_000),
      revoked: false,
    },
  };
};

export async function googleBatchOptions() {
  return nativeOrmTransaction(async tx => {
    const batches = await tx.batches.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { batches };
  });
}

/** Google JWT signature/issuer/audience/nonce verified in google-oauth.ts before this call. */
export async function googleSignIn(identity: GoogleIdentity) {
  if (!bounded(identity.sub, 10, 255) || !validEmail(identity.email))
    return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    const account = await tx.google_student_identities.findUnique({
      where: { google_subject: identity.sub },
      select: {
        verified_email: true,
        users: {
          select: { id: true, disabled: true, user_roles: { select: { role: true } } },
        },
      },
    });
    if (!account || account.verified_email !== identity.email)
      return { status: 404, code: 'PROFILE_REQUIRED' };
    if (account.users.disabled ||
      !account.users.user_roles.some(item => item.role === 'STUDENT'))
      return { status: 403, code: 'ACCOUNT_DISABLED' };
    const created = session(account.users.id);
    await tx.sessions.createMany({ data: [created.row] });
    await tx.audit.createMany({
      data: [{ id: randomUUID(), actor_id: account.users.id, action: 'GOOGLE_LOGIN',
        target_id: account.users.id }],
    });
    return { token: created.token, csrfToken: created.csrfToken };
  });
}

const fields = new Set([
  'indexNumber', 'registrationNumber', 'batchId', 'fullName',
  'department', 'phone', 'googleEmail', 'universityEmail', 'personalEmail',
]);
export async function googleRegister(identity: GoogleIdentity, profile: unknown) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile))
    return { status: 422, code: 'INVALID_STUDENT_PROFILE' };
  const data = profile as Record<string, unknown>;
  const optional = (key: string) => data[key] === undefined || data[key] === '' ||
    (typeof data[key] === 'string' && validEmail(String(data[key]).trim().toLowerCase()));
  if (Object.keys(data).some(key => !fields.has(key)) ||
      !bounded(identity.sub, 10, 255) || !validEmail(identity.email) ||
      identity.email !== identity.email.toLowerCase() ||
      !bounded(data.indexNumber, 3, 40) ||
      !bounded(data.registrationNumber, 3, 80) ||
      !bounded(data.fullName, 3, 120) ||
      !bounded(data.department, 2, 120) ||
      !bounded(data.phone, 7, 25) ||
      data.googleEmail !== identity.email ||
      !optional('universityEmail') || !optional('personalEmail')) {
    return { status: 422, code: 'INVALID_STUDENT_PROFILE' };
  }
  if (!isUuid(data.batchId)) return { status: 422, code: 'INVALID_BATCH' };
  const registration = String(data.registrationNumber).trim().toUpperCase();
  const index = String(data.indexNumber).trim().toUpperCase();
  try {
    return await nativeOrmTransaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731942) IS NULL AS locked`;
      const batch = await tx.batches.findFirst({
        where: { id: data.batchId as string, active: true },
        select: { id: true },
      });
      if (!batch) return { status: 422, code: 'INVALID_BATCH' };
      if (await tx.google_student_identities.findUnique({
        where: { google_subject: identity.sub }, select: { user_id: true },
      })) return { status: 409, code: 'ALREADY_REGISTERED' };
      if (await tx.users.findUnique({
        where: { email: identity.email }, select: { id: true },
      })) return { status: 409, code: 'EXISTING_ACCOUNT_CONTACT_ADMIN' };
      const duplicateRegistration = await tx.users.findMany({
        where: { registration_number: { equals: registration, mode: 'insensitive' } },
        select: { id: true }, take: 1,
      });
      const duplicateIndex = await tx.student_profiles.findMany({
        where: { index_number: { equals: index, mode: 'insensitive' } },
        select: { user_id: true }, take: 1,
      });
      if (duplicateRegistration.length || duplicateIndex.length)
        return { status: 409, code: 'DUPLICATE_STUDENT_RECORD' };
      const id = randomUUID();
      await tx.users.create({
        data: {
          id, email: identity.email, display_name: String(data.fullName).trim(),
          password_hash: 'google-oauth-only',
          batch_id: batch.id, registration_number: registration,
        }, select: { id: true },
      });
      await tx.user_roles.createMany({ data: [{ user_id: id, role: 'STUDENT' }] });
      await tx.user_batch_memberships.createMany({
        data: [{ user_id: id, batch_id: batch.id, changed_by: id }],
      });
      await tx.google_student_identities.createMany({
        data: [{ google_subject: identity.sub, user_id: id, verified_email: identity.email }],
      });
      await tx.student_profiles.createMany({
        data: [{
          user_id: id, index_number: index,
          department: String(data.department).trim(),
          phone: String(data.phone).trim(),
          google_email: identity.email,
          university_email: String(data.universityEmail ?? '').trim().toLowerCase() || null,
          personal_email: String(data.personalEmail ?? '').trim().toLowerCase() || null,
        }],
      });
      const created = session(id);
      await tx.sessions.createMany({ data: [created.row] });
      await tx.audit.createMany({
        data: [{
          id: randomUUID(), actor_id: id, target_id: id,
          action: 'GOOGLE_STUDENT_REGISTERED',
          details: { batchId: batch.id, profileComplete: true },
        }],
      });
      return { token: created.token, csrfToken: created.csrfToken };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') return { status: 409, code: 'DUPLICATE_STUDENT_RECORD' };
    throw error;
  }
}
