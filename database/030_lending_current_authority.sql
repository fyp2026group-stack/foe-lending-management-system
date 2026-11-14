BEGIN;
-- Historical assignment IDs do not confer current authority.
CREATE OR REPLACE FUNCTION lab.lend_visible(actor uuid,roles text[],l lab.lend_lines) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,lab AS $$
 SELECT EXISTS(SELECT 1 FROM lab.users u WHERE u.id=actor AND NOT u.disabled) AND (
 EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=actor AND r.role='ADMIN')
 OR EXISTS(SELECT 1 FROM lab.lend_requests r WHERE r.id=l.request_id AND r.borrower_id=actor)
 OR (actor=l.lecturer_id AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=actor AND r.role='LECTURER')
     AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=actor AND s.laboratory_id=l.lab_id))
 OR (EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=actor AND r.role='TECHNICAL_OFFICER')
     AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=actor AND s.laboratory_id=l.lab_id)))
$$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_v4;
REVOKE ALL ON FUNCTION lab.lending_call_v4(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; line lab.lend_lines; borrower uuid; required_stage text; old lab.lend_commands;
BEGIN
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id
 WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled
 AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes'
 AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=u.id);
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF op IN('decisions','issues') THEN
  IF NOT EXISTS(SELECT 1 FROM lab.sessions s WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex')
   AND s.csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
  PERFORM pg_advisory_xact_lock(731944);
  IF op='decisions' THEN
   SELECT * INTO line FROM lab.lend_lines WHERE id=(p->>'lineId')::uuid;
   IF NOT FOUND THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
   SELECT borrower_id INTO borrower FROM lab.lend_requests WHERE id=line.request_id;
   required_stage:=line.stage;
   SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=(p->>'commandId')::uuid;
   IF FOUND AND old.operation=op AND old.payload=p THEN
    SELECT d.stage INTO required_stage FROM lab.lend_decisions d WHERE d.line_id=line.id AND d.actor_id=actor;
   END IF;
   IF actor=borrower OR NOT coalesce(
    (required_stage='LECTURER' AND actor=line.lecturer_id
     AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=actor AND r.role='LECTURER')
     AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=actor AND s.laboratory_id=line.lab_id))
    OR (required_stage='HOD' AND actor=line.hod_id
     AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=actor AND r.role='ADMIN')),false)
    THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
  ELSE
   SELECT r.borrower_id INTO borrower FROM lab.lend_allocations a JOIN lab.lend_lines l ON l.id=a.line_id
    JOIN lab.lend_requests r ON r.id=l.request_id WHERE a.id=(p->>'allocationId')::uuid;
   IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM lab.users u JOIN lab.user_roles r ON r.user_id=u.id
    WHERE u.id=borrower AND NOT u.disabled AND r.role IN('STUDENT','LECTURER','TECHNICAL_OFFICER','ADMIN'))
    THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
   -- Check officer authority before replay lookup in the inner implementation.
   IF actor=borrower OR NOT EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=actor AND r.role='TECHNICAL_OFFICER')
    OR NOT EXISTS(SELECT 1 FROM lab.lend_allocations a JOIN lab.lend_lines l ON l.id=a.line_id JOIN lab.staff_labs s
     ON s.laboratory_id=l.lab_id AND s.user_id=actor WHERE a.id=(p->>'allocationId')::uuid)
    THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
  END IF;
 END IF;
 RETURN lab.lending_call_v4(token,csrf,op,p);
EXCEPTION WHEN invalid_text_representation THEN RETURN '{"status":422,"code":"INVALID"}';
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
