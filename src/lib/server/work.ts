import {scrypt} from 'node:crypto';
let active=0;
export async function derive(password:string,salt:string):Promise<Buffer>{
 if(active>=2)throw Error('PASSWORD_WORK_BUSY');active++;
 try{return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:33554432},(error,key)=>error?reject(error):resolve(key)));}finally{active--;}
}
export async function boundedBody(request:Request):Promise<string>{
 if(!request.body)return '';const reader=request.body.getReader();const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();throw Error('BODY_TOO_LARGE');}chunks.push(value);}return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}finally{reader.releaseLock();}
}
