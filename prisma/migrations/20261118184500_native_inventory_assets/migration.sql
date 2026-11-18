-- Identified assets are a restricted current-stock directory. Only admin
-- and laboratory-assigned Technical Officers can fetch it via the service.
GRANT SELECT (id,item_id,lab_id,serial,created_at)
  ON lab.inv_assets TO lab_orm;
GRANT SELECT (id,item_id,lab_id,asset_id,quantity,state,location_id,version)
  ON lab.inv_cells TO lab_orm;
