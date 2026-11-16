-- This role is deliberately NOT the existing lab_runtime role.
-- It can replace only the inventory-category command path; it is not a
-- migration owner, does not inherit other roles, and cannot read passwords,
-- inventory stock, lending, reports, or audit records.
GRANT USAGE ON SCHEMA lab TO lab_orm;
GRANT SELECT (token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at),
      UPDATE (last_seen_at) ON lab.sessions TO lab_orm;
GRANT SELECT (id,disabled) ON lab.users TO lab_orm;
GRANT SELECT (user_id,role) ON lab.user_roles TO lab_orm;

GRANT SELECT (id,name,active,version) ON lab.inv_categories TO lab_orm;
GRANT INSERT (id,name), UPDATE (name,active,version)
  ON lab.inv_categories TO lab_orm;
GRANT SELECT (id,category_id,active) ON lab.inv_items TO lab_orm;

-- Never update/delete an already recorded command or audit event.
GRANT SELECT (actor_id,command_id,operation,payload,result),
      INSERT (actor_id,command_id,operation,payload,result)
  ON lab.inv_commands TO lab_orm;
GRANT INSERT (id,actor_id,action,target_id,details) ON lab.audit TO lab_orm;

-- A secure ORM transaction is only authorized for the category domain.
-- Do NOT grant access to inv_cells, inv_movements, inv_entries, lend_*,
-- sessions' other columns, credentials, or table-level ALL permissions.
