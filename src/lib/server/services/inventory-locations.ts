import {nativeOrmTransaction} from '../db';
import {isUuid} from './uuid';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

const allowed = new Set(['limit','offset','q','labId','itemId','categoryId','kind','assetId','active','sort']);
function parse(p:Record<string,unknown>) {
  if(Object.keys(p).some(k=>!allowed.has(k))) return null;
  const n=(v:unknown,d:number)=>v===undefined?d:typeof v==='number'&&Number.isSafeInteger(v)?v:typeof v==='string'&&/^\d+$/.test(v)?Number(v):NaN;
  const limit=n(p.limit,20),offset=n(p.offset,0);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>10000)return null;
  for(const k of ['labId','itemId','categoryId','assetId']) if(p[k]!==undefined&&!isUuid(p[k]))return null;
  if(p.active!==undefined&&!['true','false'].includes(String(p.active)))return null;
  if(p.sort!==undefined&&!['name','id'].includes(String(p.sort)))return null;
  if(p.kind!==undefined&&!['RETURNABLE','CONSUMABLE'].includes(String(p.kind)))return null;
  if(p.q!==undefined&&(typeof p.q!=='string'||p.q.length>120))return null;
  return {limit,offset,labId:p.labId as string|undefined,q:(p.q as string|undefined)??'',active:p.active===undefined?undefined:p.active==='true',sort:p.sort==='name'?'name':'id'};
}
/** Role-scoped native Prisma location reads. No stock quantities exposed. */
export async function readInventoryLocations(token:string,p:Record<string,unknown>) {
  const f=parse(p); if(!f)return {status:422,code:'INVALID'};
  return nativeOrmTransaction(async tx=>{
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const roles = new Set(auth.roles);
    if (!roles.has('ADMIN') && !roles.has('TECHNICAL_OFFICER')) {
      return { items: [], limit: f.limit, offset: f.offset };
    }
    const labs = roles.has('ADMIN') ? undefined :
      (await tx.staff_labs.findMany({
        where: { user_id: auth.userId }, select: { laboratory_id: true },
      })).map(row => row.laboratory_id);
    if (labs && labs.length === 0) return { items: [], limit: f.limit, offset: f.offset };
    const items=await tx.inv_locations.findMany({
      where:{
        ...(f.labId?{lab_id:f.labId}:{}),
        ...(labs?{lab_id:{in:labs}}:{}),
        ...(f.active===undefined?{}:{active:f.active}),
        ...(f.q?{name:{contains:f.q,mode:'insensitive' as const}}:{}),
      },
      select:{id:true,lab_id:true,name:true,active:true,version:true},
      orderBy:f.sort==='name'?[{name:'asc' as const},{id:'asc' as const}]:[{id:'asc' as const}],
      skip:f.offset,take:f.limit,
    });
    return {items,limit:f.limit,offset:f.offset};
  });
}
