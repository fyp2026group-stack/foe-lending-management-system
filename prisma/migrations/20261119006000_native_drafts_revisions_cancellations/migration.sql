-- Native borrower draft/revision and cancellation lifecycle.
-- Historical decisions and stock movements remain append-only.
GRANT SELECT (id,borrower_id,payload,version,submitted_id,cancelled,predecessor_id),
 INSERT (id,borrower_id,payload,predecessor_id),
 UPDATE (payload,version,updated_at,submitted_id,cancelled)
 ON lab.lend_drafts TO lab_orm;
GRANT SELECT (id,borrower_id,purpose,collect_at,return_at,version,revision,predecessor_id),
 UPDATE (predecessor_id,revision) ON lab.lend_requests TO lab_orm;
GRANT SELECT (id,request_id,item_id,lab_id,location_id,quantity,policy,lecturer_id,hod_id,
 stage,version,cancelled),
 UPDATE (cancelled,stage) ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,line_id,cell_id,quantity,issued,cancelled),
 UPDATE (cancelled) ON lab.lend_allocations TO lab_orm;
GRANT SELECT (allocation_id,asset_id,cell_id,released),UPDATE (released)
 ON lab.lend_reserved_assets TO lab_orm;
