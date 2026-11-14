BEGIN;
ALTER TABLE lab.lend_loans ADD COLUMN version integer NOT NULL DEFAULT 0,
 ADD COLUMN original_due_at timestamptz;
UPDATE lab.lend_loans SET original_due_at=due_at;
CREATE TABLE lab.lend_inspections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),return_id uuid NOT NULL UNIQUE REFERENCES lab.lend_returns(id),asset_id uuid NOT NULL REFERENCES lab.inv_assets(id),borrower_id uuid NOT NULL REFERENCES lab.users(id),status text NOT NULL DEFAULT 'UNRESOLVED' CHECK(status IN('UNRESOLVED','CLEAR_AVAILABLE','ROUTE_MAINTENANCE')),version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE lab.lend_inspection_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),inspection_id uuid NOT NULL REFERENCES lab.lend_inspections(id),actor_id uuid NOT NULL REFERENCES lab.users(id),outcome text NOT NULL CHECK(outcome IN('UNRESOLVED','CLEAR_AVAILABLE','ROUTE_MAINTENANCE')),condition text NOT NULL CHECK(length(trim(condition)) BETWEEN 1 AND 1000),notes text NOT NULL CHECK(length(trim(notes)) BETWEEN 1 AND 1000),version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(inspection_id,version));
CREATE TABLE lab.lend_maintenance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),inspection_id uuid NOT NULL UNIQUE REFERENCES lab.lend_inspections(id),status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','IN_PROGRESS','RESOLVED_AVAILABLE','RETIRED')),version integer NOT NULL DEFAULT 0,created_by uuid NOT NULL REFERENCES lab.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE lab.lend_maintenance_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),maintenance_id uuid NOT NULL REFERENCES lab.lend_maintenance(id),actor_id uuid NOT NULL REFERENCES lab.users(id),status text NOT NULL CHECK(status IN('OPEN','IN_PROGRESS','RESOLVED_AVAILABLE','RETIRED')),notes text NOT NULL CHECK(length(trim(notes)) BETWEEN 1 AND 1000),version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(maintenance_id,version));
CREATE TABLE lab.lend_extensions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),loan_id uuid NOT NULL REFERENCES lab.lend_loans(id),requested_by uuid NOT NULL REFERENCES lab.users(id),previous_due_at timestamptz NOT NULL,proposed_due_at timestamptz NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVE','REJECT')),version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(proposed_due_at>previous_due_at));
CREATE UNIQUE INDEX lend_one_pending_extension ON lab.lend_extensions(loan_id) WHERE status='PENDING';
CREATE TABLE lab.lend_extension_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),extension_id uuid NOT NULL UNIQUE REFERENCES lab.lend_extensions(id),actor_id uuid NOT NULL REFERENCES lab.users(id),decision text NOT NULL CHECK(decision IN('APPROVE','REJECT')),remarks text NOT NULL CHECK(length(trim(remarks)) BETWEEN 1 AND 1000),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
-- Existing physical receipts become explicit unresolved inspections without clearing stock.
INSERT INTO lab.lend_inspections(return_id,asset_id,borrower_id)
 SELECT r.id,n.asset_id,n.borrower_id FROM lab.lend_returns r JOIN lab.lend_loans n ON n.id=r.loan_id WHERE n.asset_id IS NOT NULL;
CREATE FUNCTION lab.lend_officer(actor uuid,labid uuid,borrower uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,lab AS $$
 SELECT actor<>borrower AND EXISTS(SELECT 1 FROM lab.users WHERE id=actor AND NOT disabled)
 AND EXISTS(SELECT 1 FROM lab.user_roles WHERE user_id=actor AND role='TECHNICAL_OFFICER')
 AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=labid)
$$;
-- HOD/BOTH use the original designated HOD's current ADMIN authority. Lecturer
-- policy uses the designated lecturer's current lab assignment. NONE uses an
-- independent currently assigned lecturer (there is no designated academic).
CREATE FUNCTION lab.lend_extension_approver(actor uuid,l lab.lend_lines,borrower uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,lab AS $$
 SELECT actor<>borrower AND EXISTS(SELECT 1 FROM lab.users WHERE id=actor AND NOT disabled) AND
 CASE WHEN l.policy IN('HOD','BOTH') THEN actor=l.hod_id AND EXISTS(SELECT 1 FROM lab.user_roles WHERE user_id=actor AND role='ADMIN')
 ELSE (l.policy='NONE' OR actor=l.lecturer_id) AND EXISTS(SELECT 1 FROM lab.user_roles WHERE user_id=actor AND role='LECTURER') AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=l.lab_id) END
$$;
CREATE FUNCTION lab.lend_loan_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $$ BEGIN NEW.version:=OLD.version+1;RETURN NEW;END $$;
CREATE TRIGGER lend_loan_version BEFORE UPDATE ON lab.lend_loans FOR EACH ROW EXECUTE FUNCTION lab.lend_loan_version();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['lend_inspections','lend_inspection_events','lend_maintenance','lend_maintenance_events','lend_extensions','lend_extension_decisions'] LOOP
 EXECUTE format('ALTER TABLE lab.%I OWNER TO lab_identity_functions',t);
 EXECUTE format('REVOKE ALL ON lab.%I FROM PUBLIC,lab_runtime',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['lend_inspection_events','lend_maintenance_events','lend_extension_decisions','lend_returns'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_cp3_history BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.%I FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable()',t);
 END LOOP;
END $$;
ALTER FUNCTION lab.lend_officer(uuid,uuid,uuid) OWNER TO lab_identity_functions;
ALTER FUNCTION lab.lend_extension_approver(uuid,lab.lend_lines,uuid) OWNER TO lab_identity_functions;
ALTER FUNCTION lab.lend_loan_version() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_officer(uuid,uuid,uuid),lab.lend_extension_approver(uuid,lab.lend_lines,uuid),lab.lend_loan_version() FROM PUBLIC,lab_runtime;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_cp2;
REVOKE ALL ON FUNCTION lab.lending_call_cp2(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;roles text[];a lab.lend_allocations;l lab.lend_lines;n lab.lend_loans;c lab.inv_cells;
 ins lab.lend_inspections;m lab.lend_maintenance;e lab.lend_extensions;old lab.lend_commands;
 cmd uuid;borrower uuid;asset uuid;dst uuid;src uuid;movement uuid;rid uuid;newid uuid;result jsonb;allowed text[];q integer;v integer;lim integer;offn integer;nextstate text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 IF op NOT LIKE 'read_%' THEN PERFORM pg_advisory_xact_lock(731943);PERFORM pg_advisory_xact_lock(731944);END IF;
 SELECT u.id,array_agg(ur.role) INTO actor,roles FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id JOIN lab.user_roles ur ON ur.user_id=u.id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes' GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID';END IF;
 IF op IN('read_borrowed','read_expected','read_overdue','read_inspections','read_maintenance','read_extensions','read_borrower-history','read_handover-assets') THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('requestId','loanId','allocationId','labId','status','limit','offset') OR jsonb_typeof(p->k)='null') THEN RAISE EXCEPTION 'INVALID';END IF;
  lim:=coalesce((p->>'limit')::integer,50);offn:=coalesce((p->>'offset')::integer,0);
  IF lim NOT BETWEEN 1 AND 100 OR offn NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'INVALID';END IF;
  IF p ? 'status' AND NOT ((op='read_inspections' AND p->>'status' IN('UNRESOLVED','CLEAR_AVAILABLE','ROUTE_MAINTENANCE')) OR (op='read_maintenance' AND p->>'status' IN('OPEN','IN_PROGRESS','RESOLVED_AVAILABLE','RETIRED')) OR (op='read_extensions' AND p->>'status' IN('PENDING','APPROVE','REJECT'))) THEN RAISE EXCEPTION 'INVALID';END IF;
  IF op='read_handover-assets' THEN
   SELECT aa.* INTO a FROM lab.lend_allocations aa WHERE aa.id=(p->>'allocationId')::uuid;
   SELECT * INTO l FROM lab.lend_lines WHERE id=a.line_id;SELECT borrower_id INTO borrower FROM lab.lend_requests WHERE id=l.request_id;
   IF NOT coalesce(lab.lend_officer(actor,l.lab_id,borrower),false) THEN RAISE EXCEPTION 'DENIED';END IF;
   SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT ac.asset_id AS "assetId",ia.serial,ac.state,ac.version FROM lab.inv_cells ac JOIN lab.inv_assets ia ON ia.id=ac.asset_id WHERE ac.item_id=l.item_id AND ac.lab_id=l.lab_id AND ac.location_id=l.location_id AND ac.quantity=1 AND (ac.state='AVAILABLE' OR ac.state='RESERVED' AND ac.id=a.cell_id) ORDER BY ac.asset_id LIMIT lim OFFSET offn)x;
  ELSE
   SELECT coalesce(jsonb_agg(x.body ORDER BY x.sort_at DESC,x.id),'[]') INTO result FROM (
    SELECT n.id,n.issued_at sort_at,jsonb_build_object('id',n.id,'loanId',n.id,'requestId',l.request_id,'allocationId',a.id,'borrowerId',n.borrower_id,'item',i.name,'labId',l.lab_id,'assetId',n.asset_id,'serial',ia.serial,'quantity',n.quantity,'returned',n.returned,'outstandingQuantity',n.quantity-n.returned,'dueAt',n.due_at,'originalDueAt',n.original_due_at,'version',n.version,'overdue',n.due_at<clock_timestamp() AND n.returned<n.quantity,'issuedAt',n.issued_at,
     'inspection',CASE WHEN ins.id IS NOT NULL THEN to_jsonb(ins)||jsonb_build_object('receipt',(SELECT to_jsonb(rr) FROM lab.lend_returns rr WHERE rr.id=ins.return_id),'events',(SELECT coalesce(jsonb_agg(ev ORDER BY ev.version),'[]') FROM lab.lend_inspection_events ev WHERE ev.inspection_id=ins.id)) END,
     'maintenance',CASE WHEN m.id IS NOT NULL THEN to_jsonb(m)||jsonb_build_object('events',(SELECT coalesce(jsonb_agg(ev ORDER BY ev.version),'[]') FROM lab.lend_maintenance_events ev WHERE ev.maintenance_id=m.id)) END,
     'extension',CASE WHEN e.id IS NOT NULL THEN to_jsonb(e)||jsonb_build_object('decision',(SELECT to_jsonb(ed) FROM lab.lend_extension_decisions ed WHERE ed.extension_id=e.id)) END) body
    FROM lab.lend_loans n JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines l ON l.id=a.line_id JOIN lab.inv_items i ON i.id=l.item_id LEFT JOIN lab.inv_assets ia ON ia.id=n.asset_id
    LEFT JOIN lab.lend_inspections ins ON ins.return_id IN(SELECT rr.id FROM lab.lend_returns rr WHERE rr.loan_id=n.id) AND op IN('read_inspections','read_maintenance')
    LEFT JOIN lab.lend_maintenance m ON m.inspection_id=ins.id
    LEFT JOIN lab.lend_extensions e ON e.loan_id=n.id AND op='read_extensions'
    WHERE (n.borrower_id=actor OR 'ADMIN'=ANY(roles) OR lab.lend_officer(actor,l.lab_id,n.borrower_id) OR op='read_extensions' AND lab.lend_extension_approver(actor,l,n.borrower_id))
    AND (NOT p ? 'requestId' OR l.request_id=(p->>'requestId')::uuid) AND (NOT p ? 'labId' OR l.lab_id=(p->>'labId')::uuid) AND (NOT p ? 'loanId' OR n.id=(p->>'loanId')::uuid)
    AND CASE op WHEN 'read_borrower-history' THEN n.borrower_id=actor WHEN 'read_extensions' THEN e.id IS NOT NULL AND (NOT p ? 'status' OR e.status=p->>'status') WHEN 'read_inspections' THEN ins.id IS NOT NULL AND ins.status=coalesce(p->>'status','UNRESOLVED') WHEN 'read_maintenance' THEN m.id IS NOT NULL AND (CASE WHEN p ? 'status' THEN m.status=p->>'status' ELSE m.status IN('OPEN','IN_PROGRESS') END) ELSE n.asset_id IS NOT NULL AND n.returned<n.quantity AND (op<>'read_overdue' OR n.due_at<clock_timestamp()) END
    ORDER BY n.issued_at DESC,n.id,ins.id,e.id LIMIT lim OFFSET offn
   )x;
  END IF;
  RETURN jsonb_build_object('items',result,'limit',lim,'offset',offn);
 END IF;
 IF op NOT IN('issues','returns','inspections','maintenance','extensions','extension-decisions') THEN RETURN lab.lending_call_cp2(token,csrf,op,p);END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.sessions WHERE token_hash=encode(public.digest(token,'sha256'),'hex') AND csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
 allowed:=CASE op WHEN 'issues' THEN ARRAY['commandId','allocationId','quantity','expectedVersion','assetId','serial'] WHEN 'returns' THEN ARRAY['commandId','loanId','quantity','expectedVersion','condition'] WHEN 'inspections' THEN ARRAY['commandId','inspectionId','expectedVersion','outcome','condition','notes'] WHEN 'maintenance' THEN ARRAY['commandId','maintenanceId','expectedVersion','status','notes'] WHEN 'extensions' THEN ARRAY['commandId','loanId','expectedVersion','proposedDueAt','reason'] WHEN 'extension-decisions' THEN ARRAY['commandId','extensionId','expectedVersion','decision','remarks'] END;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed) OR jsonb_typeof(p->k)='null') THEN RAISE EXCEPTION 'INVALID';END IF;
 cmd:=(p->>'commandId')::uuid;IF cmd IS NULL THEN RAISE EXCEPTION 'INVALID';END IF;
 IF op='issues' THEN
  SELECT * INTO a FROM lab.lend_allocations WHERE id=(p->>'allocationId')::uuid FOR UPDATE;
 ELSE
  IF op='inspections' THEN SELECT * INTO ins FROM lab.lend_inspections WHERE id=(p->>'inspectionId')::uuid FOR UPDATE;
  ELSIF op='maintenance' THEN SELECT * INTO m FROM lab.lend_maintenance WHERE id=(p->>'maintenanceId')::uuid FOR UPDATE;SELECT * INTO ins FROM lab.lend_inspections WHERE id=m.inspection_id;
  ELSIF op='extension-decisions' THEN SELECT * INTO e FROM lab.lend_extensions WHERE id=(p->>'extensionId')::uuid FOR UPDATE;END IF;
  SELECT * INTO n FROM lab.lend_loans WHERE id=coalesce((p->>'loanId')::uuid,e.loan_id,(SELECT rr.loan_id FROM lab.lend_returns rr WHERE rr.id=ins.return_id)) FOR UPDATE;
  SELECT * INTO a FROM lab.lend_allocations WHERE id=n.allocation_id;
 END IF;
 SELECT * INTO l FROM lab.lend_lines WHERE id=a.line_id;
 SELECT borrower_id INTO borrower FROM lab.lend_requests WHERE id=l.request_id;
 IF l.id IS NULL THEN RAISE EXCEPTION 'DENIED';END IF;
 IF op='extensions' THEN IF actor<>borrower THEN RAISE EXCEPTION 'DENIED';END IF;
 ELSIF op='extension-decisions' THEN IF NOT coalesce(lab.lend_extension_approver(actor,l,borrower),false) THEN RAISE EXCEPTION 'DENIED';END IF;
 ELSE IF NOT coalesce(lab.lend_officer(actor,l.lab_id,borrower),false) THEN RAISE EXCEPTION 'DENIED';END IF;END IF;
 IF op='issues' AND NOT EXISTS(SELECT 1 FROM lab.users u JOIN lab.user_roles ur ON ur.user_id=u.id WHERE u.id=borrower AND NOT u.disabled AND ur.role IN('STUDENT','LECTURER','TECHNICAL_OFFICER','ADMIN')) THEN RAISE EXCEPTION 'DENIED';END IF;
 SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
 IF FOUND THEN IF old.operation<>op OR old.payload<>p THEN RAISE EXCEPTION 'IDENTITY_CONFLICT';END IF;RETURN old.result;END IF;
 v:=CASE op WHEN 'issues' THEN l.version WHEN 'inspections' THEN ins.version WHEN 'maintenance' THEN m.version WHEN 'extension-decisions' THEN e.version ELSE n.version END;
 -- Legacy issues/returns retain optional versions; all new workflow commands require one.
 IF p ? 'expectedVersion' OR op NOT IN('issues','returns') THEN
  IF jsonb_typeof(p->'expectedVersion') IS DISTINCT FROM 'number' OR (p->>'expectedVersion')!~'^[0-9]+$' THEN RAISE EXCEPTION 'INVALID';END IF;
  IF (p->>'expectedVersion')::integer IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 END IF;
 IF op='issues' THEN
  IF jsonb_typeof(p->'quantity') IS DISTINCT FROM 'number' OR (p->>'quantity')!~'^[1-9][0-9]*$' THEN RAISE EXCEPTION 'INVALID';END IF;q:=(p->>'quantity')::integer;
  IF l.stage<>'APPROVED' OR q>a.quantity-a.issued-a.cancelled THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  SELECT * INTO c FROM lab.inv_cells WHERE id=a.cell_id FOR UPDATE;
  IF (SELECT kind FROM lab.inv_items WHERE id=l.item_id)='RETURNABLE' THEN
   IF q<>1 OR (SELECT return_at FROM lab.lend_requests WHERE id=l.request_id)<=clock_timestamp() THEN RAISE EXCEPTION 'INVALID';END IF;
   asset:=coalesce((p->>'assetId')::uuid,c.asset_id);
   IF asset IS NOT NULL THEN
    SELECT * INTO c FROM lab.inv_cells WHERE asset_id=asset AND quantity=1 AND item_id=l.item_id AND lab_id=l.lab_id AND location_id=l.location_id AND (state='AVAILABLE' OR state='RESERVED' AND id=a.cell_id) FOR UPDATE;
    IF NOT FOUND OR p ? 'serial' THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
    IF c.state='AVAILABLE' THEN
     -- Exchange this allocation's anonymous reservation for the selected identity.
     IF (SELECT asset_id FROM lab.inv_cells WHERE id=a.cell_id) IS NOT NULL THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
     dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'AVAILABLE');PERFORM lab.inv_post(actor,l.item_id,l.lab_id,a.cell_id,dst,1,'RELEASE_RESERVATION','identified asset selected');
    END IF;
   ELSE
    IF p ? 'serial' AND (jsonb_typeof(p->'serial') IS DISTINCT FROM 'string' OR length(trim(p->>'serial')) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'INVALID';END IF;
    asset:=gen_random_uuid();INSERT INTO lab.inv_assets(id,item_id,lab_id,serial) VALUES(asset,l.item_id,l.lab_id,nullif(trim(p->>'serial'),''));
    dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,asset,'RESERVED');PERFORM lab.inv_post(actor,l.item_id,l.lab_id,c.id,dst,1,'MATERIALIZE','physical handover identity');c.id:=dst;
   END IF;
   dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,asset,'BORROWED');
   INSERT INTO lab.lend_loans(id,allocation_id,borrower_id,asset_id,quantity,issued_by,due_at,original_due_at) VALUES(gen_random_uuid(),a.id,borrower,asset,1,actor,(SELECT return_at FROM lab.lend_requests WHERE id=l.request_id),(SELECT return_at FROM lab.lend_requests WHERE id=l.request_id)) RETURNING id INTO newid;
  ELSE
   IF p ? 'assetId' OR p ? 'serial' THEN RAISE EXCEPTION 'INVALID';END IF;
   dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'CONSUMED');INSERT INTO lab.lend_loans(id,allocation_id,borrower_id,quantity,returned,issued_by) VALUES(gen_random_uuid(),a.id,borrower,q,q,actor) RETURNING id INTO newid;
  END IF;
  movement:=lab.inv_post(actor,l.item_id,l.lab_id,c.id,dst,q,'ISSUE','physical handover');UPDATE lab.lend_allocations SET issued=issued+q WHERE id=a.id;
  result:=jsonb_build_object('loanId',newid,'assetId',asset,'movementId',movement,'version',(SELECT version FROM lab.lend_lines WHERE id=l.id),'loanVersion',0);
 ELSIF op='returns' THEN
  q:=coalesce((p->>'quantity')::integer,1);
  IF q<>1 OR n.asset_id IS NULL OR n.returned+q>n.quantity OR jsonb_typeof(p->'condition') IS DISTINCT FROM 'string' OR length(trim(p->>'condition')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  SELECT * INTO c FROM lab.inv_cells WHERE asset_id=n.asset_id AND state='BORROWED' AND quantity=1 FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  dst:=lab.inv_cell(c.item_id,c.lab_id,c.location_id,n.asset_id,'INSPECTION');movement:=lab.inv_post(actor,c.item_id,c.lab_id,c.id,dst,q,'RETURN','received into inspection');
  UPDATE lab.lend_loans SET returned=returned+q WHERE id=n.id RETURNING version INTO v;
  INSERT INTO lab.lend_returns VALUES(gen_random_uuid(),n.id,actor,q,trim(p->>'condition'),clock_timestamp()) RETURNING id INTO rid;
  INSERT INTO lab.lend_inspections(return_id,asset_id,borrower_id) VALUES(rid,n.asset_id,borrower) RETURNING id INTO newid;
  result:=jsonb_build_object('loanId',n.id,'returnId',rid,'inspectionId',newid,'movementId',movement,'version',v,'inspectionVersion',0);
 ELSIF op IN('inspections','maintenance') THEN
  IF jsonb_typeof(p->'notes') IS DISTINCT FROM 'string' OR length(trim(p->>'notes')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID';END IF;
  SELECT * INTO c FROM lab.inv_cells WHERE asset_id=ins.asset_id AND quantity=1 FOR UPDATE;
  IF op='inspections' THEN
   IF ins.status<>'UNRESOLVED' OR c.state<>'INSPECTION' THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   IF p->>'outcome' IS NULL OR p->>'outcome' NOT IN('UNRESOLVED','CLEAR_AVAILABLE','ROUTE_MAINTENANCE') OR jsonb_typeof(p->'condition') IS DISTINCT FROM 'string' OR length(trim(p->>'condition')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID';END IF;
   UPDATE lab.lend_inspections SET status=p->>'outcome',version=version+1 WHERE id=ins.id RETURNING * INTO ins;
   INSERT INTO lab.lend_inspection_events(inspection_id,actor_id,outcome,condition,notes,version) VALUES(ins.id,actor,ins.status,trim(p->>'condition'),trim(p->>'notes'),ins.version);
   nextstate:=CASE ins.status WHEN 'CLEAR_AVAILABLE' THEN 'AVAILABLE' WHEN 'ROUTE_MAINTENANCE' THEN 'MAINTENANCE' END;
   IF ins.status='ROUTE_MAINTENANCE' THEN
    INSERT INTO lab.lend_maintenance(inspection_id,created_by) VALUES(ins.id,actor) RETURNING * INTO m;
    INSERT INTO lab.lend_maintenance_events(maintenance_id,actor_id,status,notes,version) VALUES(m.id,actor,'OPEN',trim(p->>'notes'),0);
   END IF;
   result:=jsonb_build_object('inspectionId',ins.id,'version',ins.version,'status',ins.status,'maintenanceId',m.id,'maintenanceVersion',m.version);
  ELSE
   IF c.state<>'MAINTENANCE' OR m.status NOT IN('OPEN','IN_PROGRESS') THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   IF p->>'status' IS NULL OR p->>'status' NOT IN('IN_PROGRESS','RESOLVED_AVAILABLE','RETIRED') OR p->>'status'=m.status THEN RAISE EXCEPTION 'INVALID';END IF;
   UPDATE lab.lend_maintenance SET status=p->>'status',version=version+1,updated_at=clock_timestamp() WHERE id=m.id RETURNING * INTO m;
   INSERT INTO lab.lend_maintenance_events(maintenance_id,actor_id,status,notes,version) VALUES(m.id,actor,m.status,trim(p->>'notes'),m.version);
   nextstate:=CASE m.status WHEN 'RESOLVED_AVAILABLE' THEN 'AVAILABLE' WHEN 'RETIRED' THEN 'RETIRED' END;
   result:=jsonb_build_object('maintenanceId',m.id,'status',m.status,'version',m.version);
  END IF;
  IF nextstate IS NOT NULL THEN dst:=lab.inv_cell(c.item_id,c.lab_id,c.location_id,c.asset_id,nextstate);movement:=lab.inv_post(actor,c.item_id,c.lab_id,c.id,dst,1,upper(op),trim(p->>'notes'));END IF;
 ELSIF op='extensions' THEN
  IF n.asset_id IS NULL OR n.returned>=n.quantity THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  IF jsonb_typeof(p->'reason') IS DISTINCT FROM 'string' OR length(trim(p->>'reason')) NOT BETWEEN 1 AND 1000 OR jsonb_typeof(p->'proposedDueAt') IS DISTINCT FROM 'string' OR NOT isfinite((p->>'proposedDueAt')::timestamptz) OR (p->>'proposedDueAt')::timestamptz<=greatest(n.due_at,clock_timestamp()) THEN RAISE EXCEPTION 'INVALID';END IF;
  INSERT INTO lab.lend_extensions(loan_id,requested_by,previous_due_at,proposed_due_at,reason) VALUES(n.id,actor,n.due_at,(p->>'proposedDueAt')::timestamptz,trim(p->>'reason')) RETURNING * INTO e;
  result:=jsonb_build_object('extensionId',e.id,'status',e.status,'version',e.version);
 ELSE
  IF e.status<>'PENDING' OR n.returned>=n.quantity OR n.due_at<>e.previous_due_at OR e.proposed_due_at<=clock_timestamp() THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  IF p->>'decision' IS NULL OR p->>'decision' NOT IN('APPROVE','REJECT') OR jsonb_typeof(p->'remarks') IS DISTINCT FROM 'string' OR length(trim(p->>'remarks')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID';END IF;
  INSERT INTO lab.lend_extension_decisions(extension_id,actor_id,decision,remarks) VALUES(e.id,actor,p->>'decision',trim(p->>'remarks'));
  UPDATE lab.lend_extensions SET status=p->>'decision',version=version+1 WHERE id=e.id RETURNING * INTO e;
  IF e.status='APPROVE' THEN UPDATE lab.lend_loans SET due_at=e.proposed_due_at WHERE id=n.id RETURNING * INTO n;END IF;
  result:=jsonb_build_object('extensionId',e.id,'version',e.version,'status',e.status,'loanVersion',n.version,'dueAt',n.due_at,'originalDueAt',n.original_due_at);
 END IF;
 INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);
 INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),actor,'LENDING_'||upper(op),coalesce(newid,ins.id,e.id,n.id),jsonb_build_object('commandId',cmd,'payload',p,'result',result));
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),actor,'LENDING_DENIED',jsonb_build_object('operation',op,'sqlstate',SQLSTATE));
 RETURN jsonb_build_object('status',CASE WHEN SQLERRM='DENIED' THEN 403 WHEN SQLERRM IN('STALE_VERSION','STATE_CONFLICT','IDENTITY_CONFLICT','INSUFFICIENT_STOCK') OR SQLSTATE='23505' THEN 409 ELSE 422 END,'code',CASE WHEN SQLERRM IN('DENIED','STALE_VERSION','STATE_CONFLICT','IDENTITY_CONFLICT','INSUFFICIENT_STOCK') THEN SQLERRM WHEN SQLSTATE='23505' THEN 'STATE_CONFLICT' ELSE 'INVALID' END);
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
-- Generic inventory state changes must not bypass lifecycle records.
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('lab.inventory_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF from_pool NOT IN', 'IF EXISTS(SELECT 1 FROM lab.lend_inspections ii WHERE ii.asset_id=asset AND (ii.status=''UNRESOLVED'' OR EXISTS(SELECT 1 FROM lab.lend_maintenance mm WHERE mm.inspection_id=ii.id AND mm.status IN(''OPEN'',''IN_PROGRESS'')))) THEN RAISE EXCEPTION ''STATE_CONFLICT'';END IF;'||chr(10)||' IF from_pool NOT IN');
 EXECUTE definition;
END $$;
COMMIT;
