-- Read-only reference columns required by the admin reference service.
-- The lab_orm role must never receive user credentials or mutation privileges
-- merely to render batch/laboratory directories.
GRANT SELECT (id, name, active) ON lab.batches TO lab_orm;
GRANT SELECT (id, name, active) ON lab.laboratories TO lab_orm;
GRANT SELECT (user_id, batch_id, ended_at)
  ON lab.user_batch_memberships TO lab_orm;
-- Existing migrations grant staff_labs(user_id,laboratory_id) and
-- inv_locations(id,lab_id,name,active,version) to the restricted ORM role.
