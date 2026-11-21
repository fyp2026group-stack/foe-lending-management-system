-- Prisma INSERT ... DEFAULT / RETURNING still requires explicit column grants.
-- Preserve least-privilege, append-only history and no table-wide UPDATE.
GRANT INSERT (id,loan_id,requested_by,previous_due_at,proposed_due_at,
  reason,status,version,created_at)
  ON lab.lend_extensions TO lab_orm;
GRANT INSERT (id,extension_id,actor_id,decision,remarks,created_at)
  ON lab.lend_extension_decisions TO lab_orm;
GRANT INSERT (id,inspection_id,created_by,status,version,created_at,updated_at)
  ON lab.lend_maintenance TO lab_orm;
GRANT INSERT (id,inspection_id,actor_id,outcome,condition,notes,version,created_at)
  ON lab.lend_inspection_events TO lab_orm;
GRANT INSERT (id,maintenance_id,actor_id,status,notes,version,created_at)
  ON lab.lend_maintenance_events TO lab_orm;
GRANT INSERT (id,borrower_id,payload,version,created_at,updated_at,
  submitted_id,cancelled,predecessor_id)
  ON lab.lend_drafts TO lab_orm;
