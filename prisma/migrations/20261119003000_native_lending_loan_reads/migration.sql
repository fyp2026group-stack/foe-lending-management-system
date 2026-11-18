-- Lending queue/loan/metrics directories rely on current role and
-- laboratory scoping. Read-only grants preserve protected custody history.
GRANT SELECT (id,allocation_id,borrower_id,asset_id,quantity,returned,issued_by,issued_at,due_at)
 ON lab.lend_loans TO lab_orm;
GRANT SELECT (id,line_id,quantity,issued,cancelled) ON lab.lend_allocations TO lab_orm;
GRANT SELECT (id,request_id,item_id,lab_id,location_id,lecturer_id,hod_id)
 ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,borrower_id,purpose,collect_at,return_at) ON lab.lend_requests TO lab_orm;
GRANT SELECT (id,loan_id,quantity,condition,actor_id,created_at) ON lab.lend_returns TO lab_orm;
