-- Native reservations must retain custody claims for identified equipment,
-- including assets returned, inspected, and lent again. No broad table grants.
GRANT INSERT (allocation_id,asset_id,cell_id,released)
  ON lab.lend_reserved_assets TO lab_orm;
