BEGIN;
CREATE OR REPLACE FUNCTION lab.admin_governance(token text,csrf text,op text,target uuid,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;roles text[];body jsonb;result jsonb;idvalue uuid;batchids uuid[]:='{}';role_values text[];before_value jsonb;
BEGIN
 SELECT u.id,array_agg(r.role) INTO actor,roles FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id JOIN lab.user_roles r ON r.user_id=u.id
 WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp()
 AND s.last_seen_at>clock_timestamp()-interval '30 minutes' GROUP BY u.id;
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 IF NOT coalesce('ADMIN'=ANY(roles),false) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 IF op NOT LIKE 'read_%' AND NOT EXISTS(SELECT 1 FROM lab.sessions WHERE token_hash=encode(public.digest(token,'sha256'),'hex') AND csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 IF op='read_users' THEN
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x."displayName",x.id),'[]')) INTO result FROM(
   SELECT u.id,u.email,u.display_name AS "displayName",u.disabled,u.batch_id AS "batchId",u.registration_number AS "registrationNumber",
    ARRAY(SELECT role FROM lab.user_roles WHERE user_id=u.id ORDER BY role) roles,
    ARRAY(SELECT laboratory_id FROM lab.staff_labs WHERE user_id=u.id ORDER BY laboratory_id) AS "laboratoryIds",
    ARRAY(SELECT batch_id FROM lab.user_batch_memberships WHERE user_id=u.id AND ended_at IS NULL ORDER BY batch_id) AS "batchIds",
    (SELECT coalesce(jsonb_agg(jsonb_build_object('batchId',m.batch_id,'startedAt',m.started_at,'endedAt',m.ended_at) ORDER BY m.started_at),'[]') FROM lab.user_batch_memberships m WHERE m.user_id=u.id) AS "batchHistory"
   FROM lab.users u)x;RETURN result;
 ELSIF op='read_batches' THEN
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x.name,x.id),'[]')) INTO result FROM(
   SELECT b.id,b.name,b.active,count(m.user_id) FILTER(WHERE m.ended_at IS NULL) AS "membershipCount" FROM lab.batches b LEFT JOIN lab.user_batch_memberships m ON m.batch_id=b.id GROUP BY b.id)x;RETURN result;
 ELSIF op='read_laboratories' THEN
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(x ORDER BY x.name,x.id),'[]')) INTO result FROM(
   SELECT l.id,l.name,l.active,count(s.user_id) AS "staffCount",count(loc.id) AS "locationCount" FROM lab.laboratories l
   LEFT JOIN lab.staff_labs s ON s.laboratory_id=l.id LEFT JOIN lab.inv_locations loc ON loc.lab_id=l.id GROUP BY l.id)x;RETURN result;
 END IF;
 IF op IN('create_user','patch_user') THEN
  IF jsonb_typeof(p->'batchIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'batchIds')>100 THEN RETURN '{"status":422,"code":"INVALID_BATCHES"}';END IF;
  BEGIN SELECT coalesce(array_agg(value::uuid),'{}') INTO batchids FROM jsonb_array_elements_text(p->'batchIds');EXCEPTION WHEN OTHERS THEN RETURN '{"status":422,"code":"INVALID_BATCHES"}';END;
  IF cardinality(batchids)<>(SELECT count(DISTINCT value) FROM unnest(batchids)value) OR EXISTS(SELECT 1 FROM unnest(batchids)b LEFT JOIN lab.batches x ON x.id=b WHERE x.id IS NULL OR NOT x.active) THEN RETURN '{"status":422,"code":"INVALID_BATCHES"}';END IF;
  SELECT array_agg(value) INTO role_values FROM jsonb_array_elements_text(p->'roles');
  IF 'STUDENT'=ANY(role_values) AND cardinality(batchids)=0 THEN RETURN '{"status":422,"code":"STUDENT_BATCH_REQUIRED"}';END IF;
  IF op='patch_user' AND target=actor THEN RETURN '{"status":403,"code":"SELF_CHANGE"}';END IF;
  IF op='patch_user' AND ((p?'displayName' AND length(trim(p->>'displayName')) NOT BETWEEN 1 AND 120) OR ('STUDENT'=ANY(role_values) AND length(trim(p->>'registrationNumber')) NOT BETWEEN 1 AND 80)) THEN RETURN '{"status":422,"code":"INVALID_PROFILE"}';END IF;
  IF op='create_user' THEN body:=(p-'batchIds')||jsonb_build_object('batchId',batchids[1]);
  ELSE body:=p-ARRAY['batchIds','displayName','registrationNumber','email','passwordHash','batchId'];END IF;
  result:=lab.identity_call(token,csrf,op,CASE WHEN op='patch_user' THEN target ELSE NULL END,body);
  IF result?'status' THEN RETURN result;END IF;idvalue:=(result->>'id')::uuid;
  IF op='patch_user' THEN
   IF target=actor THEN RETURN '{"status":403,"code":"SELF_CHANGE"}';END IF;
   SELECT jsonb_build_object('displayName',display_name,'registrationNumber',registration_number,'batchIds',ARRAY(SELECT batch_id FROM lab.user_batch_memberships WHERE user_id=target AND ended_at IS NULL)) INTO before_value FROM lab.users WHERE id=target;
   UPDATE lab.users SET display_name=coalesce(NULLIF(trim(p->>'displayName'),''),display_name),registration_number=CASE WHEN p?'registrationNumber' THEN NULLIF(trim(p->>'registrationNumber'),'') ELSE registration_number END,batch_id=batchids[1] WHERE id=target;
  END IF;
  UPDATE lab.user_batch_memberships SET ended_at=clock_timestamp(),changed_by=actor WHERE user_id=idvalue AND ended_at IS NULL AND NOT(batch_id=ANY(batchids));
  INSERT INTO lab.user_batch_memberships(user_id,batch_id,changed_by) SELECT idvalue,b,actor FROM unnest(batchids)b
   WHERE NOT EXISTS(SELECT 1 FROM lab.user_batch_memberships m WHERE m.user_id=idvalue AND m.batch_id=b AND m.ended_at IS NULL);
  INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),actor,'GOVERNANCE_BATCH_MEMBERSHIPS',idvalue,jsonb_build_object('before',before_value,'batchIds',batchids));
  RETURN result;
 ELSIF op IN('create_batch','create_laboratory') THEN RETURN lab.identity_call(token,csrf,op,NULL,p);
 ELSIF op IN('patch_batch','patch_laboratory') THEN
  IF target IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p)k WHERE k NOT IN('name','active')) OR NOT p?'active' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
  IF p?'name' AND length(trim(p->>'name')) NOT BETWEEN 1 AND 120 THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
  IF op='patch_batch' THEN
   IF NOT EXISTS(SELECT 1 FROM lab.batches WHERE id=target) THEN RETURN '{"status":404,"code":"NOT_FOUND"}';END IF;
   IF NOT (p->>'active')::boolean AND EXISTS(SELECT 1 FROM lab.user_batch_memberships WHERE batch_id=target AND ended_at IS NULL) THEN RETURN '{"status":409,"code":"ACTIVE_MEMBERSHIPS"}';END IF;
   UPDATE lab.batches SET name=coalesce(NULLIF(trim(p->>'name'),''),name),active=(p->>'active')::boolean WHERE id=target RETURNING jsonb_build_object('id',id,'name',name,'active',active) INTO result;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM lab.laboratories WHERE id=target) THEN RETURN '{"status":404,"code":"NOT_FOUND"}';END IF;
   IF NOT (p->>'active')::boolean AND (EXISTS(SELECT 1 FROM lab.staff_labs WHERE laboratory_id=target) OR EXISTS(SELECT 1 FROM lab.inv_cells WHERE lab_id=target AND quantity>0)) THEN RETURN '{"status":409,"code":"ACTIVE_LAB_REFERENCES"}';END IF;
   UPDATE lab.laboratories SET name=coalesce(NULLIF(trim(p->>'name'),''),name),active=(p->>'active')::boolean WHERE id=target RETURNING jsonb_build_object('id',id,'name',name,'active',active) INTO result;
  END IF;
  INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),actor,upper(op),target,p);RETURN result;
 END IF;
 RETURN '{"status":404,"code":"NOT_FOUND"}';
EXCEPTION WHEN unique_violation THEN RETURN '{"status":409,"code":"CONFLICT"}';WHEN OTHERS THEN RETURN '{"status":422,"code":"INVALID"}';END $$;

ALTER FUNCTION lab.admin_governance(text,text,text,uuid,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.admin_governance(text,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.admin_governance(text,text,text,uuid,jsonb) TO lab_runtime;
COMMIT;
