import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

const keys = new Set(['loanId','allocationId','requestId','labId','batchId','from','to','status','stage','limit','offset']);
function parse(p:Record<string,unknown>){
  if(Object.keys(p).some(k=>!keys.has(k)))return null;
  for(const key of ['loanId','allocationId','requestId','labId','batchId']){
    if(p[key]!==undefined&&!isUuid(p[key]))return null;
  }
  const n=(v:unknown,def:number)=>v===undefined?def:
    typeof v==='number'&&Number.isSafeInteger(v)?v:
    typeof v==='string'&&/^\d+$/.test(v)?Number(v):NaN;
  const limit=n(p.limit,50),offset=n(p.offset,0);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||
    !Number.isSafeInteger(offset)||offset<0||offset>100000)return null;
  const from=p.from===undefined?null:new Date(String(p.from));
  const to=p.to===undefined?null:new Date(String(p.to));
  if((from&&Number.isNaN(from.getTime()))||(to&&Number.isNaN(to.getTime()))||
    (from&&to&&from>=to))return null;
  return {limit,offset,from,to};
}

export async function readLendingRequests(token:string,payload:Record<string,unknown>){
  const p=parse(payload);
  if(!p)return {status:422,code:'INVALID'};
  if(payload.stage!==undefined&&!['LECTURER','HOD','APPROVED','REJECTED','CANCELLED'].includes(String(payload.stage)))
    return {status:422,code:'INVALID'};
  return nativeOrmTransaction(async tx=>{
    const auth=await authorizePrismaSession(tx,token);
    if(isAuthFailure(auth))return auth;
    const assigned=auth.roles.includes('LECTURER')||auth.roles.includes('TECHNICAL_OFFICER')
      ?(await tx.staff_labs.findMany({where:{user_id:auth.userId},
        select:{laboratory_id:true}})).map(x=>x.laboratory_id):[];
    const criteria=auth.roles.includes('ADMIN')?{}:{
      OR:[
        {borrower_id:auth.userId},
        {lend_lines:{some:{
          OR:[
            ...(auth.roles.includes('LECTURER')&&assigned.length?[{
              lecturer_id:auth.userId,lab_id:{in:assigned}}]:[]),
            ...(auth.roles.includes('TECHNICAL_OFFICER')&&assigned.length?[{
              lab_id:{in:assigned}}]:[]),
          ],
        }}},
      ],
    };
    const rows=await tx.lend_requests.findMany({
      where:{
        ...criteria,
        ...(payload.requestId?{id:payload.requestId as string}:{}),
        ...(payload.batchId?{users:{batch_id:payload.batchId as string}}:{}),
        ...(p.from||p.to?{created_at:{
          ...(p.from?{gte:p.from}:{}),...(p.to?{lt:p.to}:{}),
        }}:{}),
        ...(payload.labId?{lend_lines:{some:{lab_id:payload.labId as string}}}:{}),
      },
      select:{
        id:true,purpose:true,borrower_id:true,collect_at:true,return_at:true,
        created_at:true,version:true,updated_at:true,revision:true,predecessor_id:true,
        users:{select:{display_name:true,batch_id:true}},
        lend_lines:{
          select:{
            id:true,item_id:true,lab_id:true,location_id:true,quantity:true,
            policy:true,stage:true,lecturer_id:true,hod_id:true,
            version:true,cancelled:true,
            inv_items:{select:{name:true}},
            laboratories:{select:{name:true}},
            inv_locations:{select:{name:true}},
            lend_allocations:{select:{quantity:true,issued:true,cancelled:true}},
            lend_decisions:{
              select:{id:true,actor_id:true,stage:true,decision:true,remarks:true,created_at:true,
                users:{select:{display_name:true}}},
              orderBy:[{created_at:'asc'},{id:'asc'}],
            },
          },
        },
      },
      orderBy:[{created_at:'desc'},{id:'asc'}],
      take:10000,
    });
    const items=[];
    for(const r of rows){
      const lines=r.lend_lines.filter(l=>
        (auth.roles.includes('ADMIN')||r.borrower_id===auth.userId||
          (auth.roles.includes('LECTURER')&&l.lecturer_id===auth.userId&&assigned.includes(l.lab_id))||
          (auth.roles.includes('TECHNICAL_OFFICER')&&assigned.includes(l.lab_id)))&&
        (payload.labId===undefined||l.lab_id===payload.labId)
      ).map(l=>{
        const a=l.lend_allocations;
        return {
          id:l.id,itemId:l.item_id,item:l.inv_items.name,
          labId:l.lab_id,lab:l.laboratories.name,
          locationId:l.location_id,location:l.inv_locations.name,
          quantity:l.quantity,policy:l.policy,stage:l.stage,
          lecturerId:l.lecturer_id,hodId:l.hod_id,
          version:l.version,cancelledQuantity:l.cancelled,
          allocatedQuantity:a?.quantity??0,issuedQuantity:a?.issued??0,
          reservedQuantity:Math.max(0,(a?.quantity??0)-(a?.issued??0)-(a?.cancelled??0)),
          decisions:l.lend_decisions.map(d=>({
            id:d.id,actorId:d.actor_id,actor:d.users.display_name,
            stage:d.stage,decision:d.decision,remarks:d.remarks,createdAt:d.created_at,
          })),
        };
      });
      if(!lines.length)continue;
      if(payload.stage!==undefined&&!lines.some(l=>l.stage===payload.stage))continue;
      let summary='MIXED';
      if(lines.every(l=>l.stage==='CANCELLED'))summary='CANCELLED';
      else if(lines.every(l=>l.stage==='REJECTED'))summary='REJECTED';
      else if(lines.every(l=>l.issuedQuantity>=l.quantity-l.cancelledQuantity)&&
        lines.some(l=>l.issuedQuantity>0))summary='FULFILLED';
      else if(lines.some(l=>l.issuedQuantity>0))summary='PARTIALLY_FULFILLED';
      else if(lines.every(l=>l.stage==='APPROVED'))
        summary=lines.every(l=>l.reservedQuantity>0)?'READY':'AWAITING_STOCK';
      else if(lines.every(l=>['LECTURER','HOD'].includes(l.stage)))summary='PENDING';
      items.push({
        id:r.id,purpose:r.purpose,borrowerId:r.borrower_id,
        borrower:r.users.display_name,batchId:r.users.batch_id,
        collectAt:r.collect_at,returnAt:r.return_at,createdAt:r.created_at,
        updatedAt:r.updated_at,version:r.version,revision:r.revision,
        predecessorId:r.predecessor_id,lines,summary,
      });
    }
    return {items:items.slice(p.offset,p.offset+p.limit),limit:p.limit,offset:p.offset};
  });
}
