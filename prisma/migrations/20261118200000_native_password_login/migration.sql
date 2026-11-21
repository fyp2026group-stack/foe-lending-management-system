-- Password verification occurs server-side using scrypt. No credential bytes
-- appear in client responses; only the application-controlled ORM connection
-- can inspect the credential hash for verification.
GRANT SELECT (id,email,disabled,password_hash) ON lab.users TO lab_orm;
GRANT SELECT (key,attempts,until_at),
      INSERT (key,attempts,until_at),
      UPDATE (attempts,until_at)
  ON lab.login_limits TO lab_orm;
GRANT INSERT (token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at),
      UPDATE (revoked,last_seen_at)
  ON lab.sessions TO lab_orm;
GRANT SELECT (id,display_name,email) ON lab.users TO lab_orm;
GRANT INSERT (id,actor_id,action,target_id,occurred_at,details)
  ON lab.audit TO lab_orm;
