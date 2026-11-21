-- Restricted Technical Officer stock modifications and HOD approval.
-- Immutable movements/entries are append-only via native stock-ledger service.
GRANT SELECT (id,proposer,item_id,lab_id,location_id,quantity,direction,reason,expected_version,state),
      INSERT (id,proposer,item_id,lab_id,location_id,quantity,direction,reason,expected_version,state),
      UPDATE (state,approver,movement_id)
 ON lab.inv_adjustments TO lab_orm;
GRANT INSERT (id,item_id,lab_id,serial,created_at) ON lab.inv_assets TO lab_orm;
