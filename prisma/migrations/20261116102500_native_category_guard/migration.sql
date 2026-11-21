-- Preserve the protected catalogue trigger while allowing ONLY the
-- explicitly migrated category-update service account to use Prisma ORM.
-- The old identity-function owner retains its existing behavior. Other
-- users (including lab_runtime) remain rejected.
--
-- Protect version sequencing and active child references at the database
-- boundary even when a caller bypasses the TypeScript service.
CREATE OR REPLACE FUNCTION lab.inv_catalogue_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,lab
AS $guard$
BEGIN
  IF current_user='lab_identity_functions' THEN RETURN NEW;END IF;
  IF current_user='lab_orm'
     AND TG_TABLE_SCHEMA='lab' AND TG_TABLE_NAME='inv_categories'
     AND TG_OP='UPDATE' THEN
    IF NEW.version IS DISTINCT FROM OLD.version+1
       OR (NEW.active IS FALSE AND EXISTS(
          SELECT 1 FROM lab.inv_items
          WHERE category_id=NEW.id AND active
       )) THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'protected catalogue';
END
$guard$;
