BEGIN;
-- Custody remains on the loan even when its line has no further handover rights.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'WHEN cancelled+q=quantity THEN ''CANCELLED''',
 'WHEN cancelled+q+coalesce(a.issued,0)=quantity THEN ''CANCELLED''');
 definition:=replace(definition,'WHEN bool_and(x->>''stage''=''CANCELLED'') THEN ''CANCELLED''',
 'WHEN bool_and(x->>''stage''=''CANCELLED'' AND (x->>''issuedQuantity'')::integer=0) THEN ''CANCELLED''');
 definition:=replace(definition,'WHEN bool_and((x->>''issuedQuantity'')::integer=',
 'WHEN bool_or((x->>''issuedQuantity'')::integer>0) AND bool_or((x->>''cancelledQuantity'')::integer>0) THEN ''PARTIALLY_FULFILLED''
     WHEN bool_and((x->>''issuedQuantity'')::integer=');
 EXECUTE definition;
END $migration$;
CREATE FUNCTION lab.lend_return_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab AS $$
BEGIN
 UPDATE lab.lend_lines SET version=version WHERE id=(SELECT a.line_id FROM lab.lend_allocations a WHERE a.id=NEW.allocation_id);
 RETURN NEW;
END $$;
ALTER FUNCTION lab.lend_return_touch() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_return_touch() FROM PUBLIC,lab_runtime;
CREATE TRIGGER lend_return_version AFTER UPDATE OF returned ON lab.lend_loans FOR EACH ROW EXECUTE FUNCTION lab.lend_return_touch();
COMMIT;
