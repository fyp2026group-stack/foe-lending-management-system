-- Grant only the columns needed by typed equipment-policy listings.
-- No write privileges and no access to stock, identity, loans or audit.
GRANT SELECT (id,name) ON lab.inv_items TO lab_runtime;
GRANT SELECT (item_id,policy,hod_id) ON lab.lend_policies TO lab_runtime;
