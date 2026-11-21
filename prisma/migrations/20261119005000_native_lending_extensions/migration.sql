-- Native extension decisions preserve immutable history and update due dates
-- only after current-authority checks; these grants are service-role only.
GRANT SELECT (id,loan_id,previous_due_at,proposed_due_at,status,version),
 INSERT (id,loan_id,requested_by,previous_due_at,proposed_due_at,reason),
 UPDATE (status,version) ON lab.lend_extensions TO lab_orm;
GRANT INSERT (id,extension_id,actor_id,decision,remarks)
 ON lab.lend_extension_decisions TO lab_orm;
GRANT SELECT (id,borrower_id,asset_id,returned,quantity,due_at,original_due_at,version),
 UPDATE (due_at) ON lab.lend_loans TO lab_orm;
