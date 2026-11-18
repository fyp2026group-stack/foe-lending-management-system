-- Read-only movement and double-entry records for authorized officers and admins.
-- Service filters by current staff laboratory membership in the same Prisma
-- transaction. Never grant stock mutation via this migration.
GRANT SELECT (id,actor_id,item_id,lab_id,kind,reason,created_at)
  ON lab.inv_movements TO lab_orm;
GRANT SELECT (id,movement_id,cell_id,account,delta)
  ON lab.inv_entries TO lab_orm;
GRANT SELECT (id,location_id,asset_id,state)
  ON lab.inv_cells TO lab_orm;
GRANT SELECT (id,name)
  ON lab.inv_locations TO lab_orm;
