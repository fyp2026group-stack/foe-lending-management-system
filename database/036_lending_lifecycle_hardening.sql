BEGIN;
CREATE FUNCTION lab.lend_submission_valid(p jsonb) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $$
DECLARE v jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('commandId','purpose','collectAt','returnAt','lecturerId','lines'))
 OR jsonb_typeof(p->'purpose') IS DISTINCT FROM 'string' OR length(trim(p->>'purpose')) NOT BETWEEN 1 AND 1000
 OR jsonb_typeof(p->'collectAt') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'returnAt') IS DISTINCT FROM 'string'
 OR NOT isfinite((p->>'collectAt')::timestamptz) OR NOT isfinite((p->>'returnAt')::timestamptz)
 OR (p->>'returnAt')::timestamptz<=greatest((p->>'collectAt')::timestamptz,clock_timestamp())
 OR jsonb_typeof(p->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'lines') NOT BETWEEN 1 AND 20 THEN RETURN false;END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p->'lines') LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN('itemId','labId','locationId','quantity'))
  OR NOT v ?& ARRAY['itemId','labId','locationId','quantity']
  OR jsonb_typeof(v->'quantity') IS DISTINCT FROM 'number' OR (v->>'quantity')!~'^[1-9][0-9]*$'
  OR (v->>'quantity')::integer NOT BETWEEN 1 AND 1000 THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER FUNCTION lab.lend_submission_valid(jsonb) OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_submission_valid(jsonb) FROM PUBLIC,lab_runtime;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF op LIKE ''read_%'' THEN',
 'IF op LIKE ''read_%'' THEN
  allowed:=CASE op
   WHEN ''read_requests'' THEN ARRAY[''requestId'',''labId'',''batchId'',''from'',''to'',''status'',''stage'',''limit'',''offset'']
   WHEN ''read_drafts'' THEN ARRAY[''requestId'',''limit'',''offset'']
   WHEN ''read_loans'' THEN ARRAY[''requestId'',''labId'',''batchId'',''from'',''to'',''status'',''limit'',''offset'']
   WHEN ''read_metrics'' THEN ARRAY[''labId'',''batchId'',''from'',''to'',''status'']
   WHEN ''read_ready'' THEN ARRAY[''requestId'',''labId'',''batchId'',''from'',''to'',''limit'',''offset'']
   WHEN ''read_allocations'' THEN ARRAY[''requestId'',''labId'',''batchId'',''from'',''to'',''limit'',''offset'']
   WHEN ''read_sources'' THEN ARRAY[''labId'',''limit'',''offset'']
   WHEN ''read_lecturers'' THEN ARRAY[''labId'',''limit'',''offset'']
   WHEN ''read_comments'' THEN ARRAY[''requestId'',''limit'',''offset'']
   WHEN ''read_history'' THEN ARRAY[''limit'',''offset'']
   WHEN ''read_policies'' THEN ARRAY[''limit'',''offset''] ELSE NULL END;
  IF allowed IS NULL THEN RETURN ''{"status":404,"code":"NOT_FOUND"}'';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed) OR jsonb_typeof(p->k)=''null'') THEN RAISE EXCEPTION ''INVALID'';END IF;
  IF op=''read_requests'' AND p ? ''status'' AND p->>''status'' NOT IN(''PENDING'',''MIXED'',''READY'',''AWAITING_STOCK'',''PARTIALLY_FULFILLED'',''FULFILLED'',''CANCELLED'',''REJECTED'') THEN RAISE EXCEPTION ''INVALID'';END IF;');
 definition:=replace(definition,'p-ARRAY[''stage'',''limit'',''offset'']',
 'p-CASE WHEN op=''read_requests'' THEN ARRAY[''stage'',''limit'',''offset'',''status''] ELSE ARRAY[''stage'',''limit'',''offset''] END');
 definition:=replace(definition,'v:=v||jsonb_build_object(''lines'',lineitems',
 'IF p ? ''status'' AND p->>''status''<>summary THEN CONTINUE;END IF;
    v:=v||jsonb_build_object(''lines'',lineitems');
 definition:=replace(definition,'result:=lab.lending_call_cp1(token,csrf,''requests'',d.payload',
 'IF NOT lab.lend_submission_valid(d.payload) THEN RAISE EXCEPTION ''INVALID'';END IF;
  result:=lab.lending_call_cp1(token,csrf,''requests'',d.payload');
 -- A replay cannot acquire stock that was unavailable during its first execution.
 definition:=replace(definition,'IF op=''decisions'' AND NOT result ? ''status''',
 'IF op=''decisions'' AND old.command_id IS NULL AND NOT result ? ''status''');
 definition:=replace(definition,'INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);RETURN result;',
 'INSERT INTO lab.lend_commands VALUES(actor,cmd,op,p,result);
    INSERT INTO lab.audit(id,actor_id,action,target_id,details) VALUES(gen_random_uuid(),actor,''LENDING_RESERVE'',l.id,jsonb_build_object(''commandId'',cmd,''result'',result));
    RETURN result;');
 EXECUTE definition;
END $migration$;
COMMIT;
