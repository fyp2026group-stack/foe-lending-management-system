-- A fresh Prisma baseline needs the narrowly scoped ORM role before
-- subsequent column-level GRANT migrations. Credentials must be provisioned
-- externally (e.g., Supabase SQL administration), never committed to Git.
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'lab_orm') THEN
    CREATE ROLE lab_orm NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'lab_runtime') THEN
    CREATE ROLE lab_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'lab_identity_functions') THEN
    CREATE ROLE lab_identity_functions NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$bootstrap$;

-- Pure validation for catalogue item specifications; PostgreSQL CHECK use
-- requires a durable deterministic function even with a Prisma-only runtime.
CREATE OR REPLACE FUNCTION lab.inv_specs_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $validator$
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>12000 THEN RETURN false;END IF;
 RETURN (SELECT count(*)<=30 AND coalesce(bool_and(length(key) BETWEEN 1 AND 80 AND jsonb_typeof(value)='string' AND length(value#>>'{}')<=500),true) FROM jsonb_each(p));
END
$validator$;

