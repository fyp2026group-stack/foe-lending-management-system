-- Native approval-policy changes require an authenticated ADMIN role and
-- serialize command replay with the preexisting lending writer.
GRANT SELECT (item_id,policy,hod_id),
      INSERT (item_id,policy,hod_id),
      UPDATE (policy,hod_id)
  ON lab.lend_policies TO lab_orm;
-- The existing restricted session service grants users(id,disabled),
-- user_roles(user_id,role), and lending command/audit columns.
