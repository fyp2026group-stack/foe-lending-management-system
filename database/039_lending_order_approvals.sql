BEGIN;
-- New requests are governed as indivisible orders while retaining item-level policy
-- and the existing authorisation checks for each responsible approver.
CREATE TABLE lab.lend_order_controls (
 request_id uuid PRIMARY KEY REFERENCES lab.lend_requests(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE lab.lend_order_controls OWNER TO lab_identity_functions;
REVOKE ALL ON lab.lend_order_controls FROM PUBLIC,lab_runtime;

CREATE FUNCTION lab.lend_register_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab AS $$
BEGIN
 INSERT INTO lab.lend_order_controls(request_id) VALUES(NEW.id);
 RETURN NEW;
END $$;
ALTER FUNCTION lab.lend_register_order() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_register_order() FROM PUBLIC,lab_runtime;
CREATE TRIGGER lend_order_created AFTER INSERT ON lab.lend_requests
 FOR EACH ROW EXECUTE FUNCTION lab.lend_register_order();

-- Delay reservation of every item, including no-approval items, until the
-- *entire* order has cleared every required approval.
CREATE OR REPLACE FUNCTION lab.lend_reserve(actor uuid,lineid uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $$
DECLARE l lab.lend_lines;a lab.lend_allocations;src uuid;dst uuid;q integer;movement uuid;
BEGIN
 SELECT * INTO l FROM lab.lend_lines WHERE id=lineid FOR UPDATE;
 IF l.stage IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 IF EXISTS(SELECT 1 FROM lab.lend_order_controls WHERE request_id=l.request_id)
  AND EXISTS(SELECT 1 FROM lab.lend_lines WHERE request_id=l.request_id AND stage<>'APPROVED')
 THEN RETURN jsonb_build_object('awaitingOrderApproval',true);END IF;
 SELECT * INTO a FROM lab.lend_allocations WHERE line_id=l.id;
 IF FOUND THEN RETURN jsonb_build_object('allocationId',a.id);END IF;
 q:=l.quantity-l.cancelled;
 src:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'AVAILABLE');
 IF q<=0 OR coalesce((SELECT quantity FROM lab.inv_cells WHERE id=src),0)<q
 THEN RETURN jsonb_build_object('awaitingStock',true);END IF;
 dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'RESERVED');
 movement:=lab.inv_post(actor,l.item_id,l.lab_id,src,dst,q,'RESERVE','approved lending request');
 INSERT INTO lab.lend_allocations(id,line_id,cell_id,quantity)
 VALUES(gen_random_uuid(),l.id,dst,q) RETURNING * INTO a;
 RETURN jsonb_build_object('allocationId',a.id,'movementId',movement);
END $$;
ALTER FUNCTION lab.lend_reserve(uuid,uuid) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_reserve(uuid,uuid) FROM PUBLIC,lab_runtime;

ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_before_order;
REVOKE ALL ON FUNCTION lab.lending_call_before_order(text,text,text,jsonb) FROM PUBLIC,lab_runtime;

CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; roles text[]; request_row lab.lend_requests; line_row lab.lend_lines;
 old lab.lend_commands; cmd uuid; result jsonb; changed integer:=0; derived uuid;
BEGIN
 IF op NOT IN('order-decisions','decisions','issues') THEN
  RETURN lab.lending_call_before_order(token,csrf,op,p);
 END IF;
 PERFORM pg_advisory_xact_lock_shared(731942);
 PERFORM pg_advisory_xact_lock(731943);
 PERFORM pg_advisory_xact_lock(731944);
 SELECT u.id,array_agg(r.role) INTO actor,roles
 FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id
 JOIN lab.user_roles r ON r.user_id=u.id
 WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex')
 AND s.csrf_hash=encode(public.digest(csrf,'sha256'),'hex')
 AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp()
 AND s.last_seen_at>clock_timestamp()-interval '30 minutes'
 GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 IF op='issues' THEN
  IF EXISTS(SELECT 1 FROM lab.lend_allocations a
   JOIN lab.lend_lines l ON l.id=a.line_id
   JOIN lab.lend_order_controls o ON o.request_id=l.request_id
   WHERE a.id=(p->>'allocationId')::uuid
    AND EXISTS(SELECT 1 FROM lab.lend_lines other
     WHERE other.request_id=l.request_id AND other.stage<>'APPROVED'))
  THEN RETURN '{"status":409,"code":"ORDER_APPROVAL_REQUIRED"}';END IF;
  RETURN lab.lending_call_before_order(token,csrf,op,p);
 END IF;
 IF op='decisions' THEN
  -- Legacy line commands stay authorised, but no single line may release an
  -- order before all other lines are approved.
  SELECT l.* INTO line_row FROM lab.lend_lines l WHERE l.id=(p->>'lineId')::uuid;
  result:=lab.lending_call_before_order(token,csrf,op,p);
  IF result ? 'status' THEN RETURN result;END IF;
  IF line_row.id IS NOT NULL AND EXISTS(SELECT 1 FROM lab.lend_order_controls WHERE request_id=line_row.request_id)
    AND NOT EXISTS(SELECT 1 FROM lab.lend_lines
     WHERE request_id=line_row.request_id AND stage<>'APPROVED') THEN
    FOR line_row IN SELECT * FROM lab.lend_lines
     WHERE request_id=line_row.request_id AND stage='APPROVED' ORDER BY id LOOP
      PERFORM lab.lend_reserve(actor,line_row.id);
    END LOOP;
  END IF;
  RETURN result;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k
  WHERE k NOT IN('commandId','requestId','expectedVersion','decision','remarks'))
 OR p->>'decision' NOT IN('APPROVE','REJECT')
 OR length(trim(coalesce(p->>'remarks',''))) NOT BETWEEN 1 AND 1000
 THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 cmd:=(p->>'commandId')::uuid;
 IF cmd IS NULL THEN RETURN '{"status":422,"code":"COMMAND_REQUIRED"}';END IF;
 SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
 IF FOUND THEN
  IF old.operation<>op OR old.payload<>p THEN RETURN '{"status":409,"code":"IDENTITY_CONFLICT"}';END IF;
  RETURN old.result;
 END IF;
 SELECT * INTO request_row FROM lab.lend_requests WHERE id=(p->>'requestId')::uuid FOR UPDATE;
 IF request_row.id IS NULL OR request_row.borrower_id=actor
 OR NOT EXISTS(SELECT 1 FROM lab.lend_order_controls WHERE request_id=request_row.id)
 THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 IF request_row.version<>(p->>'expectedVersion')::integer
 THEN RETURN '{"status":409,"code":"STALE_VERSION"}';END IF;
 FOR line_row IN SELECT * FROM lab.lend_lines WHERE request_id=request_row.id
  AND ((stage='LECTURER' AND lecturer_id=actor AND 'LECTURER'=ANY(roles)
    AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=lab_id))
   OR (stage='HOD' AND hod_id=actor AND 'ADMIN'=ANY(roles)))
  ORDER BY id LOOP
  derived:=md5(cmd::text||line_row.id::text)::uuid;
  result:=lab.lending_call_before_order(token,csrf,'decisions',
   jsonb_build_object('commandId',derived,'lineId',line_row.id,
    'expectedVersion',line_row.version,'decision',p->>'decision','remarks',p->>'remarks'));
  IF result ? 'status' THEN RAISE EXCEPTION 'ORDER_DECISION_FAILED';END IF;
  changed:=changed+1;
 END LOOP;
 IF changed=0 THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 IF p->>'decision'='REJECT' THEN
  -- No line in a rejected unissued order is allowed to progress.
  UPDATE lab.lend_lines SET stage='REJECTED'
  WHERE request_id=request_row.id AND stage IN('LECTURER','HOD','APPROVED');
 ELSE
  IF NOT EXISTS(SELECT 1 FROM lab.lend_lines WHERE request_id=request_row.id AND stage<>'APPROVED')
  THEN
   FOR line_row IN SELECT * FROM lab.lend_lines WHERE request_id=request_row.id ORDER BY id LOOP
    PERFORM lab.lend_reserve(actor,line_row.id);
   END LOOP;
  END IF;
 END IF;
 result:=jsonb_build_object('requestId',request_row.id,'decidedLines',changed,
   'decision',p->>'decision');
 INSERT INTO lab.lend_commands(actor_id,command_id,operation,payload,result)
 VALUES(actor,cmd,op,p,result);
 INSERT INTO lab.audit(id,actor_id,action,target_id,details)
 VALUES(gen_random_uuid(),actor,'LENDING_ORDER_DECISION',request_row.id,
  jsonb_build_object('decision',p->>'decision','lines',changed,'commandId',cmd));
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('status',422,'code','ORDER_DECISION_FAILED');
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
