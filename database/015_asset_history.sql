CREATE OR REPLACE FUNCTION lab.inventory_call(token text,csrf text,op text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,public,pg_temp AS $$
DECLARE actor uuid;roles text[];admin boolean;labid uuid;item uuid;loc uuid;asset uuid;src uuid;dst uuid;movement uuid;id_value uuid;cmd uuid;old lab.inv_commands;adjustment lab.inv_adjustments;stage lab.inv_imports;row_value jsonb;result jsonb;allowed text[];q integer;v integer;limit_n integer;offset_n integer;query text;serial_value text;from_pool text;to_pool text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(731942);
 SELECT u.id INTO actor FROM lab.sessions s JOIN lab.users u ON u.id=s.user_id WHERE s.token_hash=encode(public.digest(token,'sha256'),'hex') AND NOT s.revoked AND NOT u.disabled AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-interval '30 minutes';
 IF actor IS NULL THEN RETURN '{"status":401,"code":"UNAUTHENTICATED"}';END IF;
 SELECT array_agg(role) INTO roles FROM lab.user_roles WHERE user_id=actor;
 IF NOT coalesce(roles&&ARRAY['ADMIN','STUDENT','LECTURER','TECHNICAL_OFFICER'],false) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 admin:=coalesce('ADMIN'=ANY(roles),false);
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 IF op LIKE 'read_%' THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('limit','offset','q','labId','itemId','categoryId','kind','assetId')) THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 limit_n:=coalesce((p->>'limit')::integer,20);offset_n:=coalesce((p->>'offset')::integer,0);query:=coalesce(p->>'q','');
 IF limit_n NOT BETWEEN 1 AND 100 OR offset_n NOT BETWEEN 0 AND 10000 OR length(query)>120 THEN RETURN '{"status":422,"code":"INVALID"}';END IF;
 labid:=(p->>'labId')::uuid;item:=(p->>'itemId')::uuid;
 IF op='read_categories' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,name FROM lab.inv_categories WHERE name ILIKE '%'||query||'%' ORDER BY id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_items' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT a.*,(SELECT coalesce(sum(quantity),0) FROM lab.inv_cells c WHERE c.item_id=a.id AND c.state='AVAILABLE' AND (labid IS NULL OR c.lab_id=labid)) AS available FROM lab.inv_items a WHERE a.name ILIKE '%'||query||'%' AND (item IS NULL OR a.id=item) AND (p->>'categoryId' IS NULL OR a.category_id=(p->>'categoryId')::uuid) AND (p->>'kind' IS NULL OR a.kind=p->>'kind') ORDER BY a.id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_locations' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT l.* FROM lab.inv_locations l WHERE (labid IS NULL OR l.lab_id=labid) AND (admin OR EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=l.lab_id)) AND l.name ILIKE '%'||query||'%' ORDER BY l.id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_stock' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT c.* FROM lab.inv_cells c WHERE (labid IS NULL OR c.lab_id=labid) AND (item IS NULL OR c.item_id=item) AND (admin OR ('TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=c.lab_id))) ORDER BY c.id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_assets' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT a.*,c.state,c.location_id,c.version FROM lab.inv_assets a JOIN lab.inv_cells c ON c.asset_id=a.id AND c.quantity=1 WHERE (labid IS NULL OR a.lab_id=labid) AND (item IS NULL OR a.item_id=item) AND (admin OR ('TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=a.lab_id))) AND (a.id::text ILIKE '%'||query||'%' OR coalesce(a.serial,'') ILIKE '%'||query||'%') ORDER BY a.id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_movements' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT m.*,(SELECT jsonb_agg(jsonb_build_object('cell_id',e.cell_id,'account',e.account,'delta',e.delta)) FROM lab.inv_entries e WHERE e.movement_id=m.id) AS entries FROM lab.inv_movements m WHERE (p->>'assetId' IS NULL OR EXISTS(SELECT 1 FROM lab.inv_entries ae JOIN lab.inv_cells ac ON ac.id=ae.cell_id WHERE ae.movement_id=m.id AND ac.asset_id=(p->>'assetId')::uuid)) AND (labid IS NULL OR m.lab_id=labid) AND (item IS NULL OR m.item_id=item) AND (admin OR ('TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=m.lab_id))) ORDER BY m.id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_adjustments' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT a.* FROM lab.inv_adjustments a WHERE (labid IS NULL OR a.lab_id=labid) AND (admin OR (a.proposer=actor AND 'TECHNICAL_OFFICER'=ANY(roles) AND EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=a.lab_id))) ORDER BY a.id LIMIT limit_n OFFSET offset_n)x;
 ELSIF op='read_imports' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,committed,jsonb_array_length(rows) AS row_count FROM lab.inv_imports WHERE owner_id=actor ORDER BY id LIMIT limit_n OFFSET offset_n)x;
 ELSE RETURN '{"status":404,"code":"NOT_FOUND"}';END IF;
 RETURN jsonb_build_object('items',result,'limit',limit_n,'offset',offset_n);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.sessions WHERE token_hash=encode(public.digest(token,'sha256'),'hex') AND csrf_hash=encode(public.digest(csrf,'sha256'),'hex')) THEN RETURN '{"status":403,"code":"CSRF_DENIED"}';END IF;
 -- M3 deliberately serializes all inventory writes. Ordered cell locks follow this global inventory gate.
 PERFORM pg_advisory_xact_lock(731943);
 allowed:=CASE op
 WHEN 'categories' THEN ARRAY['commandId','name']
 WHEN 'items' THEN ARRAY['commandId','name','categoryId','kind','assetId','uom']
 WHEN 'locations' THEN ARRAY['commandId','labId','name']
 WHEN 'receipts' THEN ARRAY['commandId','itemId','labId','locationId','quantity','provenance']
 WHEN 'assets' THEN ARRAY['commandId','itemId','labId','locationId','expectedVersion','serial']
 WHEN 'stock' THEN ARRAY['commandId','itemId','labId','locationId','expectedVersion','fromState','toState','quantity','assetId']
 WHEN 'adjustments' THEN ARRAY['commandId','itemId','labId','locationId','expectedVersion','quantity','direction','reason']
 WHEN 'approve' THEN ARRAY['commandId','id']
 WHEN 'preview' THEN ARRAY['commandId','rows']
 WHEN 'commit' THEN ARRAY['commandId','id'] ELSE NULL END;
 IF allowed IS NULL THEN RETURN '{"status":404,"code":"NOT_FOUND"}';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed)) THEN RETURN '{"status":422,"code":"UNSUPPORTED_FIELD"}';END IF;
 cmd:=(p->>'commandId')::uuid;IF cmd IS NULL THEN RETURN '{"status":422,"code":"COMMAND_REQUIRED"}';END IF;
 labid:=(p->>'labId')::uuid;item:=(p->>'itemId')::uuid;loc:=(p->>'locationId')::uuid;
 IF op IN ('categories','items','locations','approve') THEN
 IF NOT admin THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 ELSIF op NOT IN('preview','commit') THEN
 IF NOT coalesce('TECHNICAL_OFFICER'=ANY(roles),false) OR NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=labid) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 END IF;
 IF op IN('preview','commit') AND NOT coalesce('TECHNICAL_OFFICER'=ANY(roles),false) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;
 -- Replay still validates current row scope below for batch/approval effects.
 IF op='commit' THEN SELECT * INTO stage FROM lab.inv_imports WHERE id=(p->>'id')::uuid AND owner_id=actor;IF NOT FOUND THEN RETURN '{"status":404,"code":"NOT_FOUND"}';END IF;
 FOR row_value IN SELECT value FROM jsonb_array_elements(stage.rows) LOOP IF NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=(row_value->>'labId')::uuid) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;END LOOP;
 END IF;
 IF op='preview' AND jsonb_typeof(p->'rows')='array' THEN FOR row_value IN SELECT value FROM jsonb_array_elements(p->'rows') LOOP IF NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=(row_value->>'labId')::uuid) THEN RETURN '{"status":403,"code":"DENIED"}';END IF;END LOOP;END IF;
 SELECT * INTO old FROM lab.inv_commands WHERE actor_id=actor AND command_id=cmd;
 IF FOUND THEN IF old.operation<>op OR old.payload<>p THEN RETURN '{"status":409,"code":"IDENTITY_CONFLICT"}';END IF;RETURN old.result;END IF;
 BEGIN
 IF op IN('categories','items','locations') THEN
 IF jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(trim(p->>'name')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'INVALID';END IF;
 id_value:=gen_random_uuid();
 IF op='categories' THEN INSERT INTO lab.inv_categories VALUES(id_value,trim(p->>'name'));
 ELSIF op='items' THEN INSERT INTO lab.inv_items VALUES(id_value,(p->>'categoryId')::uuid,trim(p->>'name'),p->>'kind',p->>'uom');
 ELSE INSERT INTO lab.inv_locations VALUES(id_value,labid,trim(p->>'name'));END IF;
 result:=jsonb_build_object('id',id_value);
 INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),actor,'INVENTORY_CREATE_'||upper(op),id_value);
 ELSIF op='receipts' THEN movement:=lab.inv_receive(actor,p);result:=jsonb_build_object('movementId',movement);
 ELSIF op IN('assets','stock','adjustments') THEN
 from_pool:=CASE WHEN op='stock' THEN p->>'fromState' ELSE 'AVAILABLE' END;
 asset:=(p->>'assetId')::uuid;
 IF from_pool NOT IN('AVAILABLE','INSPECTION','MAINTENANCE') OR from_pool IS NULL THEN RAISE EXCEPTION 'INVALID';END IF;
 src:=lab.inv_cell(item,labid,loc,asset,from_pool);
 SELECT version INTO v FROM lab.inv_cells WHERE id=src FOR UPDATE;
 IF p->>'expectedVersion' IS NULL OR v<>(p->>'expectedVersion')::integer THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 IF op='assets' THEN
 IF NOT EXISTS(SELECT 1 FROM lab.inv_items WHERE id=item AND kind='RETURNABLE') THEN RAISE EXCEPTION 'INVALID';END IF;
 serial_value:=NULLIF(upper(trim(p->>'serial')),'');
 IF serial_value IS NOT NULL AND serial_value!~'^[ -~]+$' THEN RAISE EXCEPTION 'INVALID';END IF;
 asset:=gen_random_uuid();INSERT INTO lab.inv_assets(id,item_id,lab_id,serial) VALUES(asset,item,labid,serial_value);
 dst:=lab.inv_cell(item,labid,loc,asset,'AVAILABLE');
 movement:=lab.inv_post(actor,item,labid,src,dst,1,'MATERIALIZE','zero-net permanent identity conversion');
 result:=jsonb_build_object('assetId',asset,'movementId',movement);
 ELSIF op='stock' THEN
 to_pool:=p->>'toState';
 IF to_pool IS NULL OR to_pool NOT IN('AVAILABLE','INSPECTION','MAINTENANCE') OR to_pool=from_pool OR NOT EXISTS(SELECT 1 FROM lab.inv_items WHERE id=item AND kind='RETURNABLE') THEN RAISE EXCEPTION 'INVALID';END IF;
 IF jsonb_typeof(p->'quantity') IS DISTINCT FROM 'number' OR (p->>'quantity')!~'^[1-9][0-9]*$' THEN RAISE EXCEPTION 'INVALID';END IF;
 q:=(p->>'quantity')::integer;IF asset IS NOT NULL AND q<>1 THEN RAISE EXCEPTION 'INVALID';END IF;
 dst:=lab.inv_cell(item,labid,loc,asset,to_pool);movement:=lab.inv_post(actor,item,labid,src,dst,q,'STATE_CHANGE',from_pool||' to '||to_pool);
 result:=jsonb_build_object('movementId',movement);
 ELSE
 IF jsonb_typeof(p->'quantity') IS DISTINCT FROM 'number' OR (p->>'quantity')!~'^[1-9][0-9]*$' THEN RAISE EXCEPTION 'INVALID';END IF;
 id_value:=gen_random_uuid();INSERT INTO lab.inv_adjustments(id,proposer,item_id,lab_id,location_id,quantity,direction,reason,expected_version) VALUES(id_value,actor,item,labid,loc,(p->>'quantity')::integer,p->>'direction',p->>'reason',v);
 INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),actor,'INVENTORY_ADJUSTMENT_PROPOSE',id_value);result:=jsonb_build_object('id',id_value);
 END IF;
 ELSIF op='approve' THEN
 SELECT * INTO adjustment FROM lab.inv_adjustments WHERE id=(p->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF adjustment.proposer=actor THEN RAISE EXCEPTION 'SELF_APPROVAL';END IF;
 IF adjustment.state<>'PENDING' THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 src:=lab.inv_cell(adjustment.item_id,adjustment.lab_id,adjustment.location_id,NULL,'AVAILABLE');
 IF (SELECT version FROM lab.inv_cells WHERE id=src)<>adjustment.expected_version THEN RAISE EXCEPTION 'STALE_VERSION';END IF;
 movement:=lab.inv_post(actor,adjustment.item_id,adjustment.lab_id,CASE WHEN adjustment.direction='REMOVE' THEN src ELSE NULL END,CASE WHEN adjustment.direction='ADD' THEN src ELSE NULL END,adjustment.quantity,'ADJUSTMENT',adjustment.reason);
 UPDATE lab.inv_adjustments SET state='APPROVED',approver=actor,movement_id=movement WHERE id=adjustment.id;
 result:=jsonb_build_object('id',adjustment.id,'movementId',movement);
 ELSIF op='preview' THEN
 IF jsonb_typeof(p->'rows') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'rows') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID';END IF;
 FOR row_value IN SELECT value FROM jsonb_array_elements(p->'rows') LOOP
 IF jsonb_typeof(row_value)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(row_value) k WHERE k NOT IN('itemId','labId','locationId','quantity','provenance')) THEN RAISE EXCEPTION 'INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=(row_value->>'labId')::uuid) THEN RAISE EXCEPTION 'DENIED';END IF;
 IF NOT EXISTS(SELECT 1 FROM lab.inv_items WHERE id=(row_value->>'itemId')::uuid) OR NOT EXISTS(SELECT 1 FROM lab.inv_locations WHERE id=(row_value->>'locationId')::uuid AND lab_id=(row_value->>'labId')::uuid) OR jsonb_typeof(row_value->'quantity') IS DISTINCT FROM 'number' OR (row_value->>'quantity')!~'^[1-9][0-9]*$' OR (row_value->>'quantity')::integer NOT BETWEEN 1 AND 1000000 OR length(trim(row_value->>'provenance')) NOT BETWEEN 1 AND 200 OR row_value->>'provenance' IS NULL THEN RAISE EXCEPTION 'INVALID';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'rows') r GROUP BY r->>'itemId',r->>'labId',trim(r->>'provenance') HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_ROW';END IF;
 id_value:=gen_random_uuid();INSERT INTO lab.inv_imports VALUES(id_value,actor,p->'rows',false);
 INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),actor,'INVENTORY_IMPORT_PREVIEW',id_value);
 result:=jsonb_build_object('id',id_value,'rowCount',jsonb_array_length(p->'rows'),'rows',p->'rows');
 ELSIF op='commit' THEN
 IF stage.committed THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 FOR row_value IN SELECT value FROM jsonb_array_elements(stage.rows) LOOP PERFORM lab.inv_receive(actor,row_value);END LOOP;
 UPDATE lab.inv_imports SET committed=true WHERE id=stage.id;
 result:=jsonb_build_object('id',stage.id,'rowCount',jsonb_array_length(stage.rows));
 END IF;
 INSERT INTO lab.inv_commands VALUES(actor,cmd,op,p,result);
 RETURN result;
 EXCEPTION WHEN OTHERS THEN
 INSERT INTO lab.audit(id,actor_id,action,details) VALUES(gen_random_uuid(),actor,'INVENTORY_DENIED',jsonb_build_object('operation',op,'sqlstate',SQLSTATE));
 RETURN jsonb_build_object('status',CASE WHEN SQLERRM IN('DENIED','SELF_APPROVAL') THEN 403 WHEN SQLERRM='NOT_FOUND' THEN 404 WHEN SQLERRM IN('STALE_VERSION','INSUFFICIENT_STOCK','STATE_CONFLICT') OR SQLSTATE='23505' THEN 409 ELSE 422 END,'code',CASE WHEN SQLERRM IN('DENIED','SELF_APPROVAL','NOT_FOUND','STALE_VERSION','INSUFFICIENT_STOCK','STATE_CONFLICT','DUPLICATE_ROW') THEN SQLERRM WHEN SQLSTATE='23505' THEN 'DUPLICATE' ELSE 'INVALID' END);
 END;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN '{"status":422,"code":"INVALID"}';
END $$;
ALTER FUNCTION lab.inventory_call(text,text,text,jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.inventory_call(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lab.inventory_call(text,text,text,jsonb) TO lab_runtime;




