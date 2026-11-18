-- Native request submission: permit only required append-only fields.
-- The Prisma service validates current item/category/location availability,
-- lecturer coverage and HOD authority in a single transaction.
GRANT INSERT (id,borrower_id,purpose,collect_at,return_at)
  ON lab.lend_requests TO lab_orm;
GRANT INSERT (
  id,request_id,item_id,lab_id,location_id,quantity,policy,
  lecturer_id,hod_id,stage
) ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,category_id,active) ON lab.inv_items TO lab_orm;
GRANT SELECT (id,active) ON lab.inv_categories TO lab_orm;
GRANT SELECT (id,lab_id,active) ON lab.inv_locations TO lab_orm;
GRANT SELECT (item_id,policy,hod_id) ON lab.lend_policies TO lab_orm;
-- No UPDATE or DELETE permission on requests and lines.
