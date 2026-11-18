-- Native physical read surfaces: event history is read-only; officer metrics
-- are restricted by active server-side session and laboratory membership.
GRANT SELECT (id,asset_id,item_id,lab_id,serial) ON lab.inv_assets TO lab_orm;
GRANT SELECT (id,actor_id,loan_id,quantity,condition,created_at)
 ON lab.lend_returns TO lab_orm;
GRANT SELECT (id,return_id,asset_id,borrower_id,status,version,created_at)
 ON lab.lend_inspections TO lab_orm;
GRANT SELECT (id,inspection_id,actor_id,outcome,condition,notes,version,created_at)
 ON lab.lend_inspection_events TO lab_orm;
GRANT SELECT (id,inspection_id,status,version,created_by,created_at,updated_at)
 ON lab.lend_maintenance TO lab_orm;
GRANT SELECT (id,maintenance_id,actor_id,status,notes,version,created_at)
 ON lab.lend_maintenance_events TO lab_orm;
GRANT SELECT (id,loan_id,requested_by,previous_due_at,proposed_due_at,
 reason,status,version,created_at)
 ON lab.lend_extensions TO lab_orm;
GRANT SELECT (id,extension_id,actor_id,decision,remarks,created_at)
 ON lab.lend_extension_decisions TO lab_orm;
GRANT SELECT (id,asset_id,state,version,quantity,item_id,lab_id,location_id)
 ON lab.inv_cells TO lab_orm;
GRANT SELECT (id,allocation_id,borrower_id,asset_id,quantity,returned,
 issued_at,due_at,original_due_at,version) ON lab.lend_loans TO lab_orm;
GRANT SELECT (id,line_id,cell_id) ON lab.lend_allocations TO lab_orm;
GRANT SELECT (id,request_id,lab_id,policy,lecturer_id,hod_id)
 ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,borrower_id) ON lab.lend_requests TO lab_orm;
GRANT SELECT (id,name) ON lab.inv_items TO lab_orm;
