-- Audited denial attribution uses only the session properties needed to
-- validate a token. The caller never chooses an audit actor directly.
GRANT SELECT (token_hash,user_id,revoked,expires_at,last_seen_at)
  ON lab.sessions TO lab_orm;
GRANT SELECT (singleton,suppressed,last_suppressed_at),
      INSERT (singleton,suppressed,last_suppressed_at),
      UPDATE (suppressed,last_suppressed_at)
  ON lab.denial_suppression TO lab_orm;
