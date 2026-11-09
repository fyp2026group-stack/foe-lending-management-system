CREATE TABLE lab.inv_categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE CHECK(length(name) BETWEEN 1 AND 120));
CREATE TABLE lab.inv_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category_id uuid NOT NULL REFERENCES lab.inv_categories(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),kind text NOT NULL CHECK(kind IN ('CONSUMABLE','RETURNABLE')),uom text NOT NULL CHECK(length(uom) BETWEEN 1 AND 40));
CREATE TABLE lab.inv_locations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lab_id uuid NOT NULL REFERENCES lab.laboratories(id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),UNIQUE(id,lab_id),UNIQUE(lab_id,name));
CREATE TABLE lab.inv_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_id uuid NOT NULL REFERENCES lab.inv_items(id),lab_id uuid NOT NULL REFERENCES lab.laboratories(id),serial text CHECK(serial IS NULL OR length(serial) BETWEEN 1 AND 120),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(id,item_id,lab_id),UNIQUE(item_id,serial));
CREATE TABLE lab.inv_cells(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_id uuid NOT NULL REFERENCES lab.inv_items(id),lab_id uuid NOT NULL REFERENCES lab.laboratories(id),location_id uuid NOT NULL,asset_id uuid,state text NOT NULL CHECK(state IN ('AVAILABLE','RESERVED','BORROWED','INSPECTION','MAINTENANCE','TRANSIT','LOST','RETIRED','CONSUMED')),quantity integer NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 1000000),version integer NOT NULL DEFAULT 0 CHECK(version>=0),FOREIGN KEY(location_id,lab_id) REFERENCES lab.inv_locations(id,lab_id),FOREIGN KEY(asset_id,item_id,lab_id) REFERENCES lab.inv_assets(id,item_id,lab_id),CHECK(asset_id IS NULL OR quantity<=1),UNIQUE NULLS NOT DISTINCT(item_id,lab_id,location_id,asset_id,state));
CREATE UNIQUE INDEX inv_one_active_asset ON lab.inv_cells(asset_id) WHERE asset_id IS NOT NULL AND quantity=1;
CREATE INDEX inv_scope ON lab.inv_cells(lab_id,item_id,state,id);
CREATE TABLE lab.inv_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES lab.users(id),item_id uuid NOT NULL REFERENCES lab.inv_items(id),lab_id uuid NOT NULL REFERENCES lab.laboratories(id),kind text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE lab.inv_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),movement_id uuid NOT NULL REFERENCES lab.inv_movements(id),cell_id uuid REFERENCES lab.inv_cells(id),account text NOT NULL,delta integer NOT NULL CHECK(delta<>0 AND abs(delta)<=1000000));
CREATE INDEX ON lab.inv_entries(movement_id);
CREATE TABLE lab.inv_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_id uuid NOT NULL REFERENCES lab.inv_items(id),lab_id uuid NOT NULL REFERENCES lab.laboratories(id),provenance text NOT NULL CHECK(length(provenance) BETWEEN 1 AND 200),movement_id uuid NOT NULL REFERENCES lab.inv_movements(id),UNIQUE(item_id,lab_id,provenance));
CREATE TABLE lab.inv_adjustments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),proposer uuid NOT NULL REFERENCES lab.users(id),item_id uuid NOT NULL REFERENCES lab.inv_items(id),lab_id uuid NOT NULL REFERENCES lab.laboratories(id),location_id uuid NOT NULL,quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),direction text NOT NULL CHECK(direction IN ('ADD','REMOVE')),reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000),expected_version integer NOT NULL,state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED')),approver uuid REFERENCES lab.users(id),movement_id uuid REFERENCES lab.inv_movements(id),FOREIGN KEY(location_id,lab_id) REFERENCES lab.inv_locations(id,lab_id),CHECK(approver IS NULL OR approver<>proposer));
CREATE TABLE lab.inv_imports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES lab.users(id),rows jsonb NOT NULL CHECK(jsonb_typeof(rows)='array' AND jsonb_array_length(rows) BETWEEN 1 AND 100),committed boolean NOT NULL DEFAULT false);
CREATE TABLE lab.inv_commands(actor_id uuid NOT NULL REFERENCES lab.users(id),command_id uuid NOT NULL,operation text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(actor_id,command_id));
CREATE FUNCTION lab.inv_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'immutable inventory history';END $$;
CREATE TRIGGER immutable_movements BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.inv_movements FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable();
CREATE TRIGGER immutable_entries BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.inv_entries FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.inv_receipts FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable();
CREATE TRIGGER immutable_items BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.inv_items FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable();
CREATE TRIGGER immutable_assets BEFORE UPDATE OR DELETE OR TRUNCATE ON lab.inv_assets FOR EACH STATEMENT EXECUTE FUNCTION lab.inv_immutable();
CREATE FUNCTION lab.inv_balance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lab,pg_temp AS $$
BEGIN IF (SELECT coalesce(sum(delta),0) FROM lab.inv_entries WHERE movement_id=NEW.movement_id)<>0 OR (SELECT count(*) FROM lab.inv_entries WHERE movement_id=NEW.movement_id)<>2 THEN RAISE EXCEPTION 'unbalanced movement';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER inv_balanced AFTER INSERT ON lab.inv_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab.inv_balance();
CREATE FUNCTION lab.inv_cell(item uuid,labid uuid,loc uuid,asset uuid,pool text) RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,lab,pg_temp AS $$
DECLARE cell uuid;
BEGIN INSERT INTO lab.inv_cells(item_id,lab_id,location_id,asset_id,state) VALUES(item,labid,loc,asset,pool) ON CONFLICT DO NOTHING;
SELECT id INTO cell FROM lab.inv_cells WHERE item_id=item AND lab_id=labid AND location_id=loc AND asset_id IS NOT DISTINCT FROM asset AND state=pool;RETURN cell;END $$;
CREATE FUNCTION lab.inv_post(actor uuid,item uuid,labid uuid,source uuid,dest uuid,q integer,kind text,reason text) RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,lab,pg_temp AS $$
DECLARE movement uuid:=gen_random_uuid();
BEGIN
 IF q NOT BETWEEN 1 AND 1000000 OR source IS NOT DISTINCT FROM dest THEN RAISE EXCEPTION 'INVALID_QUANTITY';END IF;
 PERFORM id FROM lab.inv_cells WHERE id IN(source,dest) ORDER BY id FOR UPDATE;
 IF source IS NOT NULL THEN UPDATE lab.inv_cells SET quantity=quantity-q,version=version+1 WHERE id=source AND quantity>=q;IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK';END IF;END IF;
 IF dest IS NOT NULL THEN UPDATE lab.inv_cells SET quantity=quantity+q,version=version+1 WHERE id=dest;END IF;
 INSERT INTO lab.inv_movements VALUES(movement,actor,item,labid,kind,reason,clock_timestamp());
 INSERT INTO lab.inv_entries(movement_id,cell_id,account,delta) VALUES(movement,source,CASE WHEN source IS NULL THEN 'EXTERNAL' ELSE 'STOCK' END,-q),(movement,dest,CASE WHEN dest IS NULL THEN 'EXTERNAL' ELSE 'STOCK' END,q);
 INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES(gen_random_uuid(),actor,'INVENTORY_'||kind,movement);
 RETURN movement;
END $$;
CREATE FUNCTION lab.inv_receive(actor uuid,p jsonb) RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,lab,pg_temp AS $$
DECLARE item uuid:=(p->>'itemId')::uuid;labid uuid:=(p->>'labId')::uuid;loc uuid:=(p->>'locationId')::uuid;cell uuid;movement uuid;q integer;
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('itemId','labId','locationId','quantity','provenance','commandId')) OR jsonb_typeof(p->'quantity')<>'number' OR (p->>'quantity')!~'^[1-9][0-9]*$' OR length(trim(p->>'provenance')) NOT BETWEEN 1 AND 200 OR p->>'provenance' IS NULL THEN RAISE EXCEPTION 'INVALID_RECEIPT';END IF;
 q:=(p->>'quantity')::integer;
 IF NOT EXISTS(SELECT 1 FROM lab.user_roles WHERE user_id=actor AND role='TECHNICAL_OFFICER') OR NOT EXISTS(SELECT 1 FROM lab.staff_labs WHERE user_id=actor AND laboratory_id=labid) THEN RAISE EXCEPTION 'DENIED';END IF;
 cell:=lab.inv_cell(item,labid,loc,NULL,'AVAILABLE');
 movement:=lab.inv_post(actor,item,labid,NULL,cell,q,'RECEIPT',p->>'provenance');
 INSERT INTO lab.inv_receipts(item_id,lab_id,provenance,movement_id) VALUES(item,labid,trim(p->>'provenance'),movement);
 RETURN movement;
END $$;
GRANT SELECT,INSERT ON lab.inv_categories,lab.inv_items,lab.inv_locations,lab.inv_assets,lab.inv_movements,lab.inv_entries,lab.inv_receipts,lab.inv_commands TO lab_identity_functions;
GRANT SELECT,INSERT,UPDATE ON lab.inv_cells,lab.inv_adjustments,lab.inv_imports TO lab_identity_functions;
ALTER FUNCTION lab.inv_balance() OWNER TO lab_identity_functions;
REVOKE ALL ON ALL TABLES IN SCHEMA lab FROM lab_runtime,PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lab FROM PUBLIC;
REVOKE ALL ON FUNCTION lab.inv_cell(uuid,uuid,uuid,uuid,text),lab.inv_post(uuid,uuid,uuid,uuid,uuid,integer,text,text),lab.inv_receive(uuid,jsonb),lab.inv_immutable(),lab.inv_balance() FROM lab_runtime;
GRANT EXECUTE ON FUNCTION lab.inv_cell(uuid,uuid,uuid,uuid,text),lab.inv_post(uuid,uuid,uuid,uuid,uuid,integer,text,text),lab.inv_receive(uuid,jsonb) TO lab_identity_functions;

