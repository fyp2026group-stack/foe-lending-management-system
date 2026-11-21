-- Minimal catalogue columns for typed, authorized Prisma category listings.
-- No write access, no stock or user information.
GRANT SELECT (id,name,active,version) ON lab.inv_categories TO lab_runtime;
