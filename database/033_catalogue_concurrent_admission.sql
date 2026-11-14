-- Lending uses a separate workflow gate. Join the catalogue gate before checking
-- references so a concurrent request/receipt cannot resurrect inactive records.
CREATE OR REPLACE FUNCTION lab.inv_active_lending_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(731943);
 IF NOT EXISTS(SELECT 1 FROM lab.inv_items i JOIN lab.inv_categories c ON c.id=i.category_id WHERE i.id=NEW.item_id AND i.active AND c.active)
 OR NOT EXISTS(SELECT 1 FROM lab.inv_locations WHERE id=NEW.location_id AND active) THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION lab.inv_active_cell_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab AS $$
BEGIN
 IF NEW.quantity>0 AND (TG_OP='INSERT' OR NEW.quantity>OLD.quantity) THEN
 PERFORM pg_advisory_xact_lock(731943);
 IF NOT EXISTS(SELECT 1 FROM lab.inv_items i JOIN lab.inv_categories c ON c.id=i.category_id WHERE i.id=NEW.item_id AND i.active AND c.active)
 OR NOT EXISTS(SELECT 1 FROM lab.inv_locations WHERE id=NEW.location_id AND active) THEN RAISE EXCEPTION 'STATE_CONFLICT';END IF;
 END IF;
 RETURN NEW;
END $$;
