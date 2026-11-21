-- Guard the legacy, unversioned explicit reserve path and any future ORM
-- allocation INSERT. Unlike the protected lend_reserve() function, the old
-- lending_call_cp1 reserve route inserts the allocation directly.
-- A DB trigger preserves the whole-request invariant across both pathways.
CREATE FUNCTION lab.lend_guard_allocation_approved()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $guard$
BEGIN
  IF EXISTS(
    SELECT 1 FROM lab.lend_lines own
    JOIN lab.lend_lines sibling ON sibling.request_id=own.request_id
    WHERE own.id=NEW.line_id
      AND sibling.quantity>sibling.cancelled
      AND sibling.stage IS DISTINCT FROM 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'STATE_CONFLICT';
  END IF;
  RETURN NEW;
END
$guard$;
ALTER FUNCTION lab.lend_guard_allocation_approved() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.lend_guard_allocation_approved() FROM PUBLIC,lab_runtime;
CREATE TRIGGER lend_guard_allocation_approved
BEFORE INSERT ON lab.lend_allocations
FOR EACH ROW EXECUTE FUNCTION lab.lend_guard_allocation_approved();
