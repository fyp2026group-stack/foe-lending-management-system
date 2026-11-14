BEGIN;
-- Only an outstanding legacy inspection needs a new actionable record. Old
-- receipts from assets since cleared/reissued stay in immutable receipt history.
-- Never delete a CP3 inspection that has an outcome or maintenance history.
DELETE FROM lab.lend_inspections i
 WHERE NOT EXISTS(SELECT 1 FROM lab.lend_inspection_events e WHERE e.inspection_id=i.id)
 AND NOT EXISTS(SELECT 1 FROM lab.lend_maintenance m WHERE m.inspection_id=i.id)
 AND (NOT EXISTS(SELECT 1 FROM lab.inv_cells c WHERE c.asset_id=i.asset_id AND c.quantity=1 AND c.state='INSPECTION')
 OR i.return_id<>(SELECT r.id FROM lab.lend_returns r JOIN lab.lend_loans n ON n.id=r.loan_id WHERE n.asset_id=i.asset_id ORDER BY r.created_at DESC,r.id DESC LIMIT 1));
COMMIT;
