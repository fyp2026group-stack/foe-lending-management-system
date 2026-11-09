CREATE OR REPLACE FUNCTION lab.inv_preview_errors(actor uuid,rows_input jsonb,full_check boolean) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,lab,pg_temp AS $$
DECLARE errors jsonb:='[]';r jsonb;idx integer:=1;k text;labid uuid;item uuid;loc uuid;uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';valid boolean;
BEGIN
IF jsonb_typeof(rows_input) IS DISTINCT FROM 'array' THEN RETURN '[{"row":0,"column":"file","code":"INVALID_ROWS"}]';END IF;
IF jsonb_array_length(rows_input) NOT BETWEEN 1 AND 100 THEN RETURN '[{"row":0,"column":"file","code":"ROW_LIMIT"}]';END IF;
FOR r IN SELECT value FROM jsonb_array_elements(rows_input) LOOP
idx:=idx+1;
IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','row','code','INVALID_OBJECT'));CONTINUE;END IF;
IF jsonb_typeof(r->'labId') IS DISTINCT FROM 'string' OR (r->>'labId')!~uuid_pattern THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','labId','code','INVALID_UUID'));CONTINUE;END IF;
labid:=(r->>'labId')::uuid;
IF NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=labid) THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','labId','code','DENIED'));CONTINUE;END IF;
IF NOT full_check THEN CONTINUE;END IF;
FOR k IN SELECT jsonb_object_keys(r) LOOP
IF k NOT IN('itemId','labId','locationId','quantity','provenance') THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','row','code','UNSUPPORTED_FIELD'));END IF;
END LOOP;
valid:=true;
FOREACH k IN ARRAY ARRAY['itemId','locationId'] LOOP
IF jsonb_typeof(r->k) IS DISTINCT FROM 'string' OR (r->>k)!~uuid_pattern THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column',k,'code','INVALID_UUID'));valid:=false;END IF;
END LOOP;
IF valid THEN
item:=(r->>'itemId')::uuid;loc:=(r->>'locationId')::uuid;
IF NOT EXISTS(SELECT 1 FROM lab.inv_items WHERE id=item) THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','itemId','code','NOT_FOUND'));END IF;
IF NOT EXISTS(SELECT 1 FROM lab.inv_locations WHERE id=loc AND lab_id=labid) THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','locationId','code','INVALID_REFERENCE'));END IF;
END IF;
IF jsonb_typeof(r->'quantity') IS DISTINCT FROM 'number' OR (r->>'quantity')!~'^[1-9][0-9]{0,6}$' THEN
errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','quantity','code','POSITIVE_INTEGER_REQUIRED'));
ELSIF (r->>'quantity')::integer>1000000 THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','quantity','code','QUANTITY_LIMIT'));END IF;
IF jsonb_typeof(r->'provenance') IS DISTINCT FROM 'string' OR coalesce(length(trim(r->>'provenance')),0) NOT BETWEEN 1 AND 200 THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','provenance','code','REQUIRED_200_MAX'));
ELSIF valid THEN
IF EXISTS(SELECT 1 FROM lab.inv_receipts WHERE item_id=item AND lab_id=labid AND provenance=trim(r->>'provenance')) THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','provenance','code','ALREADY_RECEIVED'));END IF;
IF (SELECT count(*) FROM jsonb_array_elements(rows_input) a WHERE a->>'itemId'=r->>'itemId' AND a->>'labId'=r->>'labId' AND trim(a->>'provenance')=trim(r->>'provenance'))>1 THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',idx,'column','provenance','code','DUPLICATE_ROW'));END IF;
END IF;
END LOOP;
RETURN errors;
END $$;
REVOKE ALL ON FUNCTION lab.inv_preview_errors(uuid,jsonb,boolean) FROM PUBLIC,lab_runtime;
GRANT EXECUTE ON FUNCTION lab.inv_preview_errors(uuid,jsonb,boolean) TO lab_identity_functions;


