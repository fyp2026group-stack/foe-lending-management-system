-- Officer handover writes require explicit current-laboratory membership,
-- distinct borrower/handing-over actor and request-wide approval.
-- Immutable lending and inventory history remains INSERT-only.
GRANT SELECT (id,line_id,cell_id,quantity,issued,cancelled),
      UPDATE (issued) ON lab.lend_allocations TO lab_orm;
GRANT SELECT (id,asset_id,state) ON lab.inv_cells TO lab_orm;
GRANT INSERT (id,item_id,lab_id,serial,created_at)
  ON lab.inv_assets TO lab_orm;
GRANT INSERT (
  id,allocation_id,borrower_id,asset_id,quantity,returned,issued_by,
  due_at,original_due_at,issued_at,version
) ON lab.lend_loans TO lab_orm;
GRANT INSERT (loan_id,actor_id,movement_id,remarks,created_at)
  ON lab.lend_handovers TO lab_orm;
GRANT SELECT (id,disabled) ON lab.users TO lab_orm;
