-- Deferred triggers fire after the API function returns; retain a narrow read-only checker identity.
ALTER FUNCTION lab.check_profile() SECURITY DEFINER;
ALTER FUNCTION lab.check_profile() SET search_path=pg_catalog,lab,pg_temp;
ALTER FUNCTION lab.check_profile() OWNER TO lab_identity_functions;
REVOKE ALL ON FUNCTION lab.check_profile() FROM PUBLIC,lab_runtime;
