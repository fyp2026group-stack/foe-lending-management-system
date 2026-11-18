import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { checkCommand, commandInput, expectedVersion, lockLending, recordCommand } from './lending-native-common';

type Operation = 'extensions'|'extension-decisions';
export async function changeLendingExtension(token:string,csrf:string,op:Operation,p:Record<string,unknown>) {
  const allowed = op === 'extensions'
    ? ['commandId','loanId','expectedVersion','proposedDueAt','reason']
    : ['commandId','extensionId','expectedVersion','decision','remarks'];
  const invalid = commandInput(p,allowed);
  if(invalid)return invalid;
  if(!expectedVersion(p.expectedVersion) ||
    (op === 'extensions'
      ? !isUuid(p.loanId) || typeof p.proposedDueAt!=='string' ||
        Number.isNaN(Date.parse(p.proposedDueAt)) ||
        typeof p.reason!=='string' || p.reason.trim().length<1 || p.reason.trim().length>1000
      : !isUuid(p.extensionId) || !['APPROVE','REJECT'].includes(String(p.decision)) ||
        typeof p.remarks!=='string' || p.remarks.trim().length<1 || p.remarks.trim().length>1000))
    return {status:422,code:'INVALID'};
  try {
    return await nativeOrmTransaction(async tx=>{
      const auth=await authorizePrismaSession(tx,token,{csrf});
      if(isAuthFailure(auth))return auth;
      await lockLending(tx);
      const extension=op==='extension-decisions'?
        await tx.lend_extensions.findUnique({where:{id:p.extensionId as string},
          select:{id:true,loan_id:true,previous_due_at:true,proposed_due_at:true,status:true,version:true}}):null;
      if(op==='extension-decisions'&&!extension)return {status:403,code:'DENIED'};
      const loan=await tx.lend_loans.findUnique({
        where:{id:op==='extensions'?p.loanId as string:extension!.loan_id},
        select:{id:true,borrower_id:true,asset_id:true,returned:true,quantity:true,
          due_at:true,original_due_at:true,version:true,
          lend_allocations:{select:{lend_lines:{
            select:{policy:true,lecturer_id:true,hod_id:true,lab_id:true},
          }}},
        },
      });
      if(!loan)return {status:403,code:'DENIED'};
      const line=loan.lend_allocations.lend_lines;
      if(op==='extensions'&&loan.borrower_id!==auth.userId)return {status:403,code:'DENIED'};
      if(op==='extension-decisions'){
        if(auth.userId===loan.borrower_id)return {status:403,code:'DENIED'};
        if(['HOD','BOTH'].includes(line.policy)){
          if(line.hod_id!==auth.userId||!auth.roles.includes('ADMIN'))
            return {status:403,code:'DENIED'};
        }else{
          if(!auth.roles.includes('LECTURER')||
            (line.policy!=='NONE'&&line.lecturer_id!==auth.userId))
            return {status:403,code:'DENIED'};
          const covered=await tx.staff_labs.findUnique({
            where:{user_id_laboratory_id:{user_id:auth.userId,laboratory_id:line.lab_id}},
            select:{user_id:true},
          });
          if(!covered)return {status:403,code:'DENIED'};
        }
      }
      const replay=await checkCommand(tx,auth.userId,op,p);
      if(replay)return replay;
      const version=op==='extensions'?loan.version:extension!.version;
      if(version!==p.expectedVersion)return {status:409,code:'STALE_VERSION'};
      if(!loan.asset_id||loan.returned>=loan.quantity||!loan.due_at)
        return {status:409,code:'STATE_CONFLICT'};
      let result:Record<string,unknown>;
      if(op==='extensions'){
        const proposed=new Date(p.proposedDueAt as string);
        if(proposed<=new Date()||proposed<=loan.due_at)return {status:422,code:'INVALID'};
        const existing=await tx.lend_extensions.findFirst({
          where:{loan_id:loan.id,status:'PENDING'},select:{id:true},
        });
        if(existing)return {status:409,code:'STATE_CONFLICT'};
        const created=await tx.lend_extensions.create({
          data:{loan_id:loan.id,requested_by:auth.userId,
            previous_due_at:loan.due_at,proposed_due_at:proposed,
            reason:(p.reason as string).trim()},
          select:{id:true,status:true,version:true},
        });
        result={extensionId:created.id,status:created.status,version:created.version};
      }else{
        if(extension!.status!=='PENDING'||extension!.previous_due_at.getTime()!==loan.due_at.getTime()||
          extension!.proposed_due_at<=new Date())return {status:409,code:'STATE_CONFLICT'};
        const next=p.decision as string;
        const changed=await tx.lend_extensions.updateMany({
          where:{id:extension!.id,version:extension!.version,status:'PENDING'},
          data:{status:next,version:{increment:1}},
        });
        if(changed.count!==1)throw Error('STALE_VERSION');
        await tx.lend_extension_decisions.create({
          data:{extension_id:extension!.id,actor_id:auth.userId,
            decision:next,remarks:(p.remarks as string).trim()},
          select:{id:true},
        });
        let dueAt: Date | null = loan.due_at, loanVersion=loan.version;
        if(next==='APPROVE'){
          const updated=await tx.lend_loans.update({
            where:{id:loan.id},data:{due_at:extension!.proposed_due_at},
            select:{due_at:true,version:true},
          });
          dueAt=updated.due_at;loanVersion=updated.version;
        }
        result={extensionId:extension!.id,version:extension!.version+1,
          status:next,loanVersion,dueAt,originalDueAt:loan.original_due_at};
      }
      await recordCommand(tx,auth.userId,op,p,result,
        op==='extensions'?loan.id:extension!.id);
      return result;
    });
  }catch(error){
    if(error instanceof Error&&error.message==='STALE_VERSION')
      return {status:409,code:'STALE_VERSION'};
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')
      return {status:409,code:'STATE_CONFLICT'};
    throw error;
  }
}
