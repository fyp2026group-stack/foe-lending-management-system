-- Prisma's create() includes model default fields in INSERT statements.
-- Keep access column-scoped and preserve version/active guard on updates.
GRANT INSERT (active,version) ON lab.inv_items TO lab_orm;
GRANT INSERT (active,version) ON lab.inv_locations TO lab_orm;
