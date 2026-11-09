import pg from "pg";
import {readFile} from "node:fs/promises";
import {randomUUID,createHash} from "node:crypto";
import {hashPassword} from "../src/lib/server/password.mjs";
const url=process.env.MIGRATION_DATABASE_URL;
if(!url||!["localhost","127.0.0.1","[::1]"].includes(new URL(url).hostname))throw Error("Local migration database URL required");
const c=new pg.Client({connectionString:url});await c.connect();
try{
 if(process.argv[2]==="migrate"){
 await c.query("BEGIN");
 await c.query("SELECT pg_advisory_xact_lock(731942)");
 await c.query("CREATE TABLE IF NOT EXISTS public.lab_migrations(name text PRIMARY KEY,digest text NOT NULL)");
 for(const name of ["001_identity.sql","002_runtime_grants.sql","003_integrity.sql","004_audit_details.sql","005_protected_identity.sql","006_denial_audit.sql","007_deferred_profile_owner.sql","008_admission_and_observability.sql","009_unknown_admission_order.sql","010_inventory.sql","011_inventory_api.sql","012_import_admission.sql","013_inventory_scope.sql","014_inventory_integrity.sql","015_asset_history.sql","016_import_duplicate_preview.sql","017_inventory_activity.sql","018_preview_validation.sql","019_inventory_dtos.sql","020_preview_all_rows.sql","021_preview_shape_guard.sql","022_inventory_contract_security.sql"]){
 const source=await readFile(new URL("../database/"+name,import.meta.url),"utf8");
 const digest=createHash("sha256").update(source).digest("hex");
 const old=(await c.query("SELECT digest FROM public.lab_migrations WHERE name=$1",[name])).rows[0];
 if(old){if(old.digest!==digest)throw Error("Applied migration changed");continue;}
 await c.query(source.replace(/^BEGIN;\s*|^COMMIT;\s*/gm,""));
 await c.query("INSERT INTO public.lab_migrations VALUES($1,$2)",[name,digest]);
 }
 await c.query("COMMIT");
 }else if(process.argv[2]==="seed"){
 const password=process.env.SYNTHETIC_ADMIN_PASSWORD;if(!password)throw Error("Set synthetic password locally (12ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“128 characters)");
 await c.query("BEGIN");
 const batch="10000000-0000-4000-8000-000000000001",lab="10000000-0000-4000-8000-000000000002";
 await c.query("INSERT INTO lab.batches VALUES($1,'Synthetic Cohort') ON CONFLICT(id) DO NOTHING",[batch]);
 await c.query("INSERT INTO lab.laboratories VALUES($1,'Synthetic Laboratory') ON CONFLICT(id) DO NOTHING",[lab]);
 for(const [name,roles] of [["admin",["ADMIN"]],["student",["STUDENT"]],["lecturer",["LECTURER"]],["officer",["TECHNICAL_OFFICER"]],["multi",["LECTURER","TECHNICAL_OFFICER"]]]){
 const email=name+"@example.invalid";
 if((await c.query("SELECT id FROM lab.users WHERE email=$1",[email])).rows.length)continue;
 const id=randomUUID();
 await c.query("INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number) VALUES($1,$2,$3,$4,$5,$6)",[id,email,"Synthetic "+name,hashPassword(password),roles.includes("STUDENT")?batch:null,roles.includes("STUDENT")?"SYNTHETIC-001":null]);
 for(const role of roles)await c.query("INSERT INTO lab.user_roles VALUES($1,$2)",[id,role]);
 if(roles.includes("LECTURER")||roles.includes("TECHNICAL_OFFICER"))await c.query("INSERT INTO lab.staff_labs VALUES($1,$2)",[id,lab]);
 await c.query("INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES($1,$2,'SYNTHETIC_BOOTSTRAP',$2)",[randomUUID(),id]);
 }
 const category='20000000-0000-4000-8000-000000000001',item='20000000-0000-4000-8000-000000000002',location='20000000-0000-4000-8000-000000000003';
 await c.query("INSERT INTO lab.inv_categories VALUES($1,'Synthetic Instruments') ON CONFLICT(id) DO NOTHING",[category]);
 await c.query("INSERT INTO lab.inv_items VALUES($1,$2,'Synthetic Multimeter','RETURNABLE','unit') ON CONFLICT(id) DO NOTHING",[item,category]);
 await c.query("INSERT INTO lab.inv_locations VALUES($1,$2,'Synthetic Store') ON CONFLICT(id) DO NOTHING",[location,lab]);
 if(!(await c.query("SELECT 1 FROM lab.inv_receipts WHERE item_id=$1 AND lab_id=$2 AND provenance='Synthetic opening receipt M3'",[item,lab])).rows.length){
 const officer=(await c.query("SELECT id FROM lab.users WHERE email='officer@example.invalid'")).rows[0];
 await c.query('SELECT lab.inv_receive($1,$2)',[officer.id,{itemId:item,labId:lab,locationId:location,quantity:10,provenance:'Synthetic opening receipt M3'}]);
 }
 await c.query("COMMIT");
 }else throw Error("Use migrate or seed");
}catch(e){await c.query("ROLLBACK");throw e;}finally{await c.end();}
