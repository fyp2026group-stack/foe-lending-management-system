import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { ensureCell, postStockMovement } from './stock-ledger';

type ImportLine = { itemId:string; labId:string; locationId:string; quantity:number; provenance:string };
function canonical(value: unknown):string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') {
    const o=value as Record<string,unknown>;
    return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
  }
  return JSON.stringify(value)??'null';
}
function parseRows(value: unknown): ImportLine[] | null {
  if (!Array.isArray(value) || !value.length || value.length>100) return null;
  const seen = new Set<string>();
  const result:ImportLine[]=[];
  for(const entry of value){
    if(!entry || typeof entry !== 'object' || Array.isArray(entry))return null;
    const row=entry as Record<string,unknown>;
    if(Object.keys(row).some(k=>!['itemId','labId','locationId','quantity','provenance'].includes(k)) ||
      !isUuid(row.itemId)||!isUuid(row.labId)||!isUuid(row.locationId)||
      !Number.isSafeInteger(row.quantity)||(row.quantity as number)<1||(row.quantity as number)>1_000_000||
      typeof row.provenance!=='string'||row.provenance.trim().length<1||row.provenance.trim().length>200)return null;
    const normalized = {itemId:row.itemId as string, labId:row.labId as string,
      locationId:row.locationId as string,quantity:row.quantity as number,provenance:row.provenance.trim()};
    const key=normalized.itemId+'|'+normalized.labId+'|'+normalized.provenance;
    if(seen.has(key))return null;
    seen.add(key);result.push(normalized);
  }
  return result;
}
async function validateRows(tx:Prisma.TransactionClient,userId:string,rows:ImportLine[]){
  const labs=[...new Set(rows.map(x=>x.labId))];
  const covered=await tx.staff_labs.findMany({where:{user_id:userId,laboratory_id:{in:labs}},
    select:{laboratory_id:true}});
  const scope=new Set(covered.map(x=>x.laboratory_id));
  if(labs.some(id=>!scope.has(id)))return {status:403,code:'DENIED'};
  for(const row of rows){
    const [item,location,duplicate]=await Promise.all([
      tx.inv_items.findUnique({where:{id:row.itemId},
        select:{active:true,inv_categories:{select:{active:true}}}}),
      tx.inv_locations.findFirst({where:{id:row.locationId,lab_id:row.labId,active:true},
        select:{id:true,laboratories:{select:{active:true}}}}),
      tx.inv_receipts.findUnique({where:{item_id_lab_id_provenance:{
        item_id:row.itemId,lab_id:row.labId,provenance:row.provenance}},select:{id:true}})
    ]);
    if(duplicate)return {status:422,code:'DUPLICATE_ROW'};
    if(!item?.active||!item.inv_categories.active||!location?.laboratories.active)
      return {status:422,code:'VALIDATION_FAILED'};
  }
  return null;
}
/** Preview is a durable staging record, but the database is still empty until
 * a technical officer explicitly imports a validated worksheet. */
export async function previewInventoryImport(token:string,csrf:string,body:Record<string,unknown>){
  if(Object.keys(body).some(k=>!['commandId','rows'].includes(k))||
    !isUuid(body.commandId))return {status:422,code:'INVALID'};
  const rows=parseRows(body.rows);
  if(!rows)return {status:422,code:'VALIDATION_FAILED'};
  return nativeOrmTransaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    const auth=await authorizePrismaSession(tx,token,{csrf,requiredRoles:['TECHNICAL_OFFICER']});
    if(isAuthFailure(auth))return auth;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
    const failed=await validateRows(tx,auth.userId,rows);
    if(failed)return failed;
    const old=await tx.inv_commands.findUnique({where:{actor_id_command_id:{
      actor_id:auth.userId,command_id:body.commandId as string}},
      select:{operation:true,payload:true,result:true}});
    if(old)return old.operation==='preview'&&canonical(old.payload)===canonical(body)
      ? old.result as Record<string,unknown> : {status:409,code:'IDENTITY_CONFLICT'};
    const id=randomUUID();
    await tx.inv_imports.createMany({data:[{id,owner_id:auth.userId,rows:rows as Prisma.InputJsonValue,committed:false}]});
    const result={id,rowCount:rows.length,rows};
    await tx.inv_commands.create({data:{
      actor_id:auth.userId,command_id:body.commandId as string,operation:'preview',
      payload:body as Prisma.InputJsonValue,result}});
    await tx.audit.createMany({data:[{id:randomUUID(),actor_id:auth.userId,
      action:'INVENTORY_IMPORT_PREVIEW',target_id:id}]});
    return result;
  });
}
/** Import commit is atomic across all rows; failures roll back every receipt. */
export async function commitInventoryImport(token:string,csrf:string,body:Record<string,unknown>){
  if(Object.keys(body).some(k=>!['commandId','id'].includes(k))||
    !isUuid(body.commandId)||!isUuid(body.id))return {status:422,code:'INVALID'};
  try{
    return await nativeOrmTransaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
      const auth=await authorizePrismaSession(tx,token,{csrf,requiredRoles:['TECHNICAL_OFFICER']});
      if(isAuthFailure(auth))return auth;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(731943) IS NULL AS locked`;
      const stage=await tx.inv_imports.findFirst({where:{id:body.id as string,owner_id:auth.userId},
        select:{id:true,rows:true,committed:true}});
      if(!stage)return {status:404,code:'NOT_FOUND'};
      const rows=parseRows(stage.rows);
      if(!rows)return {status:422,code:'INVALID'};
      const labs=new Set((await tx.staff_labs.findMany({where:{user_id:auth.userId},
        select:{laboratory_id:true}})).map(l=>l.laboratory_id));
      if(rows.some(x=>!labs.has(x.labId)))return {status:403,code:'DENIED'};
      const old=await tx.inv_commands.findUnique({where:{actor_id_command_id:{
        actor_id:auth.userId,command_id:body.commandId as string}},
        select:{operation:true,payload:true,result:true}});
      if(old)return old.operation==='commit'&&canonical(old.payload)===canonical(body)
        ? old.result as Record<string,unknown>:{status:409,code:'IDENTITY_CONFLICT'};
      if(stage.committed)return {status:409,code:'STATE_CONFLICT'};
      const invalid=await validateRows(tx,auth.userId,rows);
      if(invalid)return invalid;
      for(const row of rows){
        const cell=await ensureCell(tx,{itemId:row.itemId,labId:row.labId,locationId:row.locationId,state:'AVAILABLE'});
        const movementId=await postStockMovement(tx,{actorId:auth.userId,itemId:row.itemId,labId:row.labId,
          sourceCellId:null,destCellId:cell.id,quantity:row.quantity,kind:'RECEIPT',reason:row.provenance});
        await tx.inv_receipts.createMany({data:[{id:randomUUID(),item_id:row.itemId,lab_id:row.labId,
          provenance:row.provenance,movement_id:movementId}]});
      }
      const modified=await tx.inv_imports.updateMany({where:{id:stage.id,committed:false},
        data:{committed:true}});
      if(modified.count!==1)throw Error('STATE_CONFLICT');
      const result={id:stage.id,rowCount:rows.length};
      await tx.inv_commands.create({data:{actor_id:auth.userId,command_id:body.commandId as string,
        operation:'commit',payload:body as Prisma.InputJsonValue,result}});
      await tx.audit.createMany({data:[{id:randomUUID(),actor_id:auth.userId,
        action:'INVENTORY_IMPORT_COMMIT',target_id:stage.id}]});
      return result;
    });
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')
      return {status:409,code:'DUPLICATE_ROW'};
    throw error;
  }
}
