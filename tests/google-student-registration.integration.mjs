import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';

test('Google enrollment creates STUDENT only, verifies subject binding and prevents replay', async () => {
  const db = new pg.Client({connectionString:configuration(process.env).database});
  await db.connect();
  try {
    await db.query('BEGIN');
    const batch=randomUUID();
    await db.query('INSERT INTO lab.batches(id,name) VALUES($1,$2)',[batch,'OAuth synthetic '+batch]);
    await db.query('SET LOCAL ROLE lab_runtime');
    const subject='synthetic-sub-'+randomUUID(),email='oauth-'+randomUUID()+'@example.invalid';
    const profile={indexNumber:'IDX-'+randomUUID(),registrationNumber:'REG-'+randomUUID(),
      fullName:'Synthetic OAuth Student',batchId:batch,department:'Computer Engineering',
      phone:'+94771234567',googleEmail:email,universityEmail:'student@university.example',personalEmail:''};
    const call=async(sql,args)=>(await db.query(sql,args)).rows[0].result;
    assert.equal((await call('SELECT lab.google_student_login($1,$2) result',[subject,email])).code,'PROFILE_REQUIRED');
    const created=await call('SELECT lab.google_student_register($1,$2,$3) result',[subject,email,profile]);
    assert.ok(created.token,JSON.stringify(created));
    assert.equal((await call('SELECT lab.google_student_register($1,$2,$3) result',[subject,email,profile])).code,'ALREADY_REGISTERED');
    assert.ok((await call('SELECT lab.google_student_login($1,$2) result',[subject,email])).token);
    assert.equal((await call('SELECT lab.google_student_login($1,$2) result',[subject,'wrong@example.invalid'])).code,'PROFILE_REQUIRED');
    await db.query('RESET ROLE');
    const row=(await db.query('SELECT user_id FROM lab.google_student_identities WHERE google_subject=$1',[subject])).rows[0];
    assert.deepEqual((await db.query('SELECT role FROM lab.user_roles WHERE user_id=$1',[row.user_id])).rows.map(r=>r.role),['STUDENT']);
    const stored=(await db.query('SELECT index_number,department FROM lab.student_profiles WHERE user_id=$1',[row.user_id])).rows[0];
    assert.equal(stored.index_number,profile.indexNumber.toUpperCase());
    assert.equal(stored.department,profile.department);
    // A second Google account cannot claim a case-variant of the same student ID.
    const sameIndex={...profile,indexNumber:profile.indexNumber.toLowerCase(),registrationNumber:'REG-'+randomUUID(),googleEmail:'another-'+randomUUID()+'@gmail.com'};
    assert.equal((await call('SELECT lab.google_student_register($1,$2,$3) result',[
      'synthetic-sub-'+randomUUID(),sameIndex.googleEmail,sameIndex])).code,'DUPLICATE_STUDENT_RECORD');
    const sameRegistration={...profile,indexNumber:'IDX-'+randomUUID(),registrationNumber:profile.registrationNumber.toLowerCase(),googleEmail:'third-'+randomUUID()+'@gmail.com'};
    assert.equal((await call('SELECT lab.google_student_register($1,$2,$3) result',[
      'synthetic-sub-'+randomUUID(),sameRegistration.googleEmail,sameRegistration])).code,'DUPLICATE_STUDENT_RECORD');
  } finally { await db.query('ROLLBACK');await db.end(); }
});
