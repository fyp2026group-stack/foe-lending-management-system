BEGIN;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_v2;
REVOKE ALL ON FUNCTION lab.lending_call_v2(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE TABLE lab.lend_comments(
 id uuid PRIMARY KEY,request_id uuid NOT NULL REFERENCES lab.lend_requests(id),
 author_id uuid NOT NULL REFERENCES lab.users(id),body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 1000),
 corrects_id uuid UNIQUE REFERENCES lab.lend_comments(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE lab.lend_comments OWNER TO lab_identity_functions;
REVOKE ALL ON lab.lend_comments FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lend_visible(actor uuid,roles text[],l lab.lend_lines) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,lab AS $$
 SELECT coalesce('ADMIN'=ANY(roles),false)
 OR EXISTS(SELECT 1 FROM lab.lend_requests r WHERE r.id=l.request_id AND r.borrower_id=actor)
 OR actor=l.lecturer_id OR actor=l.hod_id
 OR ('TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=actor AND s.laboratory_id=l.lab_id))
$$;
ALTER FUNCTION lab.lend_visible(uuid,text[],lab.lend_lines) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_visible(uuid,text[],lab.lend_lines) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; roles text[]; result jsonb; line lab.lend_lines; policy lab.lend_policies;
 row jsonb; old lab.lend_commands; prior lab.lend_comments; cmd uuid; newid uuid;
BEGIN
 SELECT u.id,array_agg(r.role) INTO actor,roles FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id
 JOIN lab.user_roles r ON r.user_id=u.id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex')
 AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp()
 AND s.last_seen_at>clock_timestamp()-interval '30 minutes' GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 IF op LIKE 'read_%' THEN
  IF p->>'status' IS NOT NULL AND p->>'status' NOT IN('active','history','overdue') THEN RAISE EXCEPTION 'INVALID';END IF;
  IF op='read_requests' THEN
   SELECT coalesce(jsonb_agg(x ORDER BY x."createdAt" DESC),'[]') INTO result FROM(
    SELECT r.id,r.purpose,r.borrower_id AS "borrowerId",u.display_name borrower,u.batch_id AS "batchId",
    r.collect_at AS "collectAt",r.return_at AS "returnAt",r.created_at AS "createdAt",
    jsonb_agg(jsonb_build_object('id',l.id,'itemId',l.item_id,'item',i.name,'labId',l.lab_id,
    'locationId',l.location_id,'quantity',l.quantity,'policy',l.policy,'stage',l.stage,
    'lecturerId',l.lecturer_id,'hodId',l.hod_id,'decisions',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'actorId',d.actor_id,'actor',du.display_name,
     'stage',d.stage,'decision',d.decision,'remarks',d.remarks,'createdAt',d.created_at) ORDER BY d.created_at),'[]')
     FROM lab.lend_decisions d JOIN lab.users du ON du.id=d.actor_id WHERE d.line_id=l.id))) lines
    FROM lab.lend_requests r JOIN lab.users u ON u.id=r.borrower_id JOIN lab.lend_lines l ON l.request_id=r.id
    JOIN lab.inv_items i ON i.id=l.item_id WHERE lab.lend_visible(actor,roles,l)
    AND (p->>'requestId' IS NULL OR r.id=(p->>'requestId')::uuid)
    AND (p->>'labId' IS NULL OR l.lab_id=(p->>'labId')::uuid)
    AND (p->>'batchId' IS NULL OR u.batch_id=(p->>'batchId')::uuid)
    AND (p->>'from' IS NULL OR r.created_at>=(p->>'from')::timestamptz)
    AND (p->>'to' IS NULL OR r.created_at<(p->>'to')::timestamptz)
    GROUP BY r.id,u.display_name,u.batch_id)x;
  ELSIF op IN('read_loans','read_allocations','read_ready','read_metrics') THEN
   SELECT coalesce(jsonb_agg(x ORDER BY x."issuedAt" DESC),'[]') INTO result FROM(
    SELECT n.id,n.borrower_id AS "borrowerId",u.display_name borrower,u.batch_id AS "batchId",
    n.asset_id AS "assetId",n.quantity,n.returned,n.quantity-n.returned outstanding,
    n.due_at AS "dueAt",n.issued_at AS "issuedAt",n.issued_by AS "issuedBy",l.item_id AS "itemId",
    i.name item,l.lab_id AS "labId",l.request_id AS "requestId",
    CASE WHEN n.returned=n.quantity THEN 'history' WHEN n.due_at<clock_timestamp() THEN 'overdue' ELSE 'active' END status,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'quantity',t.quantity,'condition',t.condition,
     'actorId',t.actor_id,'createdAt',t.created_at) ORDER BY t.created_at),'[]') FROM lab.lend_returns t WHERE t.loan_id=n.id) returns
    FROM lab.lend_loans n JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines l ON l.id=a.line_id
    JOIN lab.inv_items i ON i.id=l.item_id JOIN lab.users u ON u.id=n.borrower_id
    WHERE lab.lend_visible(actor,roles,l)
    AND (p->>'labId' IS NULL OR l.lab_id=(p->>'labId')::uuid)
    AND (p->>'batchId' IS NULL OR u.batch_id=(p->>'batchId')::uuid)
    AND (p->>'from' IS NULL OR n.issued_at>=(p->>'from')::timestamptz)
    AND (p->>'to' IS NULL OR n.issued_at<(p->>'to')::timestamptz)
    AND (p->>'status' IS NULL OR (p->>'status'='history' AND n.returned=n.quantity)
     OR (p->>'status'='active' AND n.returned<n.quantity)
     OR (p->>'status'='overdue' AND n.returned<n.quantity AND n.due_at<clock_timestamp())))x;
   IF op='read_metrics' THEN
    RETURN jsonb_build_object('metrics',jsonb_build_object('loans',jsonb_array_length(result),
     'issuedQuantity',(SELECT coalesce(sum((v->>'quantity')::integer),0) FROM jsonb_array_elements(result)v),
     'outstandingQuantity',(SELECT coalesce(sum((v->>'outstanding')::integer),0) FROM jsonb_array_elements(result)v),
     'overdueLoans',(SELECT count(*) FROM jsonb_array_elements(result)v WHERE v->>'status'='overdue')));
   ELSIF op IN('read_ready','read_allocations') THEN
    SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(
     SELECT a.id,a.line_id AS "lineId",a.quantity,a.issued,a.quantity-a.issued remaining,
     l.item_id AS "itemId",i.name item,l.lab_id AS "labId",l.location_id AS "locationId",
     r.id AS "requestId",r.purpose,r.collect_at AS "collectAt",r.return_at AS "returnAt",
     r.borrower_id AS "borrowerId",u.display_name borrower
     FROM lab.lend_allocations a JOIN lab.lend_lines l ON l.id=a.line_id JOIN lab.lend_requests r ON r.id=l.request_id
     JOIN lab.users u ON u.id=r.borrower_id JOIN lab.inv_items i ON i.id=l.item_id
     WHERE a.issued<a.quantity AND lab.lend_visible(actor,roles,l)
     AND (p->>'labId' IS NULL OR l.lab_id=(p->>'labId')::uuid)
     AND (p->>'batchId' IS NULL OR u.batch_id=(p->>'batchId')::uuid)
     AND (p->>'from' IS NULL OR r.collect_at>=(p->>'from')::timestamptz)
     AND (p->>'to' IS NULL OR r.collect_at<(p->>'to')::timestamptz) ORDER BY r.collect_at,a.id)x;
   END IF;
  ELSIF op='read_comments' THEN
   IF NOT EXISTS(SELECT 1 FROM lab.lend_lines l WHERE l.request_id=(p->>'requestId')::uuid AND lab.lend_visible(actor,roles,l)) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'requestId',c.request_id,'authorId',c.author_id,
    'author',u.display_name,'body',c.body,'correctsId',c.corrects_id,'createdAt',c.created_at) ORDER BY c.created_at,c.id),'[]')
    INTO result FROM lab.lend_comments c JOIN lab.users u ON u.id=c.author_id WHERE c.request_id=(p->>'requestId')::uuid;
  ELSE RETURN lab.lending_call_v2(token,csrf,op,p);END IF;
  RETURN jsonb_build_object('items',result);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.sessions WHERE token_hash=encode(public.digest(token,'sha256'),'hex') AND csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
 -- Serialize before replay lookup, including calls delegated to the original writer.
 PERFORM pg_advisory_xact_lock(731944);
 cmd:=(p->>'commandId')::uuid;
 IF cmd IS NULL THEN RETURN '{"status":422,"code":"COMMAND_REQUIRED"}';END IF;
 SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
 IF FOUND THEN IF old.operation<>op OR old.payload<>p THEN RETURN '{"status":409,"code":"IDENTITY_CONFLICT"}';END IF;RETURN old.result;END IF;
 IF op='comments' THEN
  IF NOT EXISTS(SELECT 1 FROM lab.lend_lines l WHERE l.request_id=(p->>'requestId')::uuid AND lab.lend_visible(actor,roles,l)) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
  IF p->>'correctsId' IS NOT NULL THEN
   SELECT * INTO prior FROM lab.lend_comments WHERE id=(p->>'correctsId')::uuid;
   IF NOT FOUND OR prior.author_id<>actor OR prior.request_id<>(p->>'requestId')::uuid THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
  END IF;
  newid:=gen_random_uuid();INSERT INTO lab.lend_comments(id,request_id,author_id,body,corrects_id)
   VALUES(newid,(p->>'requestId')::uuid,actor,trim(p->>'body'),(p->>'correctsId')::uuid);
  result:=jsonb_build_object('id',newid);
  INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);
  INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),actor,'LENDING_COMMENTS',(p->>'requestId')::uuid);
  RETURN result;
 ELSIF op='requests' THEN
  IF jsonb_typeof(p->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'lines') v GROUP BY v->>'itemId',v->>'labId',v->>'locationId' HAVING count(*)>1) THEN RAISE EXCEPTION 'INVALID';END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(p->'lines') LOOP
   SELECT * INTO policy FROM lab.lend_policies WHERE item_id=(row->>'itemId')::uuid;
   IF policy.policy IN('LECTURER','BOTH') AND NOT EXISTS(SELECT 1 FROM lab.users u JOIN lab.user_roles ur ON ur.user_id=u.id
    JOIN lab.staff_labs s ON s.user_id=u.id WHERE u.id=(p->>'lecturerId')::uuid AND u.id<>actor AND NOT u.disabled
    AND ur.role='LECTURER' AND s.laboratory_id=(row->>'labId')::uuid) THEN RAISE EXCEPTION 'INVALID';END IF;
   IF policy.policy IN('HOD','BOTH') AND (policy.hod_id=actor OR NOT EXISTS(SELECT 1 FROM lab.users u JOIN lab.user_roles ur ON ur.user_id=u.id
    WHERE u.id=policy.hod_id AND NOT u.disabled AND ur.role='ADMIN') OR (policy.policy='BOTH' AND policy.hod_id=(p->>'lecturerId')::uuid)) THEN RAISE EXCEPTION 'INVALID';END IF;
  END LOOP;
 ELSIF op='policies' THEN
  IF NOT 'ADMIN'=ANY(roles) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
  IF p->>'policy' IN('HOD','BOTH') AND NOT EXISTS(SELECT 1 FROM lab.users u JOIN lab.user_roles ur ON ur.user_id=u.id WHERE u.id=(p->>'hodId')::uuid AND NOT u.disabled AND ur.role='ADMIN') THEN RAISE EXCEPTION 'INVALID';END IF;
 ELSIF op='reserve' THEN
  SELECT * INTO line FROM lab.lend_lines WHERE id=(p->>'lineId')::uuid;
  IF NOT FOUND OR NOT (EXISTS(SELECT 1 FROM lab.lend_requests r WHERE r.id=line.request_id AND r.borrower_id=actor)
   OR ('TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=actor AND s.laboratory_id=line.lab_id))) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 END IF;
 RETURN lab.lending_call_v2(token,csrf,op,p);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('status',CASE WHEN SQLSTATE='23505' THEN 409 ELSE 422 END,'code',CASE WHEN SQLSTATE='23505' THEN 'STATE_CONFLICT' ELSE 'INVALID' END);
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
