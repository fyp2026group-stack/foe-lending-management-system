-- Native receipts are append-only and continue to be protected by
-- deferred stock reconciliation and balanced-entry database triggers.
GRANT SELECT (id,item_id,lab_id,provenance),
      INSERT (id,item_id,lab_id,provenance,movement_id)
  ON lab.inv_receipts TO lab_orm;
GRANT SELECT (id,lab_id,active)
  ON lab.inv_locations TO lab_orm;
GRANT SELECT (id,active)
  ON lab.laboratories TO lab_orm;
GRANT SELECT (id,category_id,active)
  ON lab.inv_items TO lab_orm;
GRANT SELECT (id,active)
  ON lab.inv_categories TO lab_orm;
