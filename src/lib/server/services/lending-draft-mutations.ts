import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { checkCommand, commandInput, expectedVersion, lockLending, recordCommand } from './lending-native-common';
import { insertValidatedRequest, parseRequestPayload } from './lending-request-mutations';

type Operation='drafts'|'submit'|'revisions';
export async function changeLendingDraft(token:string,csrf:string,operation:Operation,p:Record<string,unknown>){
  const keys=operation==='drafts'
    ? ['commandId','draftId','expectedVersion','purpose','collectAt','returnAt','lecturerId','lines']
    : operation==='submit'
      ? ['commandId','draftId','expectedVersion']
      : ['commandId','requestId','expectedVersion'];
  const issue=commandInput(p,keys);
  if(issue)return issue;
  if((operation==='drafts' && (p.draftId!==undefined&&(!isUuid(p.draftId)||!expectedVersion(p.expectedVersion)))) ||
     (operation==='submit' && (!isUuid(p.draftId)||!expectedVersion(p.expectedVersion))) ||
     (operation==='revisions' && (!isUuid(p.requestId)||!expectedVersion(p.expectedVersion))))
    return {status:422,code:'INVALID'};
  const body=operation==='drafts'?Object.fromEntries(Object.entries(p).filter(([k])=>
    !['commandId','draftId','expectedVersion'].includes(k))):null;
  if(body && (!Array.isArray(body.lines)||body.lines.length>20||
    Buffer.byteLength(JSON.stringify(body),'utf8')>90000))
    return {status:422,code:'INVALID'};
  try {
    return await nativeOrmTransaction(async tx=>{
      const auth=await authorizePrismaSession(tx,token,{csrf});
      if(isAuthFailure(auth))return auth;
      await lockLending(tx);
      const draft=operation==='revisions'?null:
        p.draftId ? await tx.lend_drafts.findUnique({
          where:{id:p.draftId as string},
          select:{id:true,borrower_id:true,version:true,payload:true,
            submitted_id:true,cancelled:true,predecessor_id:true},
        }):null;
      if((operation==='submit'||p.draftId!==undefined)&&
        (!draft||draft.borrower_id!==auth.userId))
        return {status:403,code:'DENIED'};
      const existing=await checkCommand(tx,auth.userId,operation,p);
      if(existing)return existing;
      if(draft && draft.version!==p.expectedVersion)
        return {status:409,code:'STALE_VERSION'};
      if(draft&&(draft.submitted_id||draft.cancelled))
        return {status:409,code:'STATE_CONFLICT'};
      let result:Record<string,unknown>,target:string;
      if(operation==='drafts'){
        if(draft){
          const changed=await tx.lend_drafts.updateMany({
            where:{id:draft.id,version:draft.version,submitted_id:null,cancelled:false},
            data:{payload:body as Prisma.InputJsonValue,version:{increment:1},updated_at:new Date()},
          });
          if(changed.count!==1)throw Error('STALE_VERSION');
          result={id:draft.id,version:draft.version+1,summary:'DRAFT'};
          target=draft.id;
        }else{
          const created=await tx.lend_drafts.create({
            data:{id:randomUUID(),borrower_id:auth.userId,payload:body as Prisma.InputJsonValue},
            select:{id:true,version:true},
          });
          result={id:created.id,version:created.version,summary:'DRAFT'};
          target=created.id;
        }
      }else if(operation==='submit'){
        if(!draft!.payload||typeof draft!.payload!=='object'||Array.isArray(draft!.payload))
          return {status:422,code:'INVALID'};
        const parsed=parseRequestPayload({...draft!.payload as Record<string,unknown>,commandId:p.commandId});
        if(!parsed)return {status:422,code:'INVALID'};
        const inserted=await insertValidatedRequest(tx,auth.userId,parsed);
        if('status' in inserted)return inserted;
        const previous=draft!.predecessor_id?await tx.lend_requests.findUnique({
          where:{id:draft!.predecessor_id},select:{revision:true},
        }):null;
        await tx.lend_requests.update({
          where:{id:inserted.id},
          data:{predecessor_id:draft!.predecessor_id,revision:(previous?.revision??0)+1},
          select:{id:true},
        });
        const changed=await tx.lend_drafts.updateMany({
          where:{id:draft!.id,version:draft!.version,submitted_id:null,cancelled:false},
          data:{submitted_id:inserted.id,version:{increment:1},updated_at:new Date()},
        });
        if(changed.count!==1)throw Error('STALE_VERSION');
        result={id:inserted.id,draftId:draft!.id,version:draft!.version+1};
        target=inserted.id;
      }else{
        const request=await tx.lend_requests.findUnique({
          where:{id:p.requestId as string},
          select:{id:true,borrower_id:true,version:true,purpose:true,
            collect_at:true,return_at:true,
            lend_lines:{where:{stage:'REJECTED'},
              select:{item_id:true,lab_id:true,location_id:true,quantity:true,lecturer_id:true}},
          },
        });
        if(!request||request.borrower_id!==auth.userId)return {status:403,code:'DENIED'};
        if(request.version!==p.expectedVersion)return {status:409,code:'STALE_VERSION'};
        if(!request.lend_lines.length)return {status:409,code:'STATE_CONFLICT'};
        const payload={
          purpose:request.purpose,collectAt:request.collect_at.toISOString(),
          returnAt:request.return_at.toISOString(),
          lecturerId:request.lend_lines.find(x=>x.lecturer_id)?.lecturer_id??null,
          lines:request.lend_lines.map(l=>({
            itemId:l.item_id,labId:l.lab_id,locationId:l.location_id,quantity:l.quantity,
          })),
        };
        const created=await tx.lend_drafts.create({
          data:{id:randomUUID(),borrower_id:auth.userId,
            predecessor_id:request.id,payload:payload as Prisma.InputJsonValue},
          select:{id:true,version:true},
        });
        result={id:created.id,version:created.version,
          predecessorId:request.id,summary:'DRAFT'};
        target=created.id;
      }
      await recordCommand(tx,auth.userId,operation,p,result,target);
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
