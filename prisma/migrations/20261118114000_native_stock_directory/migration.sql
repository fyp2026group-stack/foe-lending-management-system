-- These additional inventory-cell columns are needed to return the full
-- versioned stock DTO for HOD/admin and authorized Technical Officers.
-- Access to stock is controlled by native Prisma session and staff-lab checks.
-- The ORM role remains read-only on stock, without UPDATE/DELETE grants.
GRANT SELECT (id,location_id,asset_id,version)
  ON lab.inv_cells TO lab_orm;
