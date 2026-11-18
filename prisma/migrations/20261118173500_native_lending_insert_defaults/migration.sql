-- Prisma may include DEFAULT-valued columns in native inserts. Grant
-- only the columns part of the append-only request/comment contracts.
GRANT INSERT (created_at,updated_at,version,revision,predecessor_id)
  ON lab.lend_requests TO lab_orm;
GRANT INSERT (version,cancelled) ON lab.lend_lines TO lab_orm;
GRANT INSERT (created_at) ON lab.lend_comments TO lab_orm;
