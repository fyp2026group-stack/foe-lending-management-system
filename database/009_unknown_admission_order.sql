CREATE OR REPLACE FUNCTION lab.login_start(email_input text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE k text; lim lab.login_limits; u lab.users; challenge uuid:=gen_random_uuid(); keys text[];
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 IF length(email_input)>254 OR email_input IS NULL THEN RETURN '{"status":422,"code":"INVALID_LOGIN"}'; END IF;
 SELECT * INTO u FROM lab.users WHERE email=lower(trim(email_input)) AND NOT disabled;
 keys:=ARRAY['login-account:'||encode(public.digest(lower(trim(email_input)),'sha256'),'hex')];
 IF u.id IS NULL THEN keys:=array_prepend('login-unknown',keys); END IF;
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

