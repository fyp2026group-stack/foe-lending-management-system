import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

type Read = 'borrowed'|'expected'|'overdue'|'inspections'|'maintenance'|
  'extensions'|'borrower-history'|'handover-assets';

export async function readPhysicalLending(token:string,op:Read,p:Record<string,unknown>){
  if(Object.keys(p).some(k=>!['requestId','loanId','allocationId','labId','status','limit','offset'].includes(k)) ||
    ['requestId','loanId','allocationId','labId'].some(k=>p[k]!==undefined&&!isUuid(p[k])))
    return {status:422,code:'INVALID'};
  const n=(v:unknown,d:number)=>v===undefined?d:
    typeof v==='string'&&/^\d+$/.test(v)?Number(v):
    typeof v==='number'&&Number.isSafeInteger(v)?v:NaN;
  const limit=n(p.limit,50),offset=n(p.offset,0);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||
    !Number.isSafeInteger(offset)||offset<0||offset>10000)return {status:422,code:'INVALID'};
  const statuses:Record<string,readonly string[]>={
    inspections:['UNRESOLVED','CLEAR_AVAILABLE','ROUTE_MAINTENANCE'],
    maintenance:['OPEN','IN_PROGRESS','RESOLVED_AVAILABLE','RETIRED'],
    extensions:['PENDING','APPROVE','REJECT'],
  };
  if(p.status!==undefined&&!(statuses[op]??[]).includes(String(p.status)))
    return {status:422,code:'INVALID'};
  return nativeOrmTransaction(async tx=>{
    const auth=await authorizePrismaSession(tx,token);
    if(isAuthFailure(auth))return auth;
    const labs=(auth.roles.includes('TECHNICAL_OFFICER')||auth.roles.includes('LECTURER'))
      ?new Set((await tx.staff_labs.findMany({
        where:{user_id:auth.userId},select:{laboratory_id:true},
      })).map(x=>x.laboratory_id)):new Set<string>();
    if(op==='handover-assets'){
      if(!p.allocationId)return {status:422,code:'INVALID'};
      const allocation=await tx.lend_allocations.findUnique({
        where:{id:p.allocationId as string},
        select:{id:true,cell_id:true,
          lend_lines:{select:{item_id:true,lab_id:true,location_id:true,
            lend_requests:{select:{borrower_id:true}}}},
        },
      });
      if(!allocation)return {status:403,code:'DENIED'};
      const line=allocation.lend_lines;
      if(!auth.roles.includes('TECHNICAL_OFFICER') ||
        !labs.has(line.lab_id) || line.lend_requests.borrower_id===auth.userId)
        return {status:403,code:'DENIED'};
      const assets=await tx.inv_cells.findMany({
        where:{
          item_id:line.item_id,lab_id:line.lab_id,location_id:line.location_id,
          asset_id:{not:null},quantity:1,
          OR:[{state:'AVAILABLE'},{state:'RESERVED',id:allocation.cell_id}],
        },
        select:{asset_id:true,state:true,version:true,
          inv_assets:{select:{serial:true}}},
        orderBy:{asset_id:'asc'},skip:offset,take:limit,
      });
      return {items:assets.map(a=>({assetId:a.asset_id,serial:a.inv_assets?.serial,
        state:a.state,version:a.version})),limit,offset};
    }
    const loans=await tx.lend_loans.findMany({
      where:{
        ...(p.loanId?{id:p.loanId as string}:{}),
        ...(p.allocationId?{allocation_id:p.allocationId as string}:{}),
        ...(p.requestId?{lend_allocations:{lend_lines:{request_id:p.requestId as string}}}:{}),
        ...(p.labId?{lend_allocations:{lend_lines:{lab_id:p.labId as string}}}:{}),
      },
      select:{
        id:true,allocation_id:true,borrower_id:true,asset_id:true,
        quantity:true,returned:true,issued_at:true,due_at:true,original_due_at:true,
        version:true,
        inv_assets:{select:{serial:true}},
        lend_allocations:{select:{lend_lines:{select:{
          request_id:true,lab_id:true,policy:true,lecturer_id:true,hod_id:true,
          inv_items:{select:{name:true}},
        }}}},
        lend_returns:{select:{
          id:true,loan_id:true,actor_id:true,quantity:true,condition:true,
          created_at:true,
          lend_inspections:{select:{
            id:true,return_id:true,asset_id:true,borrower_id:true,status:true,
            version:true,created_at:true,
            lend_inspection_events:{select:{
              id:true,inspection_id:true,actor_id:true,outcome:true,
              condition:true,notes:true,version:true,created_at:true,
            },orderBy:{version:'asc'}},
            lend_maintenance:{select:{
              id:true,inspection_id:true,status:true,version:true,created_by:true,
              created_at:true,updated_at:true,
              lend_maintenance_events:{select:{
                id:true,maintenance_id:true,actor_id:true,status:true,notes:true,
                version:true,created_at:true,
              },orderBy:{version:'asc'}},
            }},
          }},
        },orderBy:{created_at:'desc'}},
        lend_extensions:{select:{
          id:true,loan_id:true,requested_by:true,previous_due_at:true,
          proposed_due_at:true,reason:true,status:true,version:true,created_at:true,
          lend_extension_decisions:{select:{
            id:true,extension_id:true,actor_id:true,decision:true,remarks:true,created_at:true,
          }},
        }},
      },
      orderBy:[{issued_at:'desc'},{id:'asc'}],take:10001,
    });
    const now=new Date();
    const items=[];
    for(const loan of loans){
      const line=loan.lend_allocations.lend_lines;
      const officer=auth.roles.includes('TECHNICAL_OFFICER') &&
        labs.has(line.lab_id)&&loan.borrower_id!==auth.userId;
      const extensionApprover=loan.borrower_id!==auth.userId &&
        (['HOD','BOTH'].includes(line.policy)
          ? auth.roles.includes('ADMIN')&&line.hod_id===auth.userId
          : auth.roles.includes('LECTURER')&&labs.has(line.lab_id)&&
            (line.policy==='NONE'||line.lecturer_id===auth.userId));
      if(!(auth.roles.includes('ADMIN')||loan.borrower_id===auth.userId||
        officer||op==='extensions'&&extensionApprover))continue;
      if(op==='borrower-history'&&loan.borrower_id!==auth.userId)continue;
      const inspection=loan.lend_returns.find(r=>r.lend_inspections)?.lend_inspections;
      const maintenance=inspection?.lend_maintenance;
      const extension=loan.lend_extensions;
      if(op==='extensions'&&(!extension ||
          (p.status!==undefined&&extension.status!==p.status)))continue;
      if(op==='inspections'&&(!inspection||
          inspection.status!==(p.status??'UNRESOLVED')))continue;
      if(op==='maintenance'&&(!maintenance||
          (p.status!==undefined
            ?maintenance.status!==p.status
            :!['OPEN','IN_PROGRESS'].includes(maintenance.status))))continue;
      if(['borrowed','expected','overdue'].includes(op)&&
        (!loan.asset_id||loan.returned>=loan.quantity||
          (op==='overdue'&&!(loan.due_at&&loan.due_at<now))))continue;
      const result={
        id:loan.id,loanId:loan.id,requestId:line.request_id,
        allocationId:loan.allocation_id,borrowerId:loan.borrower_id,
        item:line.inv_items.name,labId:line.lab_id,
        assetId:loan.asset_id,serial:loan.inv_assets?.serial??null,
        quantity:loan.quantity,returned:loan.returned,
        outstandingQuantity:loan.quantity-loan.returned,dueAt:loan.due_at,
        originalDueAt:loan.original_due_at,version:loan.version,
        overdue:Boolean(loan.due_at&&loan.due_at<now&&loan.returned<loan.quantity),
        issuedAt:loan.issued_at,
        inspection:inspection?{
          ...inspection,receipt:loan.lend_returns.find(r=>r.id===inspection.return_id),
          events:inspection.lend_inspection_events,
        }:null,
        maintenance:maintenance?{...maintenance,events:maintenance.lend_maintenance_events}:null,
        extension:extension?{...extension,decision:extension.lend_extension_decisions}:null,
      };
      items.push(result);
    }
    return {items:items.slice(offset,offset+limit),limit,offset};
  });
}
