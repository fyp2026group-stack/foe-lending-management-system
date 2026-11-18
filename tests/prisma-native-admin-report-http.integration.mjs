// HTTP regression using exclusively the clean Prisma migration schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
import { hashPassword } from '../src/lib/server/password.mjs';

test('native Prisma administration, inventory catalogue, and report export', async () => {
  const cfg=configuration(process.env);
  assert.equal(cfg.origin,'http://127.0.0.1:3000');
  const db=new pg.Client({connectionString:cfg.database,connectionTimeoutMillis:3000});
  await db.connect();
  const suffix=randomUUID();
  const adminId=randomUUID(), studentId=randomUUID();
  const password=randomBytes(24).toString('hex');
  try{
    await db.query('BEGIN');
    try{
      for(const [id,role] of [[adminId,'ADMIN'],[studentId,'STUDENT']]){
        await db.query(
          'INSERT INTO lab.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',
          [id,'native-'+role.toLowerCase()+'-'+suffix+'@example.invalid',
            'Native '+role+' '+suffix.slice(0,8),hashPassword(password)]
        );
        await db.query('INSERT INTO lab.user_roles(user_id,role) VALUES($1,$2)',[id,role]);
      }
      await db.query('COMMIT');
    }catch(error){await db.query('ROLLBACK');throw error;}
    async function request(path,actor,body=null,method='POST'){
      const resp=await fetch(cfg.origin+'/api/'+path,{
        method:body===null?'GET':method,redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{
          ...(body!==null?{Origin:cfg.origin,'Content-Type':'application/json'}:{}),
          ...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),
        },
        ...(body!==null?{body:JSON.stringify(body)}:{}),
      });
      const contentType=resp.headers.get('content-type')??'';
      return {
        status:resp.status,
        data:contentType.includes('application/json')?await resp.json():await resp.text(),
        headers:resp.headers,
      };
    }
    const actors={};
    for(const [name,id] of [['admin',adminId],['student',studentId]]){
      const email='native-'+name+'-'+suffix+'@example.invalid';
      const result=await request('auth/login',null,{email,password});
      assert.equal(result.status,200,name+' login '+JSON.stringify(result.data));
      actors[name]={cookie:result.headers.get('set-cookie')?.split(';')[0],
        csrf:result.data.csrfToken,id};
    }
    const me=await request('auth/me',actors.admin);
    assert.equal(me.status,200);
    assert.ok(me.data.user.roles.includes('ADMIN'));
    const denied=await request('admin/users',actors.student);
    assert.equal(denied.status,403);
    const batch=await request('admin/batches',actors.admin,{name:'Native E2E batch '+suffix});
    assert.equal(batch.status,201,JSON.stringify(batch.data));
    const laboratory=await request('admin/laboratories',actors.admin,{name:'Native E2E lab '+suffix});
    assert.equal(laboratory.status,201,JSON.stringify(laboratory.data));
    const users=await request('admin/users',actors.admin);
    assert.equal(users.status,200);
    assert.ok(users.data.items.some(x=>x.id===adminId));
    const batches=await request('admin/batches',actors.admin);
    assert.ok(batches.data.items.some(x=>x.id===batch.data.id));
    const category=await request('inventory/categories',actors.admin,{
      commandId:randomUUID(),name:'Native E2E equipment category '+suffix,
    });
    assert.equal(category.status,200,JSON.stringify(category.data));
    const categoryId=category.data.id;
    const item=await request('inventory/items',actors.admin,{
      commandId:randomUUID(),categoryId,name:'Native E2E multimeter '+suffix,
      kind:'RETURNABLE',uom:'unit',specifications:{manufacturer:'Synthetic'},
    });
    assert.equal(item.status,200,JSON.stringify(item.data));
    const listing=await request('inventory/items',actors.admin);
    assert.equal(listing.status,200,JSON.stringify(listing.data));
    assert.ok(listing.data.items.some(x=>x.id===item.data.id));
    const report=await request('admin/reports?report=audit&format=json',actors.admin);
    assert.equal(report.status,200,JSON.stringify(report.data));
    assert.ok(report.data.items.length>=1);
    assert.ok(report.data.items.some(x=>x.action==='CREATE_BATCH'||x.action==='CREATE_LABORATORY'));
    const noReport=await request('admin/reports?report=audit&format=json',actors.student);
    assert.equal(noReport.status,403);
    const csv=await request('admin/reports?report=audit&format=csv',actors.admin);
    assert.equal(csv.status,200,String(csv.data).slice(0,350));
    assert.match(csv.headers.get('content-type'),/text\/csv/);
    const xlsx=await fetch(cfg.origin+'/api/admin/reports?report=inventory&format=xlsx',{
      headers:{Cookie:actors.admin.cookie},
      signal:AbortSignal.timeout(15000),
    });
    assert.equal(xlsx.status,200);
    assert.match(xlsx.headers.get('content-type'),/spreadsheetml/);
    const data=new Uint8Array(await xlsx.arrayBuffer());
    assert.equal(String.fromCharCode(data[0],data[1]),'PK');
  }finally{await db.end();}
});
