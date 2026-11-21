-- Import staging is owner-only and can be committed only after validating
-- every row and current Technical Officer laboratory membership.
GRANT SELECT (id,owner_id,rows,committed),
      INSERT (id,owner_id,rows,committed),
      UPDATE (committed) ON lab.inv_imports TO lab_orm;
GRANT SELECT (id,item_id,lab_id,provenance),
      INSERT (id,item_id,lab_id,provenance,movement_id)
  ON lab.inv_receipts TO lab_orm;
