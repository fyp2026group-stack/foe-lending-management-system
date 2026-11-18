-- Current-stage lecturer/HOD approvals. Immutable approval decisions are
-- INSERT-only; the line stage remains under database-trigger versioning.
GRANT SELECT (id,request_id,lab_id,lecturer_id,hod_id,policy,stage,version),
      UPDATE (stage) ON lab.lend_lines TO lab_orm;
GRANT SELECT (id,request_id,actor_id,stage,created_at),
      INSERT (id,line_id,actor_id,stage,decision,remarks,created_at)
  ON lab.lend_decisions TO lab_orm;
