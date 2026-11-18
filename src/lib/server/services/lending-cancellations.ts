import { Prisma } from '@prisma/client';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';
import { checkCommand, commandInput, expectedVersion, lockLending, recordCommand } from './lending-native-common';
import { ensureCell, postStockMovement } from './stock-ledger';

export async function cancelLending(token:string,csrf:string,p:Record<string,unknown>){
  const invalid=commandInput(p,['commandId','draftId','lineId','quantity','reason','expectedVersion']);
  if(invalid)return invalid;
  if(!expectedVersion(p.expectedVersion) ||
    (isUuid(p.draftId)===isUuid(p.lineId))||
    typeof p.reason!=='string'||p.reason.trim().length<1||
    p.reason.trim().length>1000 ||
    (p.draftId===undefined&&(!Number.isSafeInteger(p.quantity)||
      (p.quantity as number)<1||(p.quantity as number)>1000)))
    return {status:422,code:'INVALID'};
  try {
    return await nativeOrmTransaction(async tx=>{
      const auth=await authorizePrismaSession(tx,token,{csrf});
      if(isAuthFailure(auth))return auth;
      await lockLending(tx);
      const draft=p.draftId?await tx.lend_drafts.findUnique({
        where:{id:p.draftId as string},
        select:{id:true,borrower_id:true,version:true,submitted_id:true,cancelled:true},
      }):null;
      const line=p.lineId?await tx.lend_lines.findUnique({
        where:{id:p.lineId as string},
        select:{id:true,request_id:true,quantity:true,cancelled:true,stage:true,
          version:true,item_id:true,lab_id:true,location_id:true,
          lend_requests:{select:{borrower_id:true}},
          lend_allocations:{select:{id:true,cell_id:true,quantity:true,issued:true,cancelled:true,
            lend_reserved_assets:{where:{released:false},select:{
              asset_id:true,cell_id:true,released:true,
            }},
          }},
        },
      }):null;
      if(!draft&&!line)return {status:403,code:'DENIED'};
      if(draft&&draft.borrower_id!==auth.userId ||
        line&&line.lend_requests.borrower_id!==auth.userId)
        return {status:403,code:'DENIED'};
      const replay=await checkCommand(tx,auth.userId,'cancel',p);
      if(replay)return replay;
      const currentVersion=draft?.version??line!.version;
      if(currentVersion!==p.expectedVersion)return {status:409,code:'STALE_VERSION'};
      let result:Record<string,unknown>,target:string;
      if(draft){
        if(p.lineId!==undefined||p.quantity!==undefined||draft.submitted_id||draft.cancelled)
          return {status:409,code:'STATE_CONFLICT'};
        const changed=await tx.lend_drafts.updateMany({
          where:{id:draft.id,version:draft.version,cancelled:false,submitted_id:null},
          data:{cancelled:true,version:{increment:1},updated_at:new Date()},
        });
        if(changed.count!==1)throw Error('STALE_VERSION');
        result={id:draft.id,version:draft.version+1,summary:'CANCELLED'};
        target=draft.id;
      }else{
        if(!['LECTURER','HOD','APPROVED'].includes(line!.stage))
          return {status:409,code:'STATE_CONFLICT'};
        const allocation=line!.lend_allocations;
        const quantity=p.quantity as number;
        if(quantity>line!.quantity-line!.cancelled-(allocation?.issued??0))
          return {status:409,code:'STATE_CONFLICT'};
        if(allocation){
          const remaining=allocation.quantity-allocation.issued-allocation.cancelled;
          if(quantity>remaining)return {status:409,code:'STATE_CONFLICT'};
          let toRelease=quantity;
          for(const named of allocation.lend_reserved_assets){
            if(toRelease===0)break;
            const cell=await tx.inv_cells.findUnique({
              where:{id:named.cell_id},select:{quantity:true,state:true,
                asset_id:true,location_id:true},
            });
            if(!cell||cell.state!=='RESERVED'||cell.quantity!==1||
              cell.asset_id!==named.asset_id)throw Error('STATE_CONFLICT');
            const destination=await ensureCell(tx,{
              itemId:line!.item_id,labId:line!.lab_id,locationId:cell.location_id,
              assetId:named.asset_id,state:'AVAILABLE',
            });
            await postStockMovement(tx,{
              actorId:auth.userId,itemId:line!.item_id,labId:line!.lab_id,
              sourceCellId:named.cell_id,destCellId:destination.id,
              quantity:1,kind:'CANCEL_RESERVATION',reason:(p.reason as string).trim(),
            });
            await tx.lend_reserved_assets.update({
              where:{allocation_id_asset_id:{
                allocation_id:allocation.id,asset_id:named.asset_id,
              }},data:{released:true},
              select:{asset_id:true},
            });
            toRelease-=1;
          }
          if(toRelease>0){
            const destination=await ensureCell(tx,{
              itemId:line!.item_id,labId:line!.lab_id,locationId:line!.location_id,
              state:'AVAILABLE',
            });
            await postStockMovement(tx,{
              actorId:auth.userId,itemId:line!.item_id,labId:line!.lab_id,
              sourceCellId:allocation.cell_id,destCellId:destination.id,
              quantity:toRelease,kind:'CANCEL_RESERVATION',
              reason:(p.reason as string).trim(),
            });
          }
          await tx.lend_allocations.updateMany({
            where:{id:allocation.id,cancelled:allocation.cancelled},
            data:{cancelled:{increment:quantity}},
          });
        }
        const newCancelled=line!.cancelled+quantity;
        const stage=newCancelled===line!.quantity?'CANCELLED':line!.stage;
        const updated=await tx.lend_lines.updateMany({
          where:{id:line!.id,version:line!.version,cancelled:line!.cancelled},
          data:{cancelled:newCancelled,stage},
        });
        if(updated.count!==1)throw Error('STALE_VERSION');
        const newLine=await tx.lend_lines.findUniqueOrThrow({
          where:{id:line!.id},select:{version:true},
        });
        result={lineId:line!.id,version:newLine.version,
          cancelledQuantity:newCancelled,stage};
        target=line!.id;
      }
      await recordCommand(tx,auth.userId,'cancel',p,result,target);
      return result;
    });
  }catch(error){
    if(error instanceof Error && ['STATE_CONFLICT','STALE_VERSION','INSUFFICIENT_STOCK'].includes(error.message))
      return {status:409,code:error.message};
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002')
      return {status:409,code:'STATE_CONFLICT'};
    throw error;
  }
}
