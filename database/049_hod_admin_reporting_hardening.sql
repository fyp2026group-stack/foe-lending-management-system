BEGIN;
GRANT SELECT ON lab.lend_loans,lab.lend_allocations,lab.lend_lines,lab.lend_requests,lab.lend_decisions,lab.lend_policies TO lab_identity_functions;
CREATE OR REPLACE FUNCTION lab.admin_report(token text, report_name text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE
 actor uuid; roles text[]; rows_value jsonb:='[]'; total_value integer:=0; metrics_value jsonb:='{}';
 limit_n integer:=50; offset_n integer:=0; from_at timestamptz; to_at timestamptz;
 sort_value text:=coalesce(p->>'sort','date'); direction_value text:=coalesce(p->>'direction','desc');
BEGIN
 SELECT u.id,array_agg(r.role) INTO actor,roles
 FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id JOIN lab.user_roles r ON r.user_id=u.id
 WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled
 AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes' GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF NOT coalesce('ADMIN'=ANY(roles),false) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR report_name NOT IN('borrowing','overdue','inventory','approvals','audit')
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('batchId','labId','categoryId','itemId','borrowerId','lecturerId','officerId','from','to','status','stage','kind','scope','sort','direction','limit','offset'))
 THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 BEGIN
  IF p?'limit' THEN limit_n:=(p->>'limit')::integer;END IF;IF p?'offset' THEN offset_n:=(p->>'offset')::integer;END IF;
  from_at:=(p->>'from')::timestamptz;to_at:=(p->>'to')::timestamptz;
  PERFORM (p->>'batchId')::uuid,(p->>'labId')::uuid,(p->>'categoryId')::uuid,(p->>'itemId')::uuid,
   (p->>'borrowerId')::uuid,(p->>'lecturerId')::uuid,(p->>'officerId')::uuid;
 EXCEPTION WHEN OTHERS THEN RETURN '{"status":422,"code":"INVALID"}';END;
 IF limit_n NOT BETWEEN 1 AND 100 OR offset_n NOT BETWEEN 0 AND 100000 OR (from_at IS NOT NULL AND to_at IS NOT NULL AND from_at>=to_at)
 OR direction_value NOT IN('asc','desc') OR sort_value NOT IN('date','borrower','item','laboratory','status','quantity')
 OR (p?'kind' AND p->>'kind' NOT IN('RETURNABLE','CONSUMABLE')) OR (p?'scope' AND p->>'scope' NOT IN('operations','security'))
 THEN RETURN '{"status":422,"code":"INVALID"}';END IF;

 IF report_name IN('borrowing','overdue') THEN
  WITH source AS (
   SELECT n.id,n.issued_at AS date,u.display_name borrower,u.registration_number AS "registrationNumber",b.id AS "batchId",b.name batch,
    i.name item,c.name category,i.kind,l.name laboratory,loc.name location,n.quantity,n.returned,n.due_at AS "dueAt",
    issuer.display_name AS "technicalOfficer",req.purpose,
    CASE WHEN n.returned>=n.quantity THEN 'RETURNED' WHEN n.due_at<clock_timestamp() THEN 'OVERDUE' ELSE 'BORROWED' END status
   FROM lab.lend_loans n JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines ln ON ln.id=a.line_id
   JOIN lab.lend_requests req ON req.id=ln.request_id JOIN lab.users u ON u.id=n.borrower_id LEFT JOIN lab.batches b ON b.id=u.batch_id
   JOIN lab.inv_items i ON i.id=ln.item_id JOIN lab.inv_categories c ON c.id=i.category_id JOIN lab.laboratories l ON l.id=ln.lab_id
   JOIN lab.inv_locations loc ON loc.id=ln.location_id JOIN lab.users issuer ON issuer.id=n.issued_by
   WHERE (report_name<>'overdue' OR (n.returned<n.quantity AND n.due_at<clock_timestamp()))
   AND (p->>'batchId' IS NULL OR u.batch_id=(p->>'batchId')::uuid) AND (p->>'labId' IS NULL OR ln.lab_id=(p->>'labId')::uuid)
   AND (p->>'categoryId' IS NULL OR i.category_id=(p->>'categoryId')::uuid) AND (p->>'itemId' IS NULL OR i.id=(p->>'itemId')::uuid)
   AND (p->>'borrowerId' IS NULL OR u.id=(p->>'borrowerId')::uuid) AND (p->>'officerId' IS NULL OR issuer.id=(p->>'officerId')::uuid)
   AND (p->>'lecturerId' IS NULL OR ln.lecturer_id=(p->>'lecturerId')::uuid) AND (p->>'kind' IS NULL OR i.kind=p->>'kind')
   AND (from_at IS NULL OR n.issued_at>=from_at) AND (to_at IS NULL OR n.issued_at<to_at)
  ), filtered AS (SELECT * FROM source WHERE p->>'status' IS NULL OR status=p->>'status'), numbered AS (
   SELECT *,count(*) OVER() AS full_count,sum(quantity-returned) OVER() AS outstanding_units FROM filtered
   ORDER BY
    CASE WHEN sort_value='borrower' AND direction_value='asc' THEN borrower END ASC,
    CASE WHEN sort_value='borrower' AND direction_value='desc' THEN borrower END DESC,
    CASE WHEN sort_value='item' AND direction_value='asc' THEN item END ASC,
    CASE WHEN sort_value='item' AND direction_value='desc' THEN item END DESC,
    CASE WHEN sort_value='laboratory' AND direction_value='asc' THEN laboratory END ASC,
    CASE WHEN sort_value='laboratory' AND direction_value='desc' THEN laboratory END DESC,
    CASE WHEN sort_value='status' AND direction_value='asc' THEN status END ASC,
    CASE WHEN sort_value='status' AND direction_value='desc' THEN status END DESC,
    CASE WHEN sort_value='quantity' AND direction_value='asc' THEN quantity END ASC,
    CASE WHEN sort_value='quantity' AND direction_value='desc' THEN quantity END DESC,
    CASE WHEN sort_value='date' AND direction_value='asc' THEN date END ASC,
    CASE WHEN sort_value='date' AND direction_value='desc' THEN date END DESC,id
  ) SELECT coalesce(jsonb_agg(to_jsonb(x)-ARRAY['full_count','outstanding_units']),'[]'),coalesce(max(full_count),0),
    jsonb_build_object('records',coalesce(max(full_count),0),'outstandingUnits',coalesce(max(outstanding_units),0))
   INTO rows_value,total_value,metrics_value FROM(SELECT * FROM numbered LIMIT limit_n OFFSET offset_n)x;
 ELSIF report_name='inventory' THEN
  WITH source AS (
   SELECT i.id,i.name item,c.name category,i.kind,i.uom,l.name laboratory,loc.name location,
    sum(cell.quantity) FILTER(WHERE cell.state='AVAILABLE') AS available,sum(cell.quantity) FILTER(WHERE cell.state='RESERVED') AS reserved,
    sum(cell.quantity) FILTER(WHERE cell.state='BORROWED') AS borrowed,sum(cell.quantity) FILTER(WHERE cell.state='INSPECTION') AS inspection,
    sum(cell.quantity) FILTER(WHERE cell.state='MAINTENANCE') AS maintenance,coalesce(pol.policy,'UNCONFIGURED') policy
   FROM lab.inv_items i JOIN lab.inv_categories c ON c.id=i.category_id JOIN lab.inv_cells cell ON cell.item_id=i.id
   JOIN lab.laboratories l ON l.id=cell.lab_id JOIN lab.inv_locations loc ON loc.id=cell.location_id LEFT JOIN lab.lend_policies pol ON pol.item_id=i.id
   WHERE (p->>'labId' IS NULL OR cell.lab_id=(p->>'labId')::uuid) AND (p->>'categoryId' IS NULL OR i.category_id=(p->>'categoryId')::uuid)
   AND (p->>'itemId' IS NULL OR i.id=(p->>'itemId')::uuid) AND (p->>'kind' IS NULL OR i.kind=p->>'kind')
   GROUP BY i.id,i.name,c.name,i.kind,i.uom,l.name,loc.name,pol.policy
  ), numbered AS (SELECT *,count(*) OVER() full_count FROM source
   ORDER BY CASE WHEN sort_value='item' THEN item END,CASE WHEN sort_value='laboratory' THEN laboratory END,item,laboratory,location)
  SELECT coalesce(jsonb_agg(to_jsonb(x)-'full_count'),'[]'),coalesce(max(full_count),0),jsonb_build_object('positions',coalesce(max(full_count),0))
  INTO rows_value,total_value,metrics_value FROM(SELECT * FROM numbered LIMIT limit_n OFFSET offset_n)x;
 ELSIF report_name='approvals' THEN
  WITH source AS (
   SELECT d.id,d.created_at AS date,borrower.display_name borrower,borrower.registration_number AS "registrationNumber",b.name batch,
    i.name item,lab.name laboratory,ln.quantity,ln.policy,d.stage,d.decision,d.remarks,approver.display_name approver,req.purpose
   FROM lab.lend_decisions d JOIN lab.lend_lines ln ON ln.id=d.line_id JOIN lab.lend_requests req ON req.id=ln.request_id
   JOIN lab.users borrower ON borrower.id=req.borrower_id LEFT JOIN lab.batches b ON b.id=borrower.batch_id JOIN lab.users approver ON approver.id=d.actor_id
   JOIN lab.inv_items i ON i.id=ln.item_id JOIN lab.inv_categories c ON c.id=i.category_id JOIN lab.laboratories lab ON lab.id=ln.lab_id
   WHERE (p->>'batchId' IS NULL OR borrower.batch_id=(p->>'batchId')::uuid) AND (p->>'labId' IS NULL OR ln.lab_id=(p->>'labId')::uuid)
   AND (p->>'categoryId' IS NULL OR i.category_id=(p->>'categoryId')::uuid) AND (p->>'itemId' IS NULL OR i.id=(p->>'itemId')::uuid)
   AND (p->>'borrowerId' IS NULL OR borrower.id=(p->>'borrowerId')::uuid) AND (p->>'lecturerId' IS NULL OR (d.stage='LECTURER' AND d.actor_id=(p->>'lecturerId')::uuid)) AND (p->>'stage' IS NULL OR d.stage=p->>'stage')
   AND (p->>'status' IS NULL OR d.decision=p->>'status') AND (from_at IS NULL OR d.created_at>=from_at) AND (to_at IS NULL OR d.created_at<to_at)
  ), numbered AS (SELECT *,count(*) OVER() full_count FROM source ORDER BY CASE WHEN direction_value='asc' THEN date END ASC,CASE WHEN direction_value='desc' THEN date END DESC,id)
  SELECT coalesce(jsonb_agg(to_jsonb(x)-'full_count'),'[]'),coalesce(max(full_count),0),jsonb_build_object('decisions',coalesce(max(full_count),0))
  INTO rows_value,total_value,metrics_value FROM(SELECT * FROM numbered LIMIT limit_n OFFSET offset_n)x;
 ELSE
  WITH source AS (
   SELECT a.id,a.occurred_at AS date,a.action,u.display_name actor,a.target_id AS "targetId",a.details,
    CASE WHEN a.action IN('LOGIN','LOGOUT','LOGIN_DENIED','GOVERNANCE_DENIED','LENDING_DENIED','INVENTORY_DENIED','REQUEST_DENIED','REPORT_VIEW') OR a.action LIKE 'IDENTITY_%' OR a.action LIKE '%_USER' THEN 'security' ELSE 'operations' END scope
   FROM lab.audit a LEFT JOIN lab.users u ON u.id=a.actor_id
   WHERE (from_at IS NULL OR a.occurred_at>=from_at) AND (to_at IS NULL OR a.occurred_at<to_at)
  ), filtered AS (SELECT * FROM source WHERE (p->>'scope' IS NULL OR scope=p->>'scope') AND (p->>'status' IS NULL OR action=p->>'status')),
  numbered AS (SELECT *,count(*) OVER() full_count FROM filtered ORDER BY CASE WHEN direction_value='asc' THEN date END ASC,CASE WHEN direction_value='desc' THEN date END DESC,id)
  SELECT coalesce(jsonb_agg(to_jsonb(x)-'full_count'),'[]'),coalesce(max(full_count),0),jsonb_build_object('events',coalesce(max(full_count),0))
  INTO rows_value,total_value,metrics_value FROM(SELECT * FROM numbered LIMIT limit_n OFFSET offset_n)x;
 END IF;
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),actor,'REPORT_VIEW',jsonb_build_object('report',report_name,'filters',p-'offset'));
 RETURN jsonb_build_object('report',report_name,'items',rows_value,'total',total_value,'limit',limit_n,'offset',offset_n,'metrics',metrics_value);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('status',422,'code','INVALID');
END $$;

ALTER FUNCTION lab.admin_report(text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.admin_report(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.admin_report(text,text,jsonb) TO lab_runtime;
COMMIT;
