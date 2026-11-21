-- Native lending comment service permissions. The ORM role receives only the
-- fields required to check visibility and append immutable comments; no
-- UPDATE or DELETE on comments, commands, or the audit log.
GRANT SELECT (id,borrower_id) ON lab.lend_requests TO lab_orm;
GRANT SELECT (id,request_id,lab_id,lecturer_id,hod_id)
  ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,request_id,author_id,body,corrects_id,created_at),
      INSERT (id,request_id,author_id,body,corrects_id)
  ON lab.lend_comments TO lab_orm;
GRANT SELECT (actor_id,command_id,operation,payload,result),
      INSERT (actor_id,command_id,operation,payload,result)
  ON lab.lend_commands TO lab_orm;
-- Prior migrations grant users(display_name) and audit inserts.
