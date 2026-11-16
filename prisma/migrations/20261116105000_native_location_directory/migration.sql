-- Physical storage locations may be read by the native inventory service,
-- but only their public directory columns. Staff scope is verified in the
-- same ORM transaction. No INSERT/UPDATE/DELETE permissions are granted.
GRANT SELECT (id,lab_id,name,active,version) ON lab.inv_locations TO lab_orm;
