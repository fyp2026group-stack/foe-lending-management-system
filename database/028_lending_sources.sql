BEGIN;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) RENAME TO lending_call_v3;
REVOKE ALL ON FUNCTION lab.lending_call_v3(text,text,text,jsonb) FROM PUBLIC,lab_runtime;
CREATE FUNCTION lab.lending_call(token text,csrf text,op text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid; result jsonb;
BEGIN
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id
 WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled
 AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes'
 AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=u.id);
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 IF op='read_sources' THEN
  -- Only the anonymous AVAILABLE pool can currently be reserved by lending.
  -- Aggregate before exposing a deliberately narrow borrower DTO.
  SELECT coalesce(jsonb_agg(x ORDER BY x.item,x.lab,x.location),'[]') INTO result FROM(
   SELECT i.id AS "itemId",i.name item,i.kind,i.uom,b.id AS "labId",b.name lab,
    l.id AS "locationId",l.name location,sum(c.quantity) AS "availableQuantity",q.policy
   FROM lab.inv_cells c JOIN lab.inv_items i ON i.id=c.item_id
   JOIN lab.laboratories b ON b.id=c.lab_id JOIN lab.inv_locations l ON l.id=c.location_id AND l.lab_id=c.lab_id
   JOIN lab.lend_policies q ON q.item_id=i.id
   WHERE c.state='AVAILABLE' AND c.asset_id IS NULL AND c.quantity>0
   AND (p->>'labId' IS NULL OR b.id=(p->>'labId')::uuid)
   AND (q.policy NOT IN('HOD','BOTH') OR EXISTS(SELECT 1 FROM lab.users h JOIN lab.user_roles hr ON hr.user_id=h.id
    WHERE h.id=q.hod_id AND h.id<>actor AND NOT h.disabled AND hr.role='ADMIN'))
   AND (q.policy NOT IN('LECTURER','BOTH') OR EXISTS(SELECT 1 FROM lab.users t JOIN lab.user_roles tr ON tr.user_id=t.id
    JOIN lab.staff_labs s ON s.user_id=t.id WHERE tr.role='LECTURER' AND NOT t.disabled AND t.id<>actor
    AND s.laboratory_id=c.lab_id AND (q.policy<>'BOTH' OR t.id<>q.hod_id)))
   GROUP BY i.id,b.id,l.id,q.policy)x;
  RETURN jsonb_build_object('items',result);
 ELSIF op='read_lecturers' THEN
  SELECT coalesce(jsonb_agg(x ORDER BY x."displayName",x.id),'[]') INTO result FROM(
   SELECT u.id,u.display_name AS "displayName",jsonb_agg(s.laboratory_id ORDER BY s.laboratory_id) AS "labIds"
   FROM lab.users u JOIN lab.staff_labs s ON s.user_id=u.id
   WHERE NOT u.disabled AND u.id<>actor AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=u.id AND r.role='LECTURER')
   AND (p->>'labId' IS NULL OR EXISTS(SELECT 1 FROM lab.staff_labs f WHERE f.user_id=u.id AND f.laboratory_id=(p->>'labId')::uuid))
   GROUP BY u.id)x;
  RETURN jsonb_build_object('items',result);
 ELSIF op='requests' AND p->>'lecturerId' IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM lab.sessions s WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex')
   AND s.csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
  -- A supplied lecturer must be eligible in every requested lab, even on a
  -- mixed-policy request. Replay and all writes remain in the protected writer.
  IF jsonb_typeof(p->'lines') IS DISTINCT FROM 'array' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'lines') v WHERE NOT EXISTS(
   SELECT 1 FROM lab.users u JOIN lab.staff_labs s ON s.user_id=u.id
   WHERE u.id=(p->>'lecturerId')::uuid AND NOT u.disabled AND u.id<>actor
   AND s.laboratory_id=(v->>'labId')::uuid
   AND EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=u.id AND r.role='LECTURER')))
   THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 END IF;
 RETURN lab.lending_call_v3(token,csrf,op,p);
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN RETURN '{"status":422,"code":"INVALID"}';
END $$;
ALTER FUNCTION lab.lending_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lending_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.lending_call(text,text,text,jsonb) TO lab_runtime;
COMMIT;
