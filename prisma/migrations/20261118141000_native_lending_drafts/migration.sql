-- Keep unpublished drafts readable only via the authenticated owner-scoped
-- Prisma service. No write or delete privilege is added.
GRANT SELECT (
  id,borrower_id,payload,version,created_at,updated_at,submitted_id,
  cancelled,predecessor_id
) ON lab.lend_drafts TO lab_orm;
