-- Prisma-backed administrative catalogue reads.
-- This grants only non-credential reference tables, not users/sessions/passwords,
-- audit tables, lending state or inventory write privileges.
GRANT SELECT ON TABLE
  lab.batches,
  lab.laboratories,
  lab.staff_labs,
  lab.inv_locations,
  lab.user_batch_memberships
TO lab_runtime;
