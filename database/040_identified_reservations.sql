BEGIN;
CREATE TABLE lab.lend_reserved_assets(allocation_id uuid NOT NULL REFERENCES lab.lend_allocations(id),asset_id uuid NOT NULL REFERENCES lab.inv_assets(id),cell_id uuid NOT NULL REFERENCES lab.inv_cells(id),released boolean NOT NULL DEFAULT false,PRIMARY KEY(allocation_id,asset_id));
CREATE UNIQUE INDEX lend_reserved_identity ON lab.lend_reserved_assets(asset_id) WHERE NOT released;
ALTER TABLE lab.lend_reserved_assets OWNER TO lab_identity_functions;
REVOKE ALL ON lab.lend_reserved_assets FROM PUBLIC,lab_runtime;
CREATE OR REPLACE FUNCTION lab.lend_reserve(actor uuid,lineid uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $$
DECLARE l lab.lend_lines;a lab.lend_allocations;c lab.inv_cells;src uuid;dst uuid;q integer;anon integer;remaining integer;movement uuid;
BEGIN
 SELECT * INTO l FROM lab.lend_lines WHERE id=lineid FOR UPDATE;
 IF l.stage IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 SELECT * INTO a FROM lab.lend_allocations WHERE line_id=l.id;
 IF FOUND THEN RETURN jsonb_build_object('allocationId',a.id);END IF;
 q:=l.quantity-l.cancelled;
 IF q<=0 OR (SELECT coalesce(sum(quantity),0) FROM lab.inv_cells WHERE item_id=l.item_id AND lab_id=l.lab_id AND location_id=l.location_id AND state='AVAILABLE')<q THEN RETURN jsonb_build_object('awaitingStock',true);END IF;
 src:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'AVAILABLE');dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,'RESERVED');
 anon:=least(q,(SELECT quantity FROM lab.inv_cells WHERE id=src));
 IF anon>0 THEN movement:=lab.inv_post(actor,l.item_id,l.lab_id,src,dst,anon,'RESERVE','approved lending request');END IF;
 INSERT INTO lab.lend_allocations(id,line_id,cell_id,quantity) VALUES(gen_random_uuid(),l.id,dst,q) RETURNING * INTO a;
 remaining:=q-anon;
 FOR c IN SELECT * FROM lab.inv_cells WHERE item_id=l.item_id AND lab_id=l.lab_id AND location_id=l.location_id AND state='AVAILABLE' AND asset_id IS NOT NULL AND quantity=1 ORDER BY asset_id LIMIT remaining FOR UPDATE LOOP
  dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,c.asset_id,'RESERVED');
  movement:=lab.inv_post(actor,l.item_id,l.lab_id,c.id,dst,1,'RESERVE','identified lending reservation');
  INSERT INTO lab.lend_reserved_assets VALUES(a.id,c.asset_id,dst,false);
 END LOOP;
 RETURN jsonb_build_object('allocationId',a.id,'movementId',movement);
END $$;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'asset:=coalesce((p->>''assetId'')::uuid,c.asset_id);',
 'asset:=coalesce((p->>''assetId'')::uuid,c.asset_id,CASE WHEN c.quantity=0 THEN (SELECT ra.asset_id FROM lab.lend_reserved_assets ra WHERE ra.allocation_id=a.id AND NOT ra.released ORDER BY ra.asset_id LIMIT 1) END);');
 definition:=replace(definition,'state=''RESERVED'' AND id=a.cell_id',
 'state=''RESERVED'' AND (id=a.cell_id OR EXISTS(SELECT 1 FROM lab.lend_reserved_assets ra WHERE ra.allocation_id=a.id AND ra.asset_id=asset AND NOT ra.released))');
 definition:=replace(definition,'ac.id=a.cell_id)',
 '(ac.id=a.cell_id OR EXISTS(SELECT 1 FROM lab.lend_reserved_assets ra WHERE ra.allocation_id=a.id AND ra.asset_id=ac.asset_id AND NOT ra.released)))');
 definition:=replace(definition,'movement:=lab.inv_post(actor,l.item_id,l.lab_id,c.id,dst,q,''ISSUE''',
 'UPDATE lab.lend_reserved_assets SET released=true WHERE allocation_id=a.id AND asset_id=asset;'||chr(10)||'  movement:=lab.inv_post(actor,l.item_id,l.lab_id,c.id,dst,q,''ISSUE''');
 definition:=replace(definition,'IF ins.status<>''UNRESOLVED'' OR c.state<>''INSPECTION''',
 'IF c.id IS NULL OR ins.status IS DISTINCT FROM ''UNRESOLVED'' OR c.state IS DISTINCT FROM ''INSPECTION''');
 definition:=replace(definition,'IF c.state<>''MAINTENANCE'' OR m.status',
 'IF c.id IS NULL OR c.state IS DISTINCT FROM ''MAINTENANCE'' OR m.status');
 -- Allocation-backed cancellation releases the selected physical reservations,
 -- never substitutes an anonymous identity for identified stock.
 definition:=replace(definition,'IF op NOT IN(''issues'',''returns''',
 'IF op=''cancel'' AND p ? ''lineId'' AND EXISTS(SELECT 1 FROM lab.lend_allocations aa JOIN lab.lend_reserved_assets ra ON ra.allocation_id=aa.id WHERE aa.line_id=(p->>''lineId'')::uuid) THEN
   IF NOT EXISTS(SELECT 1 FROM lab.sessions WHERE token_hash=encode(public.digest(token,''sha256''),''hex'') AND csrf_hash=encode(public.digest(csrf,''sha256''),''hex'')) THEN RETURN ''{"status":403,"code":"CSRF_DENIED"}'';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN(''commandId'',''lineId'',''expectedVersion'',''quantity'',''reason'')) THEN RAISE EXCEPTION ''INVALID'';END IF;
   SELECT * INTO l FROM lab.lend_lines WHERE id=(p->>''lineId'')::uuid FOR UPDATE;
   IF NOT EXISTS(SELECT 1 FROM lab.lend_requests WHERE id=l.request_id AND borrower_id=actor) THEN RAISE EXCEPTION ''DENIED'';END IF;
   cmd:=(p->>''commandId'')::uuid;IF cmd IS NULL THEN RAISE EXCEPTION ''INVALID'';END IF;
   SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
   IF FOUND THEN IF old.operation<>op OR old.payload<>p THEN RAISE EXCEPTION ''IDENTITY_CONFLICT'';END IF;RETURN old.result;END IF;
   IF jsonb_typeof(p->''expectedVersion'') IS DISTINCT FROM ''number'' OR jsonb_typeof(p->''quantity'') IS DISTINCT FROM ''number'' OR (p->>''quantity'')!~''^[1-9][0-9]*$'' OR jsonb_typeof(p->''reason'') IS DISTINCT FROM ''string'' OR length(trim(p->>''reason'')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION ''INVALID'';END IF;
   IF (p->>''expectedVersion'')::integer<>l.version THEN RAISE EXCEPTION ''STALE_VERSION'';END IF;
   SELECT * INTO a FROM lab.lend_allocations WHERE line_id=l.id FOR UPDATE;q:=(p->>''quantity'')::integer;
   IF l.stage NOT IN(''LECTURER'',''HOD'',''APPROVED'') OR q>a.quantity-a.issued-a.cancelled THEN RAISE EXCEPTION ''STATE_CONFLICT'';END IF;
   v:=least(q,(SELECT quantity FROM lab.inv_cells WHERE id=a.cell_id));
   IF v>0 THEN dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,NULL,''AVAILABLE'');PERFORM lab.inv_post(actor,l.item_id,l.lab_id,a.cell_id,dst,v,''CANCEL_RESERVATION'',trim(p->>''reason''));END IF;
   FOR c IN SELECT cc.* FROM lab.inv_cells cc JOIN lab.lend_reserved_assets ra ON ra.cell_id=cc.id WHERE ra.allocation_id=a.id AND NOT ra.released ORDER BY ra.asset_id LIMIT (q-v) FOR UPDATE OF cc LOOP
    dst:=lab.inv_cell(l.item_id,l.lab_id,l.location_id,c.asset_id,''AVAILABLE'');PERFORM lab.inv_post(actor,l.item_id,l.lab_id,c.id,dst,1,''CANCEL_RESERVATION'',trim(p->>''reason''));
    UPDATE lab.lend_reserved_assets SET released=true WHERE allocation_id=a.id AND asset_id=c.asset_id;
   END LOOP;
   UPDATE lab.lend_allocations SET cancelled=cancelled+q WHERE id=a.id;
   UPDATE lab.lend_lines SET cancelled=cancelled+q,stage=CASE WHEN cancelled+q+a.issued=quantity THEN ''CANCELLED'' ELSE stage END WHERE id=l.id RETURNING * INTO l;
   result:=jsonb_build_object(''lineId'',l.id,''version'',l.version,''cancelledQuantity'',l.cancelled,''stage'',l.stage);
   INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);
   INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),actor,''LENDING_CANCEL'',l.id,jsonb_build_object(''commandId'',cmd,''reason'',p->>''reason'',''result'',result));RETURN result;
  END IF;
  IF op NOT IN(''issues'',''returns''');
 -- Compatible loan reads gain versions and immutable original due dates.
 definition:=replace(definition,'THEN RETURN lab.lending_call_cp2(token,csrf,op,p);END IF;',
 'THEN
   result:=lab.lending_call_cp2(token,csrf,op,p);
   IF op=''read_loans'' AND result ? ''items'' THEN
    SELECT coalesce(jsonb_agg(value||jsonb_build_object(''version'',nn.version,''originalDueAt'',nn.original_due_at)),''[]'') INTO result FROM jsonb_array_elements(result->''items'') x(value) JOIN lab.lend_loans nn ON nn.id=(value->>''id'')::uuid;
    RETURN jsonb_build_object(''items'',result,''limit'',coalesce((p->>''limit'')::integer,50),''offset'',coalesce((p->>''offset'')::integer,0));
   END IF;
   RETURN result;
  END IF;');
 EXECUTE definition;
END $$;
COMMIT;
