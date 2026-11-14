-- Qualify lending state against the inventory function's import-stage variable.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('lab.inventory_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'FROM lab.lend_lines WHERE','FROM lab.lend_lines ll WHERE');
 definition:=replace(definition,'AND stage IN (','AND ll.stage IN (');
 EXECUTE definition;
END $migration$;

CREATE FUNCTION lab.inv_active_lending_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM lab.inv_items i JOIN lab.inv_categories c ON c.id=i.category_id WHERE i.id=NEW.item_id AND i.active AND c.active)
 OR NOT EXISTS(SELECT 1 FROM lab.inv_locations WHERE id=NEW.location_id AND active) THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION lab.inv_active_lending_guard() OWNER TO lab_identity_functions;
CREATE TRIGGER inv_active_lending BEFORE INSERT ON lab.lend_lines FOR EACH ROW EXECUTE FUNCTION lab.inv_active_lending_guard();
REVOKE ALL ON FUNCTION lab.inv_active_lending_guard() FROM PUBLIC,lab_runtime;
