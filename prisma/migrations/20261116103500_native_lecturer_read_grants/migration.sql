-- Expose only active lecturer names and laboratory coverage to the
-- restricted native Prisma read service. Passwords, email addresses, loan
-- records and inventory stock remain inaccessible.
GRANT SELECT (display_name) ON lab.users TO lab_orm;
GRANT SELECT (user_id,laboratory_id) ON lab.staff_labs TO lab_orm;
