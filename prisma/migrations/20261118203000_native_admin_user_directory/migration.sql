-- Native administrator directory reads: no password hashes or session
-- secrets are included in its output, and every query requires ADMIN.
GRANT SELECT (id,email,display_name,disabled,batch_id,registration_number)
  ON lab.users TO lab_orm;
GRANT SELECT (user_id,role) ON lab.user_roles TO lab_orm;
GRANT SELECT (user_id,laboratory_id) ON lab.staff_labs TO lab_orm;
GRANT SELECT (user_id,batch_id,started_at,ended_at)
  ON lab.user_batch_memberships TO lab_orm;
