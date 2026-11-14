BEGIN;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_v1;
REVOKE ALL ON FUNCTION lab.lending_call_v1(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;roles text[];line lab.lend_lines;loan lab.lend_loans;allocation lab.lend_allocations;borrower uuid;
BEGIN
 SELECT u.id,array_agg(r.role) INTO actor,roles FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id JOIN lab.user_roles r ON r.user_id=u.id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes' GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF op='policies' AND NOT coalesce('ADMIN'=ANY(roles),false) THEN RETURN '{"status":403,"code":"DENIED"}';
 ELSIF op='decisions' THEN SELECT * INTO line FROM lab.lend_lines WHERE id=(p->>'lineId')::uuid;IF FOUND THEN SELECT borrower_id INTO borrower FROM lab.lend_requests WHERE id=line.request_id;END IF;IF NOT FOUND OR actor=borrower OR (line.stage='LECTURER' AND actor IS DISTINCT FROM line.lecturer_id) OR (line.stage='HOD' AND actor IS DISTINCT FROM line.hod_id) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 ELSIF op='issues' THEN SELECT * INTO allocation FROM lab.lend_allocations WHERE id=(p->>'allocationId')::uuid;IF FOUND THEN SELECT * INTO line FROM lab.lend_lines WHERE id=allocation.line_id;SELECT borrower_id INTO borrower FROM lab.lend_requests WHERE id=line.request_id;END IF;IF NOT FOUND OR actor=borrower OR NOT coalesce('TECHNICAL_OFFICER'=ANY(roles),false) OR NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=line.lab_id) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 ELSIF op='returns' THEN SELECT * INTO loan FROM lab.lend_loans WHERE id=(p->>'loanId')::uuid;IF FOUND THEN SELECT * INTO allocation FROM lab.lend_allocations WHERE id=loan.allocation_id;SELECT * INTO line FROM lab.lend_lines WHERE id=allocation.line_id;END IF;IF NOT FOUND OR actor=loan.borrower_id OR NOT coalesce('TECHNICAL_OFFICER'=ANY(roles),false) OR NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=line.lab_id) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 END IF;
 RETURN lab.lending_call_v1(token,csrf,op,p);
EXCEPTION WHEN invalid_text_representation THEN RETURN '{"status":422,"code":"INVALID"}';
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
