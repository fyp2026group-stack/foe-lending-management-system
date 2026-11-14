BEGIN;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'DECLARE actor uuid;','#variable_conflict use_column'||chr(10)||'DECLARE actor uuid;');
 EXECUTE definition;
END $$;
COMMIT;
