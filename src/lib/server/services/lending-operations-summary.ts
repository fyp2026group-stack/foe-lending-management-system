import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

/** Officer's completed physical events, excluding unrelated laboratories. */
export async function readOfficerOperations(token:string,body:Record<string,unknown>){
  if(Object.keys(body).some(k=>!['from','to','labId'].includes(k)) ||
    typeof body.from!=='string'||typeof body.to!=='string'||
    (body.labId!==undefined&&!isUuid(body.labId)))
    return {status:422,code:'INVALID'};
  const from=new Date(body.from),to=new Date(body.to);
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||
    from>=to||to.getTime()-from.getTime()>31*86400_000)
    return {status:422,code:'INVALID'};
  return nativeOrmTransaction(async tx=>{
    const auth=await authorizePrismaSession(tx,token,{requiredRoles:['TECHNICAL_OFFICER']});
    if(isAuthFailure(auth))return auth;
    const covered=await tx.staff_labs.findMany({
      where:{user_id:auth.userId,...(body.labId?{laboratory_id:body.labId as string}:{})},
      select:{laboratory_id:true,laboratories:{select:{id:true,name:true}}},
    });
    const labIds=covered.map(x=>x.laboratory_id);
    if(!labIds.length)
      return {from,to,laboratories:[],completed:{
        handovers:0,receipts:0,inspections:0,maintenance:0,total:0}};
    const between={gte:from,lt:to};
    const [handovers,receipts,inspections,maintenance]=await Promise.all([
      tx.lend_loans.count({
        where:{issued_at:between,lend_allocations:{lend_lines:{lab_id:{in:labIds}}}},
      }),
      tx.lend_returns.count({
        where:{created_at:between,lend_loans:{
          lend_allocations:{lend_lines:{lab_id:{in:labIds}}},
        }},
      }),
      tx.lend_inspection_events.count({
        where:{created_at:between,
          outcome:{in:['CLEAR_AVAILABLE','ROUTE_MAINTENANCE']},
          lend_inspections:{inv_assets:{lab_id:{in:labIds}}},
        },
      }),
      tx.lend_maintenance_events.count({
        where:{created_at:between,status:{in:['RESOLVED_AVAILABLE','RETIRED']},
          lend_maintenance:{lend_inspections:{inv_assets:{lab_id:{in:labIds}}}},
        },
      }),
    ]);
    return {
      from,to,laboratories:covered.map(x=>x.laboratories)
        .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),
      completed:{handovers,receipts,inspections,maintenance,
        total:handovers+receipts+inspections+maintenance},
    };
  });
}
