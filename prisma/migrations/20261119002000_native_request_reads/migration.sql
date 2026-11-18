-- Full request display includes versioned lines, immutable decisions and
-- allocation snapshots; all reads are scoped to the requesting user.
GRANT SELECT (
 id,borrower_id,purpose,collect_at,return_at,created_at,updated_at,
 version,revision,predecessor_id
) ON lab.lend_requests TO lab_orm;
GRANT SELECT (
 id,request_id,item_id,lab_id,location_id,quantity,policy,stage,
 lecturer_id,hod_id,version,cancelled
) ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,line_id,actor_id,stage,decision,remarks,created_at)
 ON lab.lend_decisions TO lab_orm;
GRANT SELECT (id,line_id,quantity,issued,cancelled)
 ON lab.lend_allocations TO lab_orm;
GRANT SELECT (id,display_name,batch_id) ON lab.users TO lab_orm;
GRANT SELECT (id,name) ON lab.inv_items,lab.laboratories,lab.inv_locations TO lab_orm;
