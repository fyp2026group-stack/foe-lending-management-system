-- Read-only custody receipt for the Technical Officer and borrower workspaces.
GRANT SELECT (loan_id,actor_id,movement_id,remarks,created_at)
 ON lab.lend_handovers TO lab_orm;
