CREATE FUNCTION lab.inv_stage_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW.owner_id<>OLD.owner_id OR NEW.rows<>OLD.rows OR (OLD.committed AND NOT NEW.committed) THEN RAISE EXCEPTION 'immutable staged import';END IF;RETURN NEW;
END $$;
CREATE TRIGGER inv_stage_guard BEFORE UPDATE ON lab.inv_imports FOR EACH ROW EXECUTE FUNCTION lab.inv_stage_guard();
CREATE FUNCTION lab.inv_cell_reconcile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,pg_temp AS $$
BEGIN
 IF (SELECT quantity FROM lab.inv_cells WHERE id=NEW.id)<>(SELECT coalesce(sum(delta),0) FROM lab.inv_entries WHERE cell_id=NEW.id) THEN RAISE EXCEPTION 'cell ledger mismatch';END IF;
 RETURN NULL;
END $$;
ALTER FUNCTION lab.inv_cell_reconcile() OWNER TO lab_identity_functions;
CREATE CONSTRAINT TRIGGER inv_cell_reconcile AFTER INSERT OR UPDATE ON lab.inv_cells DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab.inv_cell_reconcile();
REVOKE ALL ON FUNCTION lab.inv_stage_guard(),lab.inv_cell_reconcile() FROM PUBLIC,lab_runtime;
