-- Only the fields required to review adjustment proposals are exposed.
-- Native service checks actor role and current officer-laboratory membership.
-- Proposal approvals and stock mutation remain denied to this ORM role.
GRANT SELECT (
  id, proposer, item_id, lab_id, location_id, quantity, direction,
  reason, expected_version, state, approver, movement_id
) ON lab.inv_adjustments TO lab_orm;
