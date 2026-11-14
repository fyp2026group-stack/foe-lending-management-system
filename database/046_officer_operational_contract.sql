BEGIN;
-- One immutable factual record per physical issue; old issues are not backfilled.
CREATE TABLE lab.lend_handovers(
 loan_id uuid PRIMARY KEY REFERENCES lab.lend_loans(id),
 actor_id uuid NOT NULL REFERENCES lab.users(id),
 movement_id uuid NOT NULL UNIQUE REFERENCES lab.inv_movements(id),
 remarks text CHECK(remarks IS NULL OR length(trim(remarks)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE lab.lend_handovers OWNER TO lab_identity_functions;
REVOKE ALL ON lab.lend_handovers FROM PUBLIC,lab_runtime;
CREATE TRIGGER immutable_handovers BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.lend_handovers FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable();
DO $$ DECLARE definition text;prior text;BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 prior:=definition;
 definition:=replace(definition,'''expectedVersion'',''assetId'',''serial'']','''expectedVersion'',''assetId'',''serial'',''remarks'']');
 definition:=replace(definition,'IF l.stage<>''APPROVED''',
 'IF p ? ''remarks'' AND (jsonb_typeof(p->''remarks'') IS DISTINCT FROM ''string'' OR length(trim(p->>''remarks'')) NOT BETWEEN 1 AND 1000) THEN RAISE EXCEPTION ''INVALID'';END IF;
  IF l.stage<>''APPROVED''');
 definition:=replace(definition,'UPDATE lab.lend_allocations SET issued=issued+q WHERE id=a.id;',
 'UPDATE lab.lend_allocations SET issued=issued+q WHERE id=a.id;
  INSERT INTO lab.lend_handovers(loan_id,actor_id,movement_id,remarks) VALUES(newid,actor,movement,trim(p->>''remarks''));');
 definition:=replace(definition,'''labId'',l.lab_id,''assetId'',n.asset_id',
 '''labId'',l.lab_id,''labName'',(SELECT name FROM lab.laboratories WHERE id=l.lab_id),''handover'',(SELECT to_jsonb(h) FROM lab.lend_handovers h WHERE h.loan_id=n.id),''assetId'',n.asset_id');
 IF definition=prior OR position('INSERT INTO lab.lend_handovers' in definition)=0 OR position('''handover''' in definition)=0 THEN RAISE EXCEPTION 'physical contract patch failed';END IF;
 EXECUTE definition;
 SELECT pg_get_functiondef('lab.lending_call_cp2(text,text,text,jsonb)'::regprocedure) INTO definition;
 prior:=definition;
 definition:=replace(definition,'''cancelledQuantity'',a.cancelled,''remaining'',a.quantity-a.issued-a.cancelled',
 '''labName'',(SELECT name FROM lab.laboratories WHERE id=(SELECT lab_id FROM lab.lend_lines WHERE id=a.line_id)),''cancelledQuantity'',a.cancelled,''remaining'',a.quantity-a.issued-a.cancelled');
 IF definition=prior THEN RAISE EXCEPTION 'queue contract patch failed';END IF;
 EXECUTE definition;
END $$;
-- Extend the existing protected boundary; helpers remain private.
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_physical;
REVOKE ALL ON FUNCTION lab.lending_call_physical(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;start_at timestamptz;end_at timestamptz;labid uuid;counts jsonb;labs jsonb;
BEGIN
 IF op<>'read_operations-summary' THEN RETURN lab.lending_call_physical(token,csrf,op,p);END IF;
 PERFORM pg_advisory_xact_lock_shared(731942);
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id
 WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled
 AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes';
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.user_roles WHERE user_id=actor AND role='TECHNICAL_OFFICER') THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('from','to','labId') OR jsonb_typeof(p->k) IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'INVALID';END IF;
 start_at:=(p->>'from')::timestamptz;end_at:=(p->>'to')::timestamptz;labid:=(p->>'labId')::uuid;
 IF start_at IS NULL OR end_at IS NULL OR NOT isfinite(start_at) OR NOT isfinite(end_at) OR end_at<=start_at OR end_at-start_at>interval '31 days' THEN RAISE EXCEPTION 'INVALID';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name) ORDER BY l.name,l.id),'[]') INTO labs
 FROM lab.laboratories l JOIN lab.staff_labs s ON s.laboratory_id=l.id AND s.user_id=actor WHERE labid IS NULL OR l.id=labid;
 WITH events AS (
 SELECT l.lab_id,n.issued_at occurred,'handovers' kind FROM lab.lend_loans n JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines l ON l.id=a.line_id
 UNION ALL SELECT l.lab_id,r.created_at,'receipts' FROM lab.lend_returns r JOIN lab.lend_loans n ON n.id=r.loan_id JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines l ON l.id=a.line_id
 UNION ALL SELECT ia.lab_id,e.created_at,'inspections' FROM lab.lend_inspection_events e JOIN lab.lend_inspections i ON i.id=e.inspection_id JOIN lab.inv_assets ia ON ia.id=i.asset_id WHERE e.outcome IN('CLEAR_AVAILABLE','ROUTE_MAINTENANCE')
 UNION ALL SELECT ia.lab_id,e.created_at,'maintenance' FROM lab.lend_maintenance_events e JOIN lab.lend_maintenance m ON m.id=e.maintenance_id JOIN lab.lend_inspections i ON i.id=m.inspection_id JOIN lab.inv_assets ia ON ia.id=i.asset_id WHERE e.status IN('RESOLVED_AVAILABLE','RETIRED')
 ) SELECT jsonb_build_object('handovers',count(*) FILTER(WHERE kind='handovers'),'receipts',count(*) FILTER(WHERE kind='receipts'),'inspections',count(*) FILTER(WHERE kind='inspections'),'maintenance',count(*) FILTER(WHERE kind='maintenance'),'total',count(*)) INTO counts
 FROM events e WHERE occurred>=start_at AND occurred<end_at AND (labid IS NULL OR e.lab_id=labid) AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=actor AND s.laboratory_id=e.lab_id);
 RETURN jsonb_build_object('from',start_at,'to',end_at,'laboratories',labs,'completed',counts);
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format OR raise_exception THEN RETURN '{"status":422,"code":"INVALID"}';
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
