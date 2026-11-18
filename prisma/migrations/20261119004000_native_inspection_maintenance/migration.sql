-- Inspection and maintenance clearance require officer role, current
-- laboratory coverage and atomic stock transition under transaction locks.
-- Event history is append-only and retains optimistic version numbering.
GRANT SELECT (id,return_id,asset_id,borrower_id,status,version),
 UPDATE (status,version) ON lab.lend_inspections TO lab_orm;
GRANT INSERT (id,inspection_id,actor_id,outcome,condition,notes,version)
 ON lab.lend_inspection_events TO lab_orm;
GRANT SELECT (id,inspection_id,status,version),
 INSERT (id,inspection_id,status,version,created_by),
 UPDATE (status,version,updated_at)
 ON lab.lend_maintenance TO lab_orm;
GRANT INSERT (id,maintenance_id,actor_id,status,notes,version)
 ON lab.lend_maintenance_events TO lab_orm;
