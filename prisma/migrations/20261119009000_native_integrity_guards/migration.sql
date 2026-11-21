-- Prisma cannot model deferred ledger reconciliation or version triggers.
-- These are database integrity guards, NOT application business RPCs.
-- Fresh deployments install them; established legacy databases retain the
-- equivalent historical triggers without installing duplicates.

CREATE OR REPLACE FUNCTION lab.orm_ledger_balance_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog,lab,pg_temp AS $body$
DECLARE balance_value bigint; entry_count integer;
BEGIN
  SELECT coalesce(sum(delta),0),count(*)
  INTO balance_value,entry_count
  FROM lab.inv_entries WHERE movement_id=NEW.movement_id;
  IF balance_value<>0 OR entry_count<>2 THEN
    RAISE EXCEPTION 'UNBALANCED_INVENTORY_MOVEMENT';
  END IF;
  RETURN NULL;
END
$body$;

CREATE OR REPLACE FUNCTION lab.orm_cell_reconcile_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog,lab,pg_temp AS $body$
DECLARE ledger_qty bigint; stored_qty integer;
BEGIN
  SELECT quantity INTO stored_qty FROM lab.inv_cells WHERE id=NEW.id;
  SELECT coalesce(sum(delta),0) INTO ledger_qty
  FROM lab.inv_entries WHERE cell_id=NEW.id;
  IF stored_qty IS DISTINCT FROM ledger_qty THEN
    RAISE EXCEPTION 'INVENTORY_CELL_LEDGER_MISMATCH';
  END IF;
  RETURN NULL;
END
$body$;

CREATE OR REPLACE FUNCTION lab.orm_immutable_history_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog,lab,pg_temp AS $body$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_HISTORY';
END
$body$;

CREATE OR REPLACE FUNCTION lab.orm_line_version_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog,lab,pg_temp AS $body$
BEGIN
  NEW.version:=OLD.version+1;
  RETURN NEW;
END
$body$;

CREATE OR REPLACE FUNCTION lab.orm_loan_version_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog,lab,pg_temp AS $body$
BEGIN
  NEW.version:=OLD.version+1;
  RETURN NEW;
END
$body$;

DO $install$
DECLARE t text; constraint_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='lab.inv_entries'::regclass AND tgname='inv_balanced'
  ) THEN
    CREATE CONSTRAINT TRIGGER inv_balanced AFTER INSERT ON lab.inv_entries
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    EXECUTE FUNCTION lab.orm_ledger_balance_guard();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='lab.inv_cells'::regclass AND tgname='inv_cell_reconcile'
  ) THEN
    CREATE CONSTRAINT TRIGGER inv_cell_reconcile
    AFTER INSERT OR UPDATE ON lab.inv_cells
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    EXECUTE FUNCTION lab.orm_cell_reconcile_guard();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='lab.lend_lines'::regclass AND tgname='lend_line_version'
  ) THEN
    CREATE TRIGGER lend_line_version BEFORE UPDATE ON lab.lend_lines
    FOR EACH ROW EXECUTE FUNCTION lab.orm_line_version_guard();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='lab.lend_loans'::regclass AND tgname='lend_loan_version'
  ) THEN
    CREATE TRIGGER lend_loan_version BEFORE UPDATE ON lab.lend_loans
    FOR EACH ROW EXECUTE FUNCTION lab.orm_loan_version_guard();
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'inv_movements','inv_entries','inv_receipts','lend_decisions',
    'lend_returns','lend_inspection_events','lend_maintenance_events',
    'lend_extension_decisions','lend_handovers','lend_comments',
    'inv_commands'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid=format('lab.%I',t)::regclass
      AND tgname='orm_immutable_'||t
    ) THEN
      -- Existing databases have their own immutability triggers. The
      -- additional guard is equivalent and never weakens those policies.
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.%I FOR EACH STATEMENT EXECUTE FUNCTION lab.orm_immutable_history_guard()',
        'orm_immutable_'||t,t
      );
    END IF;
  END LOOP;
END
$install$;

-- Reinstate critical CHECK invariants omitted by Prisma introspection.
ALTER TABLE lab.inv_cells
  ADD CONSTRAINT orm_inv_cells_quantity_guard
  CHECK (quantity>=0 AND version>=0 AND (asset_id IS NULL OR quantity<=1));
ALTER TABLE lab.lend_lines
  ADD CONSTRAINT orm_lend_lines_quantity_guard
  CHECK (quantity>0 AND cancelled>=0 AND cancelled<=quantity AND version>=0);
ALTER TABLE lab.lend_allocations
  ADD CONSTRAINT orm_lend_allocations_quantity_guard
  CHECK (quantity>0 AND issued>=0 AND cancelled>=0 AND issued+cancelled<=quantity);
ALTER TABLE lab.lend_loans
  ADD CONSTRAINT orm_lend_loans_quantity_guard
  CHECK (quantity>0 AND returned>=0 AND returned<=quantity AND version>=0);
ALTER TABLE lab.lend_requests
  ADD CONSTRAINT orm_lend_requests_time_guard CHECK (return_at>collect_at);
ALTER TABLE lab.lend_extensions
  ADD CONSTRAINT orm_lend_extensions_time_guard CHECK (proposed_due_at>previous_due_at);
ALTER TABLE lab.inv_entries
  ADD CONSTRAINT orm_inv_entries_nonzero_guard CHECK (delta<>0);

REVOKE ALL ON FUNCTION lab.orm_ledger_balance_guard(),
 lab.orm_cell_reconcile_guard(),lab.orm_immutable_history_guard(),
 lab.orm_line_version_guard(),lab.orm_loan_version_guard() FROM PUBLIC;
