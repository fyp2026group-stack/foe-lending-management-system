-- Whole-order approval enforcement, including legacy callers.
-- All active lines of a request must be approved before any stock can
-- be reserved or handed over. This closes the mixed-item partial-issue gap.
-- The protected function retains all existing stock conservation, asset
-- reservation, locking, and idempotency operations.
DO $guard$
DECLARE
  definition text;
  needle text := 'IF l.stage IS DISTINCT FROM ''APPROVED'' THEN RAISE EXCEPTION ''STATE_CONFLICT'';END IF;';
  insert_guard text := $text$
 IF EXISTS(
   SELECT 1 FROM lab.lend_lines sibling
   WHERE sibling.request_id=l.request_id
     AND sibling.quantity>sibling.cancelled
     AND sibling.stage IS DISTINCT FROM 'APPROVED'
 ) THEN RETURN jsonb_build_object('awaitingApprovals',true);END IF;
$text$;
BEGIN
  -- Fresh native schema uses transactional TypeScript reservation guards.
  IF to_regprocedure('lab.lend_reserve(uuid,uuid)') IS NULL THEN RETURN; END IF;
  SELECT pg_get_functiondef('lab.lend_reserve(uuid,uuid)'::regprocedure) INTO definition;
  IF definition IS NULL OR position(needle IN definition)=0
     OR position('awaitingApprovals' IN definition)>0 THEN
    RAISE EXCEPTION 'Unexpected reservation function; manual migration review required';
  END IF;
  definition:=replace(definition,needle,needle||insert_guard);
  EXECUTE definition;
END
$guard$;

-- When the LAST approval arrives, reserve *every* approved active line.
-- Before then, not even a NONE-policy line may reserve. Unversioned
-- historical callers retain their existing explicit-reservation behavior.
DO $completion$
DECLARE
  definition text;
  needle text := 'IF p ? ''expectedVersion'' THEN PERFORM lab.lend_reserve(actor,l.id);END IF;';
  replacement text := $text$
   IF p ? 'expectedVersion' THEN
     idvalue:=l.request_id;
     FOR l IN SELECT * FROM lab.lend_lines
       WHERE request_id=idvalue AND quantity>cancelled AND stage='APPROVED'
       ORDER BY id LOOP
       PERFORM lab.lend_reserve(actor,l.id);
     END LOOP;
   END IF;
$text$;
BEGIN
  IF to_regprocedure('lab.lending_call_cp2(text,text,text,jsonb)') IS NULL THEN RETURN; END IF;
  SELECT pg_get_functiondef('lab.lending_call_cp2(text,text,text,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL OR position(needle IN definition)=0 THEN
    RAISE EXCEPTION 'Expected versioned approval completion branch missing';
  END IF;
  definition:=replace(definition,needle,replacement);
  EXECUTE definition;
END
$completion$;

-- Defense in depth for historical allocations and any future application
-- pathway that attempts to issue stock before all necessary approvals.
CREATE FUNCTION lab.lend_guard_handover_approved()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $guard$
BEGIN
  IF EXISTS(
    SELECT 1 FROM lab.lend_allocations a
    JOIN lab.lend_lines own ON own.id=a.line_id
    JOIN lab.lend_lines sibling ON sibling.request_id=own.request_id
    WHERE a.id=NEW.allocation_id
      AND sibling.quantity>sibling.cancelled
      AND sibling.stage IS DISTINCT FROM 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'STATE_CONFLICT';
  END IF;
  RETURN NEW;
END
$guard$;
ALTER FUNCTION lab.lend_guard_handover_approved() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_guard_handover_approved() FROM PUBLIC,lab_runtime;
CREATE TRIGGER lend_guard_handover_approved
BEFORE INSERT ON lab.lend_loans
FOR EACH ROW EXECUTE FUNCTION lab.lend_guard_handover_approved();
