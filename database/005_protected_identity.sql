CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE lab_identity_functions NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE TABLE lab.verifier_secret(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), secret text NOT NULL);
CREATE TABLE lab.login_challenges(id uuid PRIMARY KEY,user_id uuid REFERENCES lab.users(id),credential_hash text,expires_at timestamptz NOT NULL);
REVOKE ALL ON ALL TABLES IN SCHEMA lab FROM lab_runtime,PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA lab FROM lab_runtime,PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lab FROM lab_runtime,PUBLIC;
GRANT USAGE ON SCHEMA lab TO lab_identity_functions;
GRANT SELECT ON lab.users,lab.user_roles,lab.staff_labs,lab.batches,lab.laboratories,lab.sessions,lab.login_limits,lab.verifier_secret,lab.login_challenges TO lab_identity_functions;
GRANT INSERT,UPDATE ON lab.users,lab.sessions,lab.login_limits TO lab_identity_functions;
GRANT INSERT ON lab.batches,lab.laboratories,lab.audit TO lab_identity_functions;
GRANT INSERT,DELETE ON lab.user_roles,lab.staff_labs,lab.login_challenges TO lab_identity_functions;
GRANT DELETE ON lab.login_limits TO lab_identity_functions;
CREATE FUNCTION lab.login_start(email_input text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE k text; lim lab.login_limits; u lab.users; challenge uuid:=gen_random_uuid();
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 IF length(email_input)>254 OR email_input IS NULL THEN RETURN jsonb_build_object('status',422,'code','INVALID_LOGIN'); END IF;
 FOREACH k IN ARRAY ARRAY['global',encode(public.digest(lower(trim(email_input)),'sha256'),'hex')] LOOP
 INSERT INTO lab.login_limits VALUES(k,0,clock_timestamp()+interval '15 minutes') ON CONFLICT DO NOTHING;
 SELECT * INTO lim FROM lab.login_limits WHERE key=k FOR UPDATE;
 IF lim.until_at<=clock_timestamp() THEN UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '15 minutes' WHERE key=k;
 ELSIF lim.attempts>=(CASE WHEN k='global' THEN 100 ELSE 10 END) THEN RETURN jsonb_build_object('status',429,'code','LOGIN_LIMITED'); END IF;
 UPDATE lab.login_limits SET attempts=attempts+1 WHERE key=k;
 END LOOP;
 DELETE FROM lab.login_limits WHERE until_at<clock_timestamp();
 DELETE FROM lab.login_challenges WHERE expires_at<clock_timestamp();
 SELECT * INTO u FROM lab.users WHERE email=lower(trim(email_input)) AND NOT disabled;
 INSERT INTO lab.login_challenges VALUES(challenge,u.id,u.password_hash,clock_timestamp()+interval '60 seconds');
 RETURN jsonb_build_object('challengeId',challenge,'passwordHash',coalesce(u.password_hash,''));
END $$;
CREATE FUNCTION lab.login_finish(challenge_id uuid,proof text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE ch lab.login_challenges; secret_value text; token text; csrf text; valid boolean;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 DELETE FROM lab.login_challenges WHERE id=challenge_id RETURNING * INTO ch;
 IF NOT FOUND THEN RETURN jsonb_build_object('status',401,'code','INVALID_LOGIN'); END IF;
 SELECT secret INTO secret_value FROM lab.verifier_secret WHERE singleton;
 valid:=proof=encode(public.hmac(challenge_id::text,secret_value,'sha256'),'hex');
 IF NOT coalesce(valid,false) OR ch.expires_at<=clock_timestamp() OR ch.user_id IS NULL OR NOT EXISTS(SELECT 1 FROM lab.users WHERE id=ch.user_id AND NOT disabled AND password_hash=ch.credential_hash) THEN
 INSERT INTO lab.audit(id,action,details) VALUES(gen_random_uuid(),'LOGIN_DENIED','{}');
 RETURN jsonb_build_object('status',401,'code','INVALID_LOGIN');
 END IF;
 token:=encode(public.gen_random_bytes(32),'hex');csrf:=encode(public.digest(token||':csrf','sha256'),'hex');
 INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at) VALUES(encode(public.digest(token,'sha256'),'hex'),ch.user_id,encode(public.digest(csrf,'sha256'),'hex'),clock_timestamp()+interval '8 hours',false,clock_timestamp());
 INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),ch.user_id,'LOGIN',ch.user_id);
 RETURN jsonb_build_object('token',token,'csrfToken',csrf);
END $$;
CREATE FUNCTION lab.identity_call(token text,csrf text,op text,target uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE s lab.sessions; u lab.users; roles text[]; labs uuid[]; id_value uuid; before_value jsonb; result jsonb; key text; write_op boolean;
BEGIN
 write_op:=op NOT IN ('me','users','batches','laboratories');
 IF write_op THEN PERFORM pg_advisory_xact_lock(731942); ELSE PERFORM pg_advisory_xact_lock_shared(731942); END IF;
 IF length(token)<>64 THEN RETURN jsonb_build_object('status',401,'code','UNAUTHENTICATED'); END IF;
 SELECT * INTO s FROM lab.sessions WHERE token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT revoked AND expires_at>clock_timestamp() AND last_seen_at>clock_timestamp()-interval '30 minutes';
 SELECT * INTO u FROM lab.users WHERE id=s.user_id AND NOT disabled;
 IF u.id IS NULL THEN RETURN jsonb_build_object('status',401,'code','UNAUTHENTICATED'); END IF;
 SELECT array_agg(role ORDER BY role) INTO roles FROM lab.user_roles WHERE user_id=u.id;
 IF write_op AND s.csrf_hash IS DISTINCT FROM encode(public.digest(csrf,'sha256'),'hex') THEN RETURN jsonb_build_object('status',403,'code','CSRF_DENIED'); END IF;
 UPDATE lab.sessions SET last_seen_at=clock_timestamp() WHERE token_hash=s.token_hash;
 IF op='me' THEN RETURN jsonb_build_object('user',jsonb_build_object('id',u.id,'displayName',u.display_name,'email',u.email,'roles',coalesce(roles,'{}')),'csrfToken',encode(public.digest(token||':csrf','sha256'),'hex')); END IF;
 IF op='logout' THEN
 UPDATE lab.sessions SET revoked=true WHERE token_hash=s.token_hash;
 INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),u.id,'LOGOUT',u.id);
 RETURN '{"ok":true}';
 END IF;
 IF NOT coalesce('ADMIN'=ANY(roles),false) THEN
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),u.id,'GOVERNANCE_DENIED',jsonb_build_object('code','DENIED'));
 RETURN '{"status":403,"code":"DENIED"}';
 END IF;
 IF op='users' THEN
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(x),'[]')) INTO result FROM (SELECT a.id,a.email,a.display_name AS "displayName",a.disabled,a.batch_id AS "batchId",a.registration_number AS "registrationNumber",ARRAY(SELECT role FROM lab.user_roles WHERE user_id=a.id) AS roles,ARRAY(SELECT laboratory_id FROM lab.staff_labs WHERE user_id=a.id) AS "laboratoryIds" FROM lab.users a ORDER BY id LIMIT 100)x; RETURN result;
 ELSIF op='batches' THEN SELECT jsonb_build_object('items',coalesce(jsonb_agg(x),'[]')) INTO result FROM(SELECT id,name FROM lab.batches ORDER BY id LIMIT 100)x;RETURN result;
 ELSIF op='laboratories' THEN SELECT jsonb_build_object('items',coalesce(jsonb_agg(x),'[]')) INTO result FROM(SELECT id,name FROM lab.laboratories ORDER BY id LIMIT 100)x;RETURN result; END IF;
 BEGIN
 IF jsonb_typeof(p)<>'object' OR p IS NULL THEN RAISE EXCEPTION 'INVALID'; END IF;
 IF op IN ('create_batch','create_laboratory') THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k<>'name') OR jsonb_typeof(p->'name')<>'string' OR length(trim(p->>'name')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'INVALID'; END IF;
 id_value:=gen_random_uuid();
 IF op='create_batch' THEN INSERT INTO lab.batches VALUES(id_value,trim(p->>'name')); ELSE INSERT INTO lab.laboratories VALUES(id_value,trim(p->>'name')); END IF;
 result:=jsonb_build_object('id',id_value,'name',trim(p->>'name'));
 ELSIF op IN ('create_user','patch_user') THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(CASE WHEN op='patch_user' THEN ARRAY['roles','disabled','laboratoryIds'] ELSE ARRAY['email','displayName','passwordHash','batchId','registrationNumber','roles','laboratoryIds'] END)) THEN RAISE EXCEPTION 'INVALID'; END IF;
 IF jsonb_typeof(p->'roles') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'roles') NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'INVALID'; END IF;
 SELECT array_agg(value) INTO roles FROM jsonb_array_elements_text(p->'roles');
 IF EXISTS(SELECT 1 FROM unnest(roles) r WHERE r NOT IN ('ADMIN','STUDENT','LECTURER','TECHNICAL_OFFICER')) OR cardinality(roles)<>(SELECT count(DISTINCT r) FROM unnest(roles)r) THEN RAISE EXCEPTION 'INVALID'; END IF;
 IF op='patch_user' AND (jsonb_typeof(p->'disabled') IS DISTINCT FROM 'boolean' OR NOT p?'laboratoryIds') THEN RAISE EXCEPTION 'INVALID'; END IF;
 IF p?'laboratoryIds' AND (jsonb_typeof(p->'laboratoryIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'laboratoryIds')>100) THEN RAISE EXCEPTION 'INVALID'; END IF;
 SELECT coalesce(array_agg(value::uuid),'{}') INTO labs FROM jsonb_array_elements_text(coalesce(p->'laboratoryIds','[]'));
 IF cardinality(labs)<>(SELECT count(DISTINCT l) FROM unnest(labs)l) OR (cardinality(labs)>0 AND NOT roles&&ARRAY['LECTURER','TECHNICAL_OFFICER']) THEN RAISE EXCEPTION 'INVALID'; END IF;
 IF op='create_user' THEN
 IF length(p->>'email') NOT BETWEEN 3 AND 254 OR (p->>'email')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR length(trim(p->>'displayName')) NOT BETWEEN 1 AND 120 OR (p->>'passwordHash')!~'^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$' OR p->>'email' IS NULL OR p->>'displayName' IS NULL OR p->>'passwordHash' IS NULL THEN RAISE EXCEPTION 'INVALID'; END IF;
 IF 'STUDENT'=ANY(roles) AND (p->>'batchId' IS NULL OR length(trim(p->>'registrationNumber')) NOT BETWEEN 1 AND 80 OR p->>'registrationNumber' IS NULL) THEN RAISE EXCEPTION 'INVALID'; END IF;
 id_value:=gen_random_uuid();
 INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number) VALUES(id_value,lower(trim(p->>'email')),trim(p->>'displayName'),p->>'passwordHash',(p->>'batchId')::uuid,p->>'registrationNumber');
 ELSE
 id_value:=target;IF id_value=u.id THEN RAISE EXCEPTION 'SELF_CHANGE'; END IF;
 SELECT jsonb_build_object('disabled',a.disabled,'roles',ARRAY(SELECT role FROM lab.user_roles WHERE user_id=a.id ORDER BY role),'labs',ARRAY(SELECT laboratory_id FROM lab.staff_labs WHERE user_id=a.id ORDER BY laboratory_id)) INTO before_value FROM lab.users a WHERE a.id=id_value;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF 'STUDENT'=ANY(roles) AND NOT EXISTS(SELECT 1 FROM lab.users WHERE id=id_value AND batch_id IS NOT NULL AND registration_number IS NOT NULL) THEN RAISE EXCEPTION 'INVALID'; END IF;
 UPDATE lab.users SET disabled=(p->>'disabled')::boolean WHERE id=id_value;
 DELETE FROM lab.user_roles WHERE user_id=id_value;DELETE FROM lab.staff_labs WHERE user_id=id_value;
 UPDATE lab.sessions SET revoked=true WHERE user_id=id_value;
 END IF;
 INSERT INTO lab.user_roles SELECT id_value,r FROM unnest(roles)r;
 INSERT INTO lab.staff_labs SELECT id_value,l FROM unnest(labs)l;
 result:=jsonb_build_object('id',id_value);
 ELSE RAISE EXCEPTION 'INVALID'; END IF;
 INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),u.id,upper(op),id_value,jsonb_build_object('before',before_value,'after',CASE WHEN op IN ('create_user','patch_user') THEN jsonb_build_object('roles',roles,'labs',labs,'disabled',coalesce((p->>'disabled')::boolean,false)) ELSE result END));
 RETURN result;
 EXCEPTION WHEN OTHERS THEN
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),u.id,'GOVERNANCE_DENIED',jsonb_build_object('code',CASE WHEN SQLERRM='NOT_FOUND' THEN 'NOT_FOUND' WHEN SQLERRM='SELF_CHANGE' THEN 'SELF_CHANGE' ELSE 'INVALID' END));
 RETURN jsonb_build_object('status',CASE WHEN SQLERRM='NOT_FOUND' THEN 404 WHEN SQLERRM='SELF_CHANGE' THEN 403 ELSE 422 END,'code',CASE WHEN SQLERRM='NOT_FOUND' THEN 'NOT_FOUND' WHEN SQLERRM='SELF_CHANGE' THEN 'SELF_CHANGE' ELSE 'INVALID' END);
 END;
END $$;
ALTER FUNCTION lab.login_start(text) OWNER TO lab_identity_functions;
ALTER FUNCTION lab.login_finish(uuid,text) OWNER TO lab_identity_functions;
ALTER FUNCTION lab.identity_call(text,text,text,uuid,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lab FROM PUBLIC,lab_runtime;
GRANT EXECUTE ON FUNCTION lab.login_start(text),lab.login_finish(uuid,text),lab.identity_call(text,text,text,uuid,jsonb) TO lab_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,lab_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA lab REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

