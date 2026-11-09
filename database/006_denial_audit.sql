CREATE FUNCTION lab.denial(token text,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 INSERT INTO lab.login_limits VALUES('denial-audit',0,clock_timestamp()+interval '1 minute') ON CONFLICT DO NOTHING;
 SELECT attempts INTO n FROM lab.login_limits WHERE key='denial-audit' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM lab.login_limits WHERE key='denial-audit' AND until_at<=clock_timestamp()) THEN
 UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '1 minute' WHERE key='denial-audit';n:=0;
 END IF;
 IF n>=100 THEN RETURN; END IF;
 UPDATE lab.login_limits SET attempts=attempts+1 WHERE key='denial-audit';
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes';
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),actor,'REQUEST_DENIED',jsonb_build_object('code',CASE WHEN reason IN ('CSRF_DENIED','ORIGIN_DENIED','INVALID','INVALID_JSON','INVALID_OBJECT','UNSUPPORTED_FIELD','TOO_LARGE','DENIED','UNAUTHENTICATED') THEN reason ELSE 'INVALID' END));
END $$;
ALTER FUNCTION lab.denial(text,text) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.denial(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.denial(text,text) TO lab_runtime;
