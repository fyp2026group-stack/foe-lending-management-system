-- Run as migration owner after local lab_runtime role provisioning. No credentials in SQL.
BEGIN;
REVOKE ALL ON SCHEMA lab FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA lab FROM PUBLIC;
GRANT USAGE ON SCHEMA lab TO lab_runtime;
GRANT SELECT,INSERT,UPDATE ON lab.users,lab.sessions,lab.login_limits TO lab_runtime;
GRANT SELECT,INSERT ON lab.batches,lab.laboratories TO lab_runtime;
GRANT SELECT,INSERT,DELETE ON lab.user_roles,lab.staff_labs TO lab_runtime;
GRANT DELETE ON lab.login_limits TO lab_runtime;
GRANT INSERT ON lab.audit TO lab_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA lab REVOKE ALL ON TABLES FROM PUBLIC;
COMMIT;

