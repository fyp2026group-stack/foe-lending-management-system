-- HOD reports use restricted Prisma model reads. No UPDATE or DELETE on
-- audit or inventory history is granted. Every report is ADMIN-authorized.
GRANT SELECT (id,actor_id,action,target_id,occurred_at,details) ON lab.audit TO lab_orm;
GRANT SELECT (id,display_name,registration_number,batch_id) ON lab.users TO lab_orm;
GRANT SELECT (id,name) ON lab.batches TO lab_orm;
GRANT SELECT (id,name,active) ON lab.laboratories TO lab_orm;
GRANT SELECT (id,name,category_id,kind,uom) ON lab.inv_items TO lab_orm;
GRANT SELECT (id,name) ON lab.inv_categories TO lab_orm;
GRANT SELECT (id,lab_id,name) ON lab.inv_locations TO lab_orm;
GRANT SELECT (id,item_id,lab_id,location_id,state,quantity)
  ON lab.inv_cells TO lab_orm;
GRANT SELECT (item_id,policy) ON lab.lend_policies TO lab_orm;
GRANT SELECT (id,allocation_id,borrower_id,issued_by,quantity,returned,issued_at,due_at)
  ON lab.lend_loans TO lab_orm;
GRANT SELECT (id,line_id) ON lab.lend_allocations TO lab_orm;
GRANT SELECT (
  id,request_id,item_id,lab_id,location_id,lecturer_id,quantity,policy
) ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,borrower_id,purpose)
  ON lab.lend_requests TO lab_orm;
GRANT SELECT (id,line_id,actor_id,stage,decision,remarks,created_at)
  ON lab.lend_decisions TO lab_orm;
