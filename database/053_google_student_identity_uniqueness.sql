BEGIN;
-- A verified Google account is not evidence of university mailbox ownership.
-- Keep optional self-reported university email distinct from verified Google email.
ALTER TABLE lab.student_profiles RENAME COLUMN university_email TO google_email;
ALTER TABLE lab.student_profiles ADD COLUMN university_email text;
ALTER TABLE lab.student_profiles ADD CONSTRAINT university_email_format CHECK (
  university_email IS NULL OR
  (length(university_email) <= 254 AND university_email=lower(university_email)
   AND university_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
);
-- Database-enforced unique identifiers irrespective of case and surrounding whitespace.
CREATE UNIQUE INDEX student_index_number_canonical_unique ON lab.student_profiles (upper(btrim(index_number)));
CREATE UNIQUE INDEX all_user_registration_number_canonical_unique ON lab.users (upper(btrim(registration_number)))
  WHERE registration_number IS NOT NULL;
CREATE OR REPLACE FUNCTION lab.google_student_register(subject_input text,email_input text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE id_value uuid; batch_value uuid; token_value text; csrf_value text;
BEGIN
  PERFORM pg_advisory_xact_lock(731942);
  IF subject_input IS NULL OR length(subject_input) NOT BETWEEN 10 AND 255
    OR email_input IS NULL OR email_input<>lower(email_input)
    OR length(email_input) NOT BETWEEN 6 AND 254
    OR jsonb_typeof(p) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k
      WHERE k NOT IN ('indexNumber','registrationNumber','batchId','fullName','department','phone','googleEmail','universityEmail','personalEmail'))
    OR length(trim(coalesce(p->>'indexNumber',''))) NOT BETWEEN 3 AND 40
    OR length(trim(coalesce(p->>'registrationNumber',''))) NOT BETWEEN 3 AND 80
    OR length(trim(coalesce(p->>'fullName',''))) NOT BETWEEN 3 AND 120
    OR length(trim(coalesce(p->>'department',''))) NOT BETWEEN 2 AND 120
    OR length(trim(coalesce(p->>'phone',''))) NOT BETWEEN 7 AND 25
    OR (p->>'googleEmail') IS DISTINCT FROM email_input
    OR (coalesce(p->>'universityEmail','')<>'' AND
      (length(p->>'universityEmail')>254 OR
       lower(trim(p->>'universityEmail')) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    OR (coalesce(p->>'personalEmail','')<>'' AND (
      length(p->>'personalEmail')>254 OR p->>'personalEmail' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
  THEN RETURN '{"status":422,"code":"INVALID_STUDENT_PROFILE"}'::jsonb; END IF;
  BEGIN
    batch_value:=(p->>'batchId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{"status":422,"code":"INVALID_BATCH"}'::jsonb;
  END;
  IF NOT EXISTS(SELECT 1 FROM lab.batches WHERE id=batch_value AND active)
    THEN RETURN '{"status":422,"code":"INVALID_BATCH"}'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM lab.google_student_identities WHERE google_subject=subject_input)
    THEN RETURN '{"status":409,"code":"ALREADY_REGISTERED"}'::jsonb; END IF;
  -- Do not automatically connect an existing staff/student identity by matching email.
  IF EXISTS(SELECT 1 FROM lab.users WHERE email=email_input)
    THEN RETURN '{"status":409,"code":"EXISTING_ACCOUNT_CONTACT_ADMIN"}'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM lab.users WHERE upper(btrim(registration_number))=upper(btrim(p->>'registrationNumber')))
     OR EXISTS(SELECT 1 FROM lab.student_profiles WHERE upper(btrim(index_number))=upper(btrim(p->>'indexNumber')))
    THEN RETURN '{"status":409,"code":"DUPLICATE_STUDENT_RECORD"}'::jsonb; END IF;
  id_value:=gen_random_uuid();
  INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number)
    VALUES(id_value,email_input,trim(p->>'fullName'),'google-oauth-only',batch_value,upper(btrim(p->>'registrationNumber')));
  INSERT INTO lab.user_roles(user_id,role) VALUES(id_value,'STUDENT');
  INSERT INTO lab.user_batch_memberships(user_id,batch_id,changed_by) VALUES(id_value,batch_value,id_value);
  INSERT INTO lab.google_student_identities(google_subject,user_id,verified_email)
    VALUES(subject_input,id_value,email_input);
  INSERT INTO lab.student_profiles(user_id,index_number,department,phone,google_email,university_email,personal_email)
    VALUES(id_value,upper(btrim(p->>'indexNumber')),trim(p->>'department'),trim(p->>'phone'),
      email_input,nullif(lower(trim(coalesce(p->>'universityEmail',''))),''),
      nullif(lower(trim(coalesce(p->>'personalEmail',''))),''));
  token_value:=encode(public.gen_random_bytes(32),'hex');
  csrf_value:=encode(public.digest(token_value||':csrf','sha256'),'hex');
  INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at)
    VALUES(encode(public.digest(token_value,'sha256'),'hex'),id_value,
      encode(public.digest(csrf_value,'sha256'),'hex'),clock_timestamp()+interval '8 hours',false,clock_timestamp());
  INSERT INTO lab.audit(id,actor_id,action,target_id,details)
    VALUES(gen_random_uuid(),id_value,'GOOGLE_STUDENT_REGISTERED',id_value,
      jsonb_build_object('batchId',batch_value,'profileComplete',true));
  RETURN jsonb_build_object('token',token_value,'csrfToken',csrf_value);
EXCEPTION
  WHEN unique_violation THEN
    RETURN '{"status":409,"code":"DUPLICATE_STUDENT_RECORD"}'::jsonb;
END $$;
ALTER FUNCTION lab.google_student_register(text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.google_student_register(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.google_student_register(text,text,jsonb) TO lab_runtime;
COMMIT;
