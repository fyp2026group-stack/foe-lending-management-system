-- Separate per-user preview admission counters from privileged login checks.
-- No access to password hashes or application command tables is conferred.
GRANT SELECT (key,attempts,until_at),
      INSERT (key,attempts,until_at),
      UPDATE (attempts,until_at)
  ON lab.login_limits TO lab_orm;
