-- A fresh Prisma baseline needs the narrowly scoped ORM role before
-- subsequent column-level GRANT migrations. Credentials must be provisioned
-- externally (e.g., Supabase SQL administration), never committed to Git.
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'lab_orm') THEN
    CREATE ROLE lab_orm NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$bootstrap$;
