-- Native item directory: public equipment fields and available-unit sums.
-- All catalogue reads perform Prisma session validation first.
-- No access to serials, assets, locations, movements, borrower identity,
-- lending records or audit rows is granted by this migration.
GRANT SELECT (id,category_id,name,kind,uom,active,version,specifications)
  ON lab.inv_items TO lab_orm;
GRANT SELECT (item_id,lab_id,state,quantity)
  ON lab.inv_cells TO lab_orm;
