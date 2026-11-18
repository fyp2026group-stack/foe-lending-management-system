-- A restricted Prisma role may create and patch catalogue locations.
-- Maintain the existing category guard and enforce immutable scope/version,
-- existing stock, and pending lending references at the database boundary.
GRANT INSERT (id,lab_id,name), UPDATE (name,active,version)
  ON lab.inv_locations TO lab_orm;
GRANT SELECT (id,location_id,quantity,state) ON lab.inv_cells TO lab_orm;
GRANT SELECT (id,location_id,stage) ON lab.lend_lines TO lab_orm;

CREATE OR REPLACE FUNCTION lab.inv_catalogue_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $guard$
BEGIN
  IF current_user='lab_identity_functions' THEN RETURN NEW; END IF;
  IF current_user='lab_orm' AND TG_TABLE_SCHEMA='lab' AND TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='inv_categories' THEN
      IF NEW.version IS DISTINCT FROM OLD.version+1
         OR (NEW.active IS FALSE AND EXISTS (
           SELECT 1 FROM lab.inv_items WHERE category_id=NEW.id AND active
         )) THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
      RETURN NEW;
    ELSIF TG_TABLE_NAME='inv_locations' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.lab_id IS DISTINCT FROM OLD.lab_id
         OR NEW.version IS DISTINCT FROM OLD.version+1
         OR (NEW.active IS FALSE AND (
           EXISTS(SELECT 1 FROM lab.inv_cells
             WHERE location_id=OLD.id AND quantity>0
               AND state NOT IN ('CONSUMED','RETIRED','LOST'))
           OR EXISTS(SELECT 1 FROM lab.lend_lines
             WHERE location_id=OLD.id AND stage IN ('LECTURER','HOD','APPROVED'))
         )) THEN RAISE EXCEPTION 'STATE_CONFLICT'; END IF;
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'protected catalogue';
END
$guard$;
