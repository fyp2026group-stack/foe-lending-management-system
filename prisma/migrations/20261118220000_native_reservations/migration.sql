-- Native request-wide approval-gated reservations. The active-line stage,
-- policy decision history and stock quantity are checked in the same
-- serialized transaction as the allocation and double-entry movement.
GRANT SELECT (
  id,request_id,item_id,lab_id,location_id,quantity,cancelled,stage,version,policy
) ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,line_id,stage,decision)
  ON lab.lend_decisions TO lab_orm;
GRANT SELECT (id,line_id,cell_id,quantity,issued,cancelled),
      INSERT (id,line_id,cell_id,quantity,issued,cancelled)
  ON lab.lend_allocations TO lab_orm;
