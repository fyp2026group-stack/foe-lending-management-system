-- inv_items CHECK constraint calls this immutable, validation-only function.
-- This does not grant access to legacy business RPCs or protected tables.
GRANT EXECUTE ON FUNCTION lab.inv_specs_valid(jsonb) TO lab_orm;
