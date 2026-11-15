BEGIN;
-- Google subject is the identity key. Never link an existing account by email alone.
CREATE TABLE lab.google_student_identities (
  google_subject text PRIMARY KEY CHECK(length(google_subject) BETWEEN 10 AND 255),
  user_id uuid NOT NULL UNIQUE REFERENCES lab.users(id),
  verified_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE lab.student_profiles (
  user_id uuid PRIMARY KEY REFERENCES lab.users(id),
  index_number text NOT NULL UNIQUE CHECK(length(index_number) BETWEEN 3 AND 40),
  department text NOT NULL CHECK(length(department) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK(length(phone) BETWEEN 7 AND 25),
  university_email text NOT NULL UNIQUE CHECK(university_email=lower(university_email)),
  personal_email text CHECK(personal_email IS NULL OR length(personal_email) BETWEEN 3 AND 254),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE lab.google_student_identities OWNER TO lab_identity_functions;
ALTER TABLE lab.student_profiles OWNER TO lab_identity_functions;
REVOKE ALL ON lab.google_student_identities,lab.student_profiles FROM PUBLIC,lab_runtime;

CREATE FUNCTION lab.google_student_options() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
  SELECT jsonb_build_object('batches',
    coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name),'[]'::jsonb))
  FROM lab.batches WHERE active
$$;
ALTER FUNCTION lab.google_student_options() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.google_student_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.google_student_options() TO lab_runtime;

-- Invoked by the server only AFTER validating the Google OIDC signature,
-- audience, issuer, nonce, expiry, verified hosted-domain email, state and PKCE.
CREATE FUNCTION lab.google_student_login(subject_input text,email_input text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE account record; token_value text; csrf_value text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(731942);
  SELECT u.id,u.disabled INTO account
    FROM lab.google_student_identities g JOIN lab.users u ON u.id=g.user_id
    WHERE g.google_subject=subject_input AND g.verified_email=email_input;
  IF NOT FOUND THEN RETURN '{"status":404,"code":"PROFILE_REQUIRED"}'::jsonb; END IF;
  IF account.disabled OR NOT EXISTS(
    SELECT 1 FROM lab.user_roles WHERE user_id=account.id AND role='STUDENT'
  ) THEN RETURN '{"status":403,"code":"ACCOUNT_DISABLED"}'::jsonb; END IF;
  token_value:=encode(public.gen_random_bytes(32),'hex');
  csrf_value:=encode(public.digest(token_value||':csrf','sha256'),'hex');
  INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at)
  VALUES(encode(public.digest(token_value,'sha256'),'hex'),account.id,
    encode(public.digest(csrf_value,'sha256'),'hex'),clock_timestamp()+interval '8 hours',false,clock_timestamp());
  INSERT INTO lab.audit(id,actor_id,action,target_id,details)
    VALUES(gen_random_uuid(),account.id,'GOOGLE_LOGIN',account.id,'{}');
  RETURN jsonb_build_object('token',token_value,'csrfToken',csrf_value);
END $$;
ALTER FUNCTION lab.google_student_login(text,text) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.google_student_login(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.google_student_login(text,text) TO lab_runtime;

CREATE FUNCTION lab.google_student_register(subject_input text,email_input text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE id_value uuid; batch_value uuid; token_value text; csrf_value text;
BEGIN
  PERFORM pg_advisory_xact_lock(731942);
  IF subject_input IS NULL OR length(subject_input) NOT BETWEEN 10 AND 255
    OR email_input IS NULL OR email_input<>lower(email_input)
    OR length(email_input) NOT BETWEEN 6 AND 254
    OR jsonb_typeof(p) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k
      WHERE k NOT IN ('indexNumber','registrationNumber','batchId','fullName','department','phone','universityEmail','personalEmail'))
    OR length(trim(coalesce(p->>'indexNumber',''))) NOT BETWEEN 3 AND 40
    OR length(trim(coalesce(p->>'registrationNumber',''))) NOT BETWEEN 3 AND 80
    OR length(trim(coalesce(p->>'fullName',''))) NOT BETWEEN 3 AND 120
    OR length(trim(coalesce(p->>'department',''))) NOT BETWEEN 2 AND 120
    OR length(trim(coalesce(p->>'phone',''))) NOT BETWEEN 7 AND 25
    OR (p->>'universityEmail') IS DISTINCT FROM email_input
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
  IF EXISTS(SELECT 1 FROM lab.users WHERE registration_number=trim(p->>'registrationNumber'))
     OR EXISTS(SELECT 1 FROM lab.student_profiles WHERE index_number=trim(p->>'indexNumber'))
    THEN RETURN '{"status":409,"code":"DUPLICATE_STUDENT_RECORD"}'::jsonb; END IF;
  id_value:=gen_random_uuid();
  INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number)
    VALUES(id_value,email_input,trim(p->>'fullName'),'google-oauth-only',batch_value,trim(p->>'registrationNumber'));
  INSERT INTO lab.user_roles(user_id,role) VALUES(id_value,'STUDENT');
  INSERT INTO lab.user_batch_memberships(user_id,batch_id,changed_by) VALUES(id_value,batch_value,id_value);
  INSERT INTO lab.google_student_identities(google_subject,user_id,verified_email)
    VALUES(subject_input,id_value,email_input);
  INSERT INTO lab.student_profiles(user_id,index_number,department,phone,university_email,personal_email)
    VALUES(id_value,trim(p->>'indexNumber'),trim(p->>'department'),trim(p->>'phone'),
      email_input,nullif(lower(trim(coalesce(p->>'personalEmail',''))),''));
  token_value:=encode(public.gen_random_bytes(32),'hex');
  csrf_value:=encode(public.digest(token_value||':csrf','sha256'),'hex');
  INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at)
    VALUES(encode(public.digest(token_value,'sha256'),'hex'),id_value,
      encode(public.digest(csrf_value,'sha256'),'hex'),clock_timestamp()+interval '8 hours',false,clock_timestamp());
  INSERT INTO lab.audit(id,actor_id,action,target_id,details)
    VALUES(gen_random_uuid(),id_value,'GOOGLE_STUDENT_REGISTERED',id_value,
      jsonb_build_object('batchId',batch_value,'profileComplete',true));
  RETURN jsonb_build_object('token',token_value,'csrfToken',csrf_value);
END $$;
ALTER FUNCTION lab.google_student_register(text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.google_student_register(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.google_student_register(text,text,jsonb) TO lab_runtime;
COMMIT;
