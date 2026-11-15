-- Correct the legacy PL/pgSQL block-qualified variable after migration 039
-- renamed lab.lending_call(...) to lab.lending_call_cp2(...).
--
-- 037_lending_versioned_results.sql stored "lending_call.result" in an
-- UPDATE statement. That implicit PL/pgSQL block qualifier ceased to exist
-- when the function was renamed, resulting in SQLSTATE 42P01 on decisions.
-- Existing values, grants, ownership, audit history, and business rules remain
-- unchanged. This migration is safe to apply once to an existing deployment.
DO $migration$
DECLARE
  definition text;
  old_name text := 'lending_call.result';
  new_name text := 'lending_call_cp2.result';
BEGIN
  SELECT pg_get_functiondef('lab.lending_call_cp2(text,text,text,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN
    RAISE EXCEPTION 'Protected lending function missing; refusing unsafe migration';
  END IF;
  IF position(old_name IN definition)=0 THEN
    IF position(new_name IN definition)>0 THEN
      RETURN; -- already repaired by an earlier controlled deployment
    END IF;
    RAISE EXCEPTION 'Expected legacy function qualifier absent; manual review required';
  END IF;
  definition := replace(definition,old_name,new_name);
  EXECUTE definition;
END
$migration$;
