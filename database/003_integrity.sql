ALTER TABLE lab.sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE lab.users ADD CONSTRAINT user_lengths CHECK(length(email) BETWEEN 3 AND 254 AND length(display_name) BETWEEN 1 AND 120 AND (registration_number IS NULL OR length(registration_number) BETWEEN 1 AND 80));
CREATE FUNCTION lab.check_profile() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,lab AS $$ BEGIN
IF EXISTS(SELECT 1 FROM lab.user_roles r JOIN lab.users u ON u.id=r.user_id WHERE r.role='STUDENT' AND (u.batch_id IS NULL OR u.registration_number IS NULL)) THEN RAISE EXCEPTION 'student profile required' USING ERRCODE='23514'; END IF;
IF EXISTS(SELECT 1 FROM lab.staff_labs s WHERE NOT EXISTS(SELECT 1 FROM lab.user_roles r WHERE r.user_id=s.user_id AND r.role IN ('LECTURER','TECHNICAL_OFFICER'))) THEN RAISE EXCEPTION 'staff role required' USING ERRCODE='23514'; END IF; RETURN NULL; END $$;
REVOKE ALL ON FUNCTION lab.check_profile() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER roles_profile AFTER INSERT OR UPDATE OR DELETE ON lab.user_roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab.check_profile();
CREATE CONSTRAINT TRIGGER users_profile AFTER INSERT OR UPDATE ON lab.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab.check_profile();
CREATE CONSTRAINT TRIGGER staff_profile AFTER INSERT OR UPDATE ON lab.staff_labs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab.check_profile();
