-- Physical returns are append-only custody history with a mandatory
-- unresolved inspection. Stock ledger invariants remain enforced by triggers.
GRANT SELECT (
  id,allocation_id,borrower_id,asset_id,quantity,returned,version
), UPDATE (returned)
  ON lab.lend_loans TO lab_orm;
GRANT INSERT (
  id,loan_id,actor_id,quantity,condition,created_at
) ON lab.lend_returns TO lab_orm;
GRANT INSERT (
  id,return_id,asset_id,borrower_id,status,version,created_at
) ON lab.lend_inspections TO lab_orm;
