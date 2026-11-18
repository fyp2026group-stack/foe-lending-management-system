import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

/** Borrowing wizard sources: no serial number, asset identity or unrestricted stock listing. */
export async function readBorrowingSources(token:string, p:Record<string,unknown>) {
  if (Object.keys(p).some(k=>!['labId','limit','offset'].includes(k)) ||
    (p.labId!==undefined&&!isUuid(p.labId))) return {status:422,code:'INVALID'};
  const numeric=(v:unknown,d:number)=>v===undefined?d:
    typeof v==='number'&&Number.isSafeInteger(v)?v:
    typeof v==='string'&&/^\d+$/.test(v)?Number(v):NaN;
  const limit=numeric(p.limit,100),offset=numeric(p.offset,0);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||
    !Number.isSafeInteger(offset)||offset<0||offset>100000)
    return {status:422,code:'INVALID'};
  return nativeOrmTransaction(async tx=>{
    const auth=await authorizePrismaSession(tx,token);
    if(isAuthFailure(auth))return auth;
    const cells=await tx.inv_cells.findMany({
      where:{
        state:'AVAILABLE',asset_id:null,quantity:{gt:0},
        ...(p.labId?{lab_id:p.labId as string}:{}),
        inv_items:{active:true,inv_categories:{active:true}},
        laboratories:{active:true},inv_locations:{active:true},
      },
      select:{
        item_id:true,lab_id:true,location_id:true,quantity:true,
        inv_items:{select:{
          name:true,kind:true,uom:true,
          lend_policies:{select:{policy:true,hod_id:true}},
        }},
        laboratories:{select:{name:true}},
        inv_locations:{select:{name:true}},
      },
      take:10001,
    });
    const labIds=[...new Set(cells.map(x=>x.lab_id))];
    const lecturers=await tx.users.findMany({
      where:{
        disabled:false,id:{not:auth.userId},
        user_roles:{some:{role:'LECTURER'}},
        staff_labs:{some:{laboratory_id:{in:labIds}}},
      },
      select:{id:true,staff_labs:{select:{laboratory_id:true}}},
    });
    const coverage=new Map(labIds.map(id=>[
      id,new Set(lecturers.filter(l=>l.staff_labs.some(s=>s.laboratory_id===id))
        .map(x=>x.id)),
    ]));
    const hodIds=[...new Set(cells.map(x=>x.inv_items.lend_policies?.hod_id)
      .filter((x):x is string=>Boolean(x)))];
    const hodUsers=await tx.users.findMany({
      where:{id:{in:hodIds},disabled:false,user_roles:{some:{role:'ADMIN'}}},
      select:{id:true},
    });
    const activeHods=new Set(hodUsers.map(x=>x.id));
    const grouped=new Map<string,{
      itemId:string;item:string;kind:string;uom:string;
      labId:string;lab:string;locationId:string;location:string;
      availableQuantity:number;policy:string;
    }>();
    for(const c of cells){
      const policy=c.inv_items.lend_policies;
      if(!policy)continue;
      const hodNeeded=['HOD','BOTH'].includes(policy.policy);
      const lecturerNeeded=['LECTURER','BOTH'].includes(policy.policy);
      if(hodNeeded&&(!policy.hod_id||policy.hod_id===auth.userId||
        !activeHods.has(policy.hod_id)))continue;
      if(lecturerNeeded&&!Array.from(coverage.get(c.lab_id)??[]).some(x=>
        x!==policy.hod_id))continue;
      const key=[c.item_id,c.lab_id,c.location_id].join('/');
      const previous=grouped.get(key);
      if(previous){previous.availableQuantity+=c.quantity;continue;}
      grouped.set(key,{
        itemId:c.item_id,item:c.inv_items.name,kind:c.inv_items.kind,
        uom:c.inv_items.uom,labId:c.lab_id,lab:c.laboratories.name,
        locationId:c.location_id,location:c.inv_locations.name,
        availableQuantity:c.quantity,policy:policy.policy,
      });
    }
    const items=[...grouped.values()].sort((a,b)=>
      a.item.localeCompare(b.item)||a.lab.localeCompare(b.lab)||
      a.location.localeCompare(b.location));
    return {items:items.slice(offset,offset+limit),limit,offset};
  });
}
