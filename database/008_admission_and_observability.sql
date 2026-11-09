CREATE FUNCTION lab.admin_hash_admit(token text,csrf text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE s lab.sessions; k text; lim lab.login_limits;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 SELECT a.* INTO s FROM lab.sessions a JOIN lab.users u ON u.id=a.user_id WHERE a.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT a.revoked AND NOT u.disabled AND a.expires_at>clock_timestamp() AND a.last_seen_at>clock_timestamp()-interval '30 minutes';
 IF s.user_id IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}'; END IF;
 IF s.csrf_hash IS DISTINCT FROM encode(public.digest(csrf,'sha256'),'hex') THEN RETURN '{"status":403,"code":"CSRF_DENIED"}'; END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.user_roles WHERE user_id=s.user_id AND role='ADMIN') THEN RETURN '{"status":403,"code":"DENIED"}'; END IF;
 FOREACH k IN ARRAY ARRAY['hash-admin:'||s.user_id::text,'hash-session:'||s.token_hash] LOOP
 INSERT INTO lab.login_limits VALUES(k,0,clock_timestamp()+interval '1 minute') ON CONFLICT DO NOTHING;
 SELECT * INTO lim FROM lab.login_limits WHERE key=k FOR UPDATE;
 IF lim.until_at<=clock_timestamp() THEN UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '1 minute' WHERE key=k;
 ELSIF lim.attempts>=5 THEN RETURN '{"status":429,"code":"HASH_LIMITED"}'; END IF;
 UPDATE lab.login_limits SET attempts=attempts+1 WHERE key=k;
 END LOOP;
 RETURN '{"admitted":true}';
END $$;
ALTER FUNCTION lab.admin_hash_admit(text,text) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.admin_hash_admit(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.admin_hash_admit(text,text) TO lab_runtime;
CREATE OR REPLACE FUNCTION lab.login_start(email_input text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE k text; lim lab.login_limits; u lab.users; challenge uuid:=gen_random_uuid(); keys text[];
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 IF length(email_input)>254 OR email_input IS NULL THEN RETURN '{"status":422,"code":"INVALID_LOGIN"}'; END IF;
 SELECT * INTO u FROM lab.users WHERE email=lower(trim(email_input)) AND NOT disabled;
 keys:=ARRAY['login-account:'||encode(public.digest(lower(trim(email_input)),'sha256'),'hex')];
 IF u.id IS NULL THEN keys:=array_append(keys,'login-unknown'); END IF;
 FOREACH k IN ARRAY keys LOOP
 INSERT INTO lab.login_limits VALUES(k,0,clock_timestamp()+interval '15 minutes') ON CONFLICT DO NOTHING;
 SELECT * INTO lim FROM lab.login_limits WHERE key=k FOR UPDATE;
 IF lim.until_at<=clock_timestamp() THEN UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '15 minutes' WHERE key=k;
 ELSIF lim.attempts>=(CASE WHEN k='login-unknown' THEN 20 ELSE 10 END) THEN RETURN '{"status":429,"code":"LOGIN_LIMITED"}'; END IF;
 UPDATE lab.login_limits SET attempts=attempts+1 WHERE key=k;
 END LOOP;
 DELETE FROM lab.login_limits WHERE until_at<clock_timestamp();
 DELETE FROM lab.login_challenges WHERE expires_at<clock_timestamp();
 INSERT INTO lab.login_challenges VALUES(challenge,u.id,u.password_hash,clock_timestamp()+interval '60 seconds');
 RETURN jsonb_build_object('challengeId',challenge,'passwordHash',coalesce(u.password_hash,''));
END $$;
REVOKE ALL ON FUNCTION lab.login_start(text) FROM PUBLIC;
CREATE TABLE lab.denial_suppression(singleton boolean PRIMARY KEY CHECK(singleton),suppressed bigint NOT NULL,last_suppressed_at timestamptz NOT NULL);
GRANT SELECT,INSERT,UPDATE ON lab.denial_suppression TO lab_identity_functions;
CREATE OR REPLACE FUNCTION lab.denial(token text,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 INSERT INTO lab.login_limits VALUES('denial-audit',0,clock_timestamp()+interval '1 minute') ON CONFLICT DO NOTHING;
 SELECT attempts INTO n FROM lab.login_limits WHERE key='denial-audit' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM lab.login_limits WHERE key='denial-audit' AND until_at<=clock_timestamp()) THEN
 UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '1 minute' WHERE key='denial-audit';n:=0;
 END IF;
 IF n>=100 THEN
 INSERT INTO lab.denial_suppression VALUES(true,1,clock_timestamp()) ON CONFLICT(singleton) DO UPDATE SET suppressed=CASE WHEN lab.denial_suppression.suppressed<9223372036854775807 THEN lab.denial_suppression.suppressed+1 ELSE lab.denial_suppression.suppressed END,last_suppressed_at=clock_timestamp();
 RETURN; END IF;
 UPDATE lab.login_limits SET attempts=attempts+1 WHERE key='denial-audit';
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes';
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),actor,'CALLER_REPORTED_DENIAL',jsonb_build_object('code',CASE WHEN reason IN ('CSRF_DENIED','ORIGIN_DENIED','INVALID','INVALID_JSON','INVALID_OBJECT','UNSUPPORTED_FIELD','TOO_LARGE','DENIED','UNAUTHENTICATED') THEN reason ELSE 'INVALID' END,'attribution','validated token only; caller report not proven event'));
END $$;
CREATE FUNCTION lab.denial_summary(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; result jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id JOIN lab.user_roles r ON r.user_id=u.id AND r.role='ADMIN' WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes';
 IF actor IS NULL THEN RETURN '{"status":403,"code":"DENIED"}'; END IF;
 SELECT jsonb_build_object('suppressed',suppressed,'lastSuppressedAt',last_suppressed_at) INTO result FROM lab.denial_suppression WHERE singleton;
 RETURN coalesce(result,'{"suppressed":0}');
END $$;
ALTER FUNCTION lab.denial_summary(text) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.denial_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.denial_summary(text) TO lab_runtime;

