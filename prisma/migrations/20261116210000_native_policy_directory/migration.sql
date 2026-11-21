-- Allow the restricted Prisma service to list equipment approval policies.
-- Do not expose stock, request history, or borrowing records through this grant.
GRANT SELECT (id,name) ON lab.inv_items TO lab_orm;
GRANT SELECT (item_id,policy,hod_id) ON lab.lend_policies TO lab_orm;
