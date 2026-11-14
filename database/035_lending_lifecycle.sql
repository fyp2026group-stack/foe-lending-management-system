BEGIN;
ALTER TABLE lab.lend_requests ADD COLUMN version integer NOT NULL DEFAULT 0,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ADD COLUMN predecessor_id uuid UNIQUE REFERENCES lab.lend_requests(id),
 ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE lab.lend_lines ADD COLUMN version integer NOT NULL DEFAULT 0,
 ADD COLUMN cancelled integer NOT NULL DEFAULT 0 CHECK(cancelled>=0 AND cancelled<=quantity);
ALTER TABLE lab.lend_lines DROP CONSTRAINT lend_lines_stage_check;
ALTER TABLE lab.lend_lines ADD CHECK(stage IN('LECTURER','HOD','APPROVED','REJECTED','CANCELLED'));
CREATE TABLE lab.lend_drafts(id uuid PRIMARY KEY,borrower_id uuid NOT NULL REFERENCES lab.users(id),
 payload jsonb NOT NULL,version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),submitted_id uuid UNIQUE REFERENCES lab.lend_requests(id),
 cancelled boolean NOT NULL DEFAULT false,predecessor_id uuid UNIQUE REFERENCES lab.lend_requests(id));
ALTER TABLE lab.lend_drafts OWNER TO lab_identity_functions;
REVOKE ALL ON lab.lend_drafts FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lend_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab AS $$
BEGIN
 IF TG_TABLE_NAME='lend_lines' THEN
  NEW.version:=OLD.version+1;
  UPDATE lab.lend_requests SET version=version+1,updated_at=clock_timestamp() WHERE id=NEW.request_id;
 ELSE
  UPDATE lab.lend_lines SET version=version WHERE id=NEW.line_id;
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION lab.lend_touch() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_touch() FROM PUBLIC,lab_runtime;
CREATE TRIGGER lend_line_version BEFORE UPDATE ON lab.lend_lines FOR EACH ROW EXECUTE FUNCTION lab.lend_touch();
CREATE TRIGGER lend_allocation_version AFTER INSERT OR UPDATE ON lab.lend_allocations FOR EACH ROW EXECUTE FUNCTION lab.lend_touch();
CREATE FUNCTION lab.lend_reserve(actor uuid,lineid uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $$
DECLARE l lab.lend_lines;a lab.lend_allocations;src uuid;dst uuid;q integer;movement uuid;
BEGIN
 SELECT * INTO l FROM lab.lend_lines WHERE id=lineid FOR UPDATE;
 IF l.stage IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 SELECT * INTO a FROM lab.lend_allocations WHERE line_id=l.id;
 IF FOUND THEN RETURN jsonb_build_object('allocationId',a.id);END IF;
 q:=l.quantity-l.cancelled;
 src:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'AVAILABLE');
 IF q<=0 OR coalesce((SELECT quantity FROM lab.inv_cells WHERE id=src),0)<q THEN RETURN jsonb_build_object('awaitingStock',true);END IF;
 dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'RESERVED');
 movement:=lab.inv_post(actor,l.item_id,l.lab_id,src,dst,q,'RESERVE','approved lending request');
 INSERT INTO lab.lend_allocations(id,line_id,cell_id,quantity) VALUES(gen_random_uuid(),l.id,dst,q) RETURNING * INTO a;
 RETURN jsonb_build_object('allocationId',a.id,'movementId',movement);
END $$;
ALTER FUNCTION lab.lend_reserve(uuid,uuid) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_reserve(uuid,uuid) FROM PUBLIC,lab_runtime;
-- Allocation quantity retains its original reservation. Cancelled reservation is
-- tracked independently so the historical allocation and handovers stay intact.
ALTER TABLE lab.lend_allocations ADD COLUMN cancelled integer NOT NULL DEFAULT 0 CHECK(cancelled>=0 AND issued+cancelled<=quantity);
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_cp1;
REVOKE ALL ON FUNCTION lab.lending_call_cp1(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;roles text[];d lab.lend_drafts;r lab.lend_requests;l lab.lend_lines;a lab.lend_allocations;
 old lab.lend_commands;cmd uuid;result jsonb;body jsonb;v jsonb;items jsonb;lineitems jsonb;
 idvalue uuid;dst uuid;q integer;issued_n integer;reserved_n integer;limit_n integer:=50;offset_n integer:=0;summary text;allowed text[];
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 IF op NOT LIKE 'read_%' THEN PERFORM pg_advisory_xact_lock(731943);PERFORM pg_advisory_xact_lock(731944);END IF;
 SELECT u.id,array_agg(ur.role) INTO actor,roles FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id
 JOIN lab.user_roles ur ON ur.user_id=u.id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex')
 AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes' GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID';END IF;
 IF op LIKE 'read_%' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('requestId','labId','batchId','from','to','status','stage','limit','offset')) THEN RAISE EXCEPTION 'INVALID';END IF;
  IF p ? 'limit' THEN IF (p->>'limit')!~'^[0-9]+$' THEN RAISE EXCEPTION 'INVALID';END IF;limit_n:=(p->>'limit')::integer;END IF;
  IF p ? 'offset' THEN IF (p->>'offset')!~'^[0-9]+$' THEN RAISE EXCEPTION 'INVALID';END IF;offset_n:=(p->>'offset')::integer;END IF;
  IF limit_n NOT BETWEEN 1 AND 100 OR offset_n NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'INVALID';END IF;
  PERFORM (p->>'requestId')::uuid,(p->>'labId')::uuid,(p->>'batchId')::uuid,(p->>'from')::timestamptz,(p->>'to')::timestamptz;
  IF (p->>'from')::timestamptz >= (p->>'to')::timestamptz THEN RAISE EXCEPTION 'INVALID';END IF;
  IF p ? 'stage' AND (op<>'read_requests' OR p->>'stage' NOT IN('LECTURER','HOD','APPROVED','REJECTED','CANCELLED')) THEN RAISE EXCEPTION 'INVALID';END IF;
  IF op='read_drafts' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('requestId','limit','offset')) THEN RAISE EXCEPTION 'INVALID';END IF;
   SELECT coalesce(jsonb_agg(x ORDER BY x."updatedAt" DESC,x.id),'[]') INTO items FROM(
    SELECT id,payload,version,created_at AS "createdAt",updated_at AS "updatedAt",submitted_id AS "submittedId",cancelled,predecessor_id AS "predecessorId"
    FROM lab.lend_drafts WHERE borrower_id=actor AND (p->>'requestId' IS NULL OR id=(p->>'requestId')::uuid)
    ORDER BY updated_at DESC,id LIMIT limit_n OFFSET offset_n)x;
   RETURN jsonb_build_object('items',items,'limit',limit_n,'offset',offset_n);
  END IF;
  result:=lab.lending_call_cp1(token,csrf,op,p-ARRAY['stage','limit','offset']);
  IF result ? 'status' OR NOT result ? 'items' THEN RETURN result;END IF;
  items:='[]';
  FOR v IN SELECT value FROM jsonb_array_elements(result->'items') LOOP
   IF op='read_requests' THEN
    SELECT * INTO r FROM lab.lend_requests WHERE id=(v->>'id')::uuid;
    lineitems:='[]';
    FOR body IN SELECT value FROM jsonb_array_elements(v->'lines') LOOP
     SELECT * INTO l FROM lab.lend_lines WHERE id=(body->>'id')::uuid;
     SELECT * INTO a FROM lab.lend_allocations WHERE line_id=l.id;
     body:=body||jsonb_build_object('version',l.version,'cancelledQuantity',l.cancelled,'allocatedQuantity',coalesce(a.quantity,0),
      'issuedQuantity',coalesce(a.issued,0),'reservedQuantity',coalesce(a.quantity-a.issued-a.cancelled,0),
      'lab',(SELECT name FROM lab.laboratories WHERE id=l.lab_id),'location',(SELECT name FROM lab.inv_locations WHERE id=l.location_id));
     lineitems:=lineitems||jsonb_build_array(body);
    END LOOP;
    -- Summary is derived solely from the lines this caller is authorized to see.
    SELECT CASE
     WHEN bool_and(x->>'stage'='CANCELLED') THEN 'CANCELLED'
     WHEN bool_and(x->>'stage'='REJECTED') THEN 'REJECTED'
     WHEN bool_and((x->>'issuedQuantity')::integer=(x->>'quantity')::integer-(x->>'cancelledQuantity')::integer)
       AND bool_or((x->>'issuedQuantity')::integer>0) THEN 'FULFILLED'
     WHEN bool_or((x->>'issuedQuantity')::integer>0) THEN 'PARTIALLY_FULFILLED'
     WHEN bool_and(x->>'stage'='APPROVED') THEN CASE WHEN bool_and((x->>'reservedQuantity')::integer>0) THEN 'READY' ELSE 'AWAITING_STOCK' END
     WHEN bool_and(x->>'stage' IN('LECTURER','HOD')) THEN 'PENDING'
     ELSE 'MIXED' END INTO summary FROM jsonb_array_elements(lineitems)x;
    IF p ? 'stage' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(lineitems)x WHERE x->>'stage'=p->>'stage') THEN CONTINUE;END IF;
    v:=v||jsonb_build_object('lines',lineitems,'version',r.version,'updatedAt',r.updated_at,'revision',r.revision,'predecessorId',r.predecessor_id,'summary',summary);
   ELSIF op IN('read_ready','read_allocations') THEN
    SELECT * INTO a FROM lab.lend_allocations WHERE id=(v->>'id')::uuid;
    IF a.quantity-a.issued-a.cancelled<=0 THEN CONTINUE;END IF;
    v:=v||jsonb_build_object('cancelledQuantity',a.cancelled,'remaining',a.quantity-a.issued-a.cancelled);
   END IF;
   IF p ? 'requestId' AND op IN('read_ready','read_allocations','read_loans') AND v->>'requestId' IS DISTINCT FROM p->>'requestId' THEN CONTINUE;END IF;
   items:=items||jsonb_build_array(v);
  END LOOP;
  SELECT coalesce(jsonb_agg(value ORDER BY ordinality),'[]') INTO items FROM jsonb_array_elements(items) WITH ORDINALITY WHERE ordinality>offset_n AND ordinality<=offset_n+limit_n;
  RETURN jsonb_build_object('items',items,'limit',limit_n,'offset',offset_n);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.sessions WHERE token_hash=encode(public.digest(token,'sha256'),'hex') AND csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
 allowed:=CASE op WHEN 'drafts' THEN ARRAY['commandId','draftId','expectedVersion','purpose','collectAt','returnAt','lecturerId','lines']
 WHEN 'submit' THEN ARRAY['commandId','draftId','expectedVersion'] WHEN 'revisions' THEN ARRAY['commandId','requestId','expectedVersion']
 WHEN 'cancel' THEN ARRAY['commandId','lineId','draftId','expectedVersion','quantity','reason'] ELSE NULL END;
 IF allowed IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'INVALID';END IF;
 cmd:=(p->>'commandId')::uuid;IF cmd IS NULL THEN RETURN '{"status":422,"code":"COMMAND_REQUIRED"}';END IF;
 SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
 IF op IN('drafts','submit') OR (op='cancel' AND p ? 'draftId') THEN
  SELECT * INTO d FROM lab.lend_drafts WHERE id=(p->>'draftId')::uuid FOR UPDATE;
  IF (op<>'drafts' OR p ? 'draftId') AND (d.id IS NULL OR d.borrower_id<>actor) THEN RAISE EXCEPTION 'DENIED';END IF;
 ELSIF op='revisions' THEN
  SELECT * INTO r FROM lab.lend_requests WHERE id=(p->>'requestId')::uuid FOR UPDATE;
  IF r.id IS NULL OR r.borrower_id<>actor THEN RAISE EXCEPTION 'DENIED';END IF;
 ELSIF op='cancel' THEN
  SELECT * INTO l FROM lab.lend_lines WHERE id=(p->>'lineId')::uuid FOR UPDATE;
  IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM lab.lend_requests WHERE id=l.request_id AND borrower_id=actor) THEN RAISE EXCEPTION 'DENIED';END IF;
 END IF;
 IF allowed IS NOT NULL AND old.command_id IS NOT NULL THEN
  IF old.operation<>op OR old.payload<>p THEN RAISE EXCEPTION 'IDENTITY_CONFLICT';END IF;RETURN old.result;
 END IF;
 IF allowed IS NOT NULL AND (op<>'drafts' OR p ? 'draftId') THEN
  IF jsonb_typeof(p->'expectedVersion') IS DISTINCT FROM 'number' OR (p->>'expectedVersion')!~'^[0-9]+$' THEN RAISE EXCEPTION 'INVALID';END IF;
  IF (p->>'expectedVersion')::integer<>(CASE WHEN d.id IS NOT NULL THEN d.version WHEN r.id IS NOT NULL THEN r.version ELSE l.version END) THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 END IF;
 IF op='drafts' THEN
  body:=p-ARRAY['commandId','draftId','expectedVersion'];
  IF jsonb_typeof(body->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(body->'lines')>20 OR octet_length(body::text)>90000 THEN RAISE EXCEPTION 'INVALID';END IF;
  IF d.id IS NULL THEN
   INSERT INTO lab.lend_drafts(id,borrower_id,payload) VALUES(gen_random_uuid(),actor,body) RETURNING * INTO d;
  ELSE
   IF d.submitted_id IS NOT NULL OR d.cancelled THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   UPDATE lab.lend_drafts SET payload=body,version=version+1,updated_at=clock_timestamp() WHERE id=d.id RETURNING * INTO d;
  END IF;
  result:=jsonb_build_object('id',d.id,'version',d.version,'summary','DRAFT');
 ELSIF op='submit' THEN
  IF d.submitted_id IS NOT NULL OR d.cancelled THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  result:=lab.lending_call_cp1(token,csrf,'requests',d.payload||jsonb_build_object('commandId',cmd));
  IF result ? 'status' THEN RETURN result;END IF;
  idvalue:=(result->>'id')::uuid;
  -- Re-key the delegated command as the public submit operation.
  DELETE FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
  UPDATE lab.lend_requests SET predecessor_id=d.predecessor_id,revision=coalesce((SELECT revision+1 FROM lab.lend_requests WHERE id=d.predecessor_id),1) WHERE id=idvalue;
  UPDATE lab.lend_drafts SET submitted_id=idvalue,version=version+1,updated_at=clock_timestamp() WHERE id=d.id RETURNING * INTO d;
  FOR l IN SELECT * FROM lab.lend_lines WHERE request_id=idvalue AND stage='APPROVED' LOOP PERFORM lab.lend_reserve(actor,l.id);END LOOP;
  result:=result||jsonb_build_object('draftId',d.id,'version',d.version);
 ELSIF op='revisions' THEN
  IF NOT EXISTS(SELECT 1 FROM lab.lend_lines WHERE request_id=r.id AND stage='REJECTED') THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
  SELECT jsonb_build_object('purpose',r.purpose,'collectAt',r.collect_at,'returnAt',r.return_at,
   'lecturerId',(array_agg(lecturer_id) FILTER(WHERE lecturer_id IS NOT NULL))[1],
   'lines',jsonb_agg(jsonb_build_object('itemId',item_id,'labId',lab_id,'locationId',location_id,'quantity',quantity))) INTO body
   FROM lab.lend_lines WHERE request_id=r.id AND stage='REJECTED';
  INSERT INTO lab.lend_drafts(id,borrower_id,payload,predecessor_id) VALUES(gen_random_uuid(),actor,body,r.id) RETURNING * INTO d;
  result:=jsonb_build_object('id',d.id,'version',d.version,'predecessorId',r.id,'summary','DRAFT');
 ELSIF op='cancel' THEN
  IF jsonb_typeof(p->'reason') IS DISTINCT FROM 'string' OR length(trim(p->>'reason')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID';END IF;
  IF d.id IS NOT NULL THEN
   IF p ? 'lineId' OR p ? 'quantity' OR d.submitted_id IS NOT NULL OR d.cancelled THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   UPDATE lab.lend_drafts SET cancelled=true,version=version+1,updated_at=clock_timestamp() WHERE id=d.id RETURNING * INTO d;
   result:=jsonb_build_object('id',d.id,'version',d.version,'summary','CANCELLED');
  ELSE
   IF l.stage NOT IN('LECTURER','HOD','APPROVED') THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   IF jsonb_typeof(p->'quantity') IS DISTINCT FROM 'number' OR (p->>'quantity')!~'^[1-9][0-9]*$' THEN RAISE EXCEPTION 'INVALID';END IF;q:=(p->>'quantity')::integer;
   SELECT * INTO a FROM lab.lend_allocations WHERE line_id=l.id FOR UPDATE;
   IF q>l.quantity-l.cancelled-coalesce(a.issued,0) THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   IF a.id IS NOT NULL THEN
    dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'AVAILABLE');
    PERFORM lab.inv_post(actor,l.item_id,l.lab_id,a.cell_id,dst,q,'CANCEL_RESERVATION',trim(p->>'reason'));
    UPDATE lab.lend_allocations SET cancelled=cancelled+q WHERE id=a.id;
   END IF;
   UPDATE lab.lend_lines SET cancelled=cancelled+q,stage=CASE WHEN cancelled+q=quantity THEN 'CANCELLED' ELSE stage END WHERE id=l.id RETURNING * INTO l;
   result:=jsonb_build_object('lineId',l.id,'version',l.version,'cancelledQuantity',l.cancelled,'stage',l.stage);
  END IF;
 ELSE
  IF op IN('decisions','reserve','issues') THEN
   IF op='issues' THEN SELECT ll.* INTO l FROM lab.lend_lines ll JOIN lab.lend_allocations aa ON aa.line_id=ll.id WHERE aa.id=(p->>'allocationId')::uuid;
   ELSE SELECT * INTO l FROM lab.lend_lines WHERE id=(p->>'lineId')::uuid;END IF;
   -- Existing clients remain compatible; CP2 clients supply optimistic versions.
   IF old.command_id IS NULL AND p ? 'expectedVersion' THEN
    IF jsonb_typeof(p->'expectedVersion') IS DISTINCT FROM 'number' OR (p->>'expectedVersion')!~'^[0-9]+$' THEN RAISE EXCEPTION 'INVALID';END IF;
    IF (p->>'expectedVersion')::integer IS DISTINCT FROM l.version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
   END IF;
   IF op='issues' AND old.command_id IS NULL THEN
    SELECT * INTO a FROM lab.lend_allocations WHERE id=(p->>'allocationId')::uuid;
    IF l.stage<>'APPROVED' OR (p->>'quantity')::integer>a.quantity-a.issued-a.cancelled THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
   END IF;
   IF op='reserve' AND l.cancelled>0 AND old.command_id IS NULL THEN
    IF NOT EXISTS(SELECT 1 FROM lab.lend_requests WHERE id=l.request_id AND borrower_id=actor)
     AND NOT ('TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=l.lab_id)) THEN RAISE EXCEPTION 'DENIED';END IF;
    result:=lab.lend_reserve(actor,l.id);
    INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);RETURN result;
   END IF;
  END IF;
  result:=lab.lending_call_cp1(token,csrf,op,p);
  IF op='decisions' AND NOT result ? 'status' AND result->>'stage'='APPROVED' THEN
   -- Only explicit CP2 versioned decisions opt into automatic allocation.
   IF p ? 'expectedVersion' THEN PERFORM lab.lend_reserve(actor,l.id);END IF;
  END IF;
  RETURN result;
 END IF;
 INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);
 INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),actor,'LENDING_'||upper(op),coalesce(idvalue,l.id,d.id),jsonb_build_object('commandId',cmd,'reason',p->>'reason','result',result));
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),actor,'LENDING_DENIED',jsonb_build_object('operation',op,'sqlstate',SQLSTATE));
 RETURN jsonb_build_object('status',CASE WHEN SQLERRM='DENIED' THEN 403 WHEN SQLERRM IN('STALE_VERSION','STATE_CONFLICT','IDENTITY_CONFLICT') OR SQLSTATE='23505' THEN 409 ELSE 422 END,
 'code',CASE WHEN SQLERRM IN('DENIED','INVALID','STALE_VERSION','STATE_CONFLICT','IDENTITY_CONFLICT') THEN SQLERRM WHEN SQLSTATE='23505' THEN 'STATE_CONFLICT' ELSE 'INVALID' END);
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
