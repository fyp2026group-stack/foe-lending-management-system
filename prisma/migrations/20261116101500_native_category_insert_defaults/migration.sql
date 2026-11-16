-- Prisma sends the schema-mapped default fields in INSERT statements.
-- Permit these two category-only columns; no stock, lending, or identity
-- mutation permissions are added.
GRANT INSERT (active, version) ON lab.inv_categories TO lab_orm;
