BEGIN;
-- Preserve command replay when a lecturer's lab assignments change later.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 IF position('-- A supplied lecturer' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected lending function version';END IF;
 definition:=replace(definition,'DECLARE actor uuid; result jsonb;','DECLARE actor uuid; result jsonb; old lab.lend_commands; cmd uuid;');
 definition:=replace(definition,'-- A supplied lecturer',
 'PERFORM pg_advisory_xact_lock(731944);
  cmd:=(p->>''commandId'')::uuid;
  IF cmd IS NULL THEN RETURN ''{"status":422,"code":"COMMAND_REQUIRED"}'';END IF;
  SELECT * INTO old FROM lab.lend_commands WHERE actor_id=actor AND command_id=cmd;
  IF FOUND THEN
   IF old.operation<>op OR old.payload<>p THEN RETURN ''{"status":409,"code":"IDENTITY_CONFLICT"}'';END IF;
   RETURN old.result;
  END IF;
  -- A supplied lecturer');
 EXECUTE definition;
END $migration$;
COMMIT;
