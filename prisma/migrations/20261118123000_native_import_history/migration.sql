-- Import history and staging rows are private to their original owner.
-- The Prisma service includes owner_id in each query and checks the session
-- within the same transaction. No insert/update/delete grants are issued here.
GRANT SELECT (id,owner_id,rows,committed) ON lab.inv_imports TO lab_orm;
