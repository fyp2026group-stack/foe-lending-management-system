import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

const allowed=new Set(['loanId','allocationId','requestId','labId','batchId','from','to','status','stage','limit','offset']);
function parse(body:Record<string,unknown>){
  if(Object.keys(body).some(x=>!allowed.has(x)) ||
    ['loanId','allocationId','requestId','labId','batchId'].some(k=>body[k]!==undefined&&!isUuid(body[k])))return null;
  const n=(v:unknown,d:number)=>v===undefined?d:typeof v==='number'&&Number.isSafeInteger(v)?v:
    typeof v==='string'&&/^\d+$/.test(v)?Number(v):NaN;
  const limit=n(body.limit,50),offset=n(body.offset,0);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||
    !Number.isSafeInteger(offset)||offset<0||offset>100000)return null;
  const from=body.from===undefined?null:new Date(String(body.from));
  const to=body.to===undefined?null:new Date(String(body.to));
  if((from&&Number.isNaN(from.getTime()))||(to&&Number.isNaN(to.getTime()))||
    (from&&to&&from>=to))return null;
  if(body.status!==undefined&&!['active','history','overdue'].includes(String(body.status)))return null;
  return {limit,offset,from,to};
}
type Kind='loans'|'history'|'allocations'|'ready'|'metrics';
export async function readLendingLoans(token:string,kind:Kind,body:Record<string,unknown>){
  const p=parse(body);if(!p)return {status:422,code:'INVALID'};
  return nativeOrmTransaction(async tx=>{
    const auth=await authorizePrismaSession(tx,token);
    if(isAuthFailure(auth))return auth;
    const labs=(auth.roles.includes('LECTURER')||auth.roles.includes('TECHNICAL_OFFICER'))
      ?(await tx.staff_labs.findMany({where:{user_id:auth.userId},select:{laboratory_id:true}}))
        .map(x=>x.laboratory_id):[];
    const authorized=(borrower:string,lecturer:string|null,hod:string|null,lab:string)=>
      auth.roles.includes('ADMIN')||borrower===auth.userId||
      (auth.roles.includes('LECTURER')&&lecturer===auth.userId&&labs.includes(lab))||
      (auth.roles.includes('TECHNICAL_OFFICER')&&labs.includes(lab));
    if(kind==='allocations'||kind==='ready'){
      const results=await tx.lend_allocations.findMany({
        where:{
          ...(body.allocationId?{id:body.allocationId as string}:{}),
          ...(body.requestId?{lend_lines:{request_id:body.requestId as string}}:{}),
          ...(body.labId?{lend_lines:{lab_id:body.labId as string}}:{}),
        },
        select:{
          id:true,line_id:true,quantity:true,issued:true,cancelled:true,
          lend_lines:{select:{
            item_id:true,lab_id:true,location_id:true,lecturer_id:true,hod_id:true,
            inv_items:{select:{name:true}},
            laboratories:{select:{name:true}},
            lend_requests:{select:{
              id:true,borrower_id:true,purpose:true,collect_at:true,return_at:true,
              users:{select:{display_name:true,batch_id:true}},
            }},
          }},
        },
        orderBy:{id:'asc'},take:10001,
      });
      const entries=results.filter(a=>{
        const l=a.lend_lines,r=l.lend_requests;
        return authorized(r.borrower_id,l.lecturer_id,l.hod_id,l.lab_id) &&
          (body.batchId===undefined||r.users.batch_id===body.batchId) &&
          a.quantity-a.issued-a.cancelled>0 &&
          (!p.from||r.collect_at>=p.from)&&(!p.to||r.collect_at<p.to);
      }).map(a=>{
        const l=a.lend_lines,r=l.lend_requests;
        return {id:a.id,lineId:a.line_id,quantity:a.quantity,issued:a.issued,
          cancelledQuantity:a.cancelled,remaining:a.quantity-a.issued-a.cancelled,
          itemId:l.item_id,item:l.inv_items.name,labId:l.lab_id,
          labName:l.laboratories.name,
          locationId:l.location_id,requestId:r.id,purpose:r.purpose,
          collectAt:r.collect_at,returnAt:r.return_at,
          borrowerId:r.borrower_id,borrower:r.users.display_name};
      });
      return {items:entries.slice(p.offset,p.offset+p.limit),limit:p.limit,offset:p.offset};
    }
    const results=await tx.lend_loans.findMany({
      where:{
        ...(body.loanId?{id:body.loanId as string}:{}),
        ...(body.allocationId?{allocation_id:body.allocationId as string}:{}),
        ...(body.requestId?{lend_allocations:{lend_lines:{request_id:body.requestId as string}}}:{}),
        ...(body.labId?{lend_allocations:{lend_lines:{lab_id:body.labId as string}}}:{}),
        ...(p.from||p.to?{issued_at:{
          ...(p.from?{gte:p.from}:{}),...(p.to?{lt:p.to}:{}),
        }}:{}),
      },
      select:{
        id:true,allocation_id:true,borrower_id:true,asset_id:true,quantity:true,
        returned:true,issued_by:true,issued_at:true,due_at:true,
        lend_handovers:{select:{loan_id:true,actor_id:true,movement_id:true,remarks:true,created_at:true}},
        users_lend_loans_borrower_idTousers:{
          select:{display_name:true,batch_id:true},
        },
        lend_returns:{
          select:{id:true,quantity:true,condition:true,actor_id:true,created_at:true},
          orderBy:{created_at:'asc'},
        },
        lend_allocations:{select:{lend_lines:{select:{
          item_id:true,lab_id:true,request_id:true,lecturer_id:true,hod_id:true,
          inv_items:{select:{name:true}},
          laboratories:{select:{name:true}},
        }}}},
      },
      orderBy:[{issued_at:'desc'},{id:'asc'}],take:10001,
    });
    const now=new Date();
    const entries=results.filter(n=>{
      const l=n.lend_allocations.lend_lines;
      const status=n.returned>=n.quantity?'history':n.due_at&&n.due_at<now?'overdue':'active';
      return authorized(n.borrower_id,l.lecturer_id,l.hod_id,l.lab_id) &&
        (body.batchId===undefined||n.users_lend_loans_borrower_idTousers.batch_id===body.batchId) &&
        (body.status===undefined||(body.status==='active'
          ?n.returned<n.quantity:status===body.status));
    }).map(n=>{
      const l=n.lend_allocations.lend_lines;
      const status=n.returned>=n.quantity?'history':n.due_at&&n.due_at<now?'overdue':'active';
      return {id:n.id,borrowerId:n.borrower_id,
        borrower:n.users_lend_loans_borrower_idTousers.display_name,
        batchId:n.users_lend_loans_borrower_idTousers.batch_id,
        assetId:n.asset_id,quantity:n.quantity,returned:n.returned,
        outstanding:n.quantity-n.returned,dueAt:n.due_at,issuedAt:n.issued_at,
        issuedBy:n.issued_by,itemId:l.item_id,item:l.inv_items.name,
        labId:l.lab_id,labName:l.laboratories.name,
        handover:n.lend_handovers,
        requestId:l.request_id,status,
        returns:n.lend_returns.map(t=>({
          id:t.id,quantity:t.quantity,condition:t.condition,
          actorId:t.actor_id,createdAt:t.created_at,
        }))};
    });
    if(kind==='metrics')return {metrics:{
      loans:entries.length,
      issuedQuantity:entries.reduce((sum,n)=>sum+n.quantity,0),
      outstandingQuantity:entries.reduce((sum,n)=>sum+n.outstanding,0),
      overdueLoans:entries.filter(n=>n.status==='overdue').length,
    }};
    return {items:entries.slice(p.offset,p.offset+p.limit),limit:p.limit,offset:p.offset};
  });
}
