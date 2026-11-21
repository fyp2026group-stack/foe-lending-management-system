-- Restricted ORM account supports HOD-governed user maintenance.
-- The Next.js service must verify a valid ADMIN session and matching CSRF
-- before entering a protected transaction; the database credentials are
-- server-only and never exposed to clients.
GRANT SELECT (id,email,display_name,registration_number,batch_id,disabled),
      INSERT (id,email,display_name,password_hash,batch_id,registration_number,disabled),
      UPDATE (display_name,registration_number,batch_id,disabled)
  ON lab.users TO lab_orm;
GRANT SELECT (user_id,role),INSERT (user_id,role),DELETE
  ON lab.user_roles TO lab_orm;
GRANT SELECT (user_id,laboratory_id),INSERT (user_id,laboratory_id),DELETE
  ON lab.staff_labs TO lab_orm;
GRANT SELECT (user_id,batch_id,started_at,ended_at),
      INSERT (user_id,batch_id,started_at,ended_at,changed_by),
      UPDATE (ended_at) ON lab.user_batch_memberships TO lab_orm;
GRANT UPDATE (revoked) ON lab.sessions TO lab_orm;
