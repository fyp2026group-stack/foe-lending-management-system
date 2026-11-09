CREATE FUNCTION lab.inventory_import_admit(token text,csrf text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;lim lab.login_limits;k text;
BEGIN
PERFORM pg_advisory_xact_lock_shared(731942);
SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id JOIN lab.user_roles r ON r.user_id=u.id AND r.role='TECHNICAL_OFFICER' WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND s.csrf_hash=encode(public.digest(csrf,'sha256'),'hex') AND NOT u.disabled AND NOT s.revoked AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes';
IF actor IS NULL THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
k:='import:'||actor::text;INSERT INTO lab.login_limits VALUES(k,0,clock_timestamp()+interval '1 minute') ON CONFLICT DO NOTHING;
SELECT * INTO lim FROM lab.login_limits WHERE key=k FOR UPDATE;
IF lim.until_at<=clock_timestamp() THEN UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '1 minute' WHERE key=k;
ELSIF lim.attempts>=3 THEN RETURN '{"status":429,"code":"LIMITED"}';END IF;
UPDATE lab.login_limits SET attempts=attempts+1 WHERE key=k;
RETURN '{"admitted":true}';
END $$;
ALTER FUNCTION lab.inventory_import_admit(text,text) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.inventory_import_admit(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.inventory_import_admit(text,text) TO lab_runtime;

