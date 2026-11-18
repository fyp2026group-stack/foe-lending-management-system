-- Native stock ledger: all writes are mediated by application transactions.
-- Preserve deferred balanced-entry and cell-ledger-reconciliation triggers.
-- No permissions are granted to delete or modify immutable ledger history.
GRANT SELECT (id,item_id,lab_id,location_id,asset_id,state,quantity,version),
      INSERT (id,item_id,lab_id,location_id,asset_id,state,quantity,version),
      UPDATE (quantity,version)
  ON lab.inv_cells TO lab_orm;
GRANT INSERT (id,actor_id,item_id,lab_id,kind,reason,created_at)
  ON lab.inv_movements TO lab_orm;
GRANT INSERT (id,movement_id,cell_id,account,delta)
  ON lab.inv_entries TO lab_orm;
