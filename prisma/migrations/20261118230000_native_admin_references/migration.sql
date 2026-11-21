-- Admin reference maintenance uses an authorized ADMIN session and
-- rejects deactivation while current references exist. PostgreSQL unique
-- constraints protect duplicate academic names.
GRANT SELECT (id,name,active),INSERT (id,name,active),
      UPDATE (name,active) ON lab.batches TO lab_orm;
GRANT SELECT (id,name,active),INSERT (id,name,active),
      UPDATE (name,active) ON lab.laboratories TO lab_orm;
GRANT SELECT (user_id,batch_id,ended_at)
  ON lab.user_batch_memberships TO lab_orm;
GRANT SELECT (user_id,laboratory_id) ON lab.staff_labs TO lab_orm;
GRANT SELECT (id,lab_id,quantity) ON lab.inv_cells TO lab_orm;
