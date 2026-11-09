import {handle,ApiError,recordDenial} from "@/lib/server/identity";
export const runtime="nodejs";
async function route(r:Request,{params}:{params:Promise<{path:string[]}>}){
 try{const result=await handle(r,(await params).path);const headers:Record<string,string>={"Cache-Control":"no-store"};if(result?.cookie)headers["Set-Cookie"]=result.cookie;return Response.json(result?.data??{}, {status:result?.status??200,headers});}
 catch(e){if(e instanceof ApiError){try{await recordDenial(r,e.code);}catch{console.error("Denial audit unavailable");}}return Response.json({code:e instanceof ApiError?e.code:"UNAVAILABLE",correlationId:crypto.randomUUID()},{status:e instanceof ApiError?e.status:503,headers:{"Cache-Control":"no-store"}});}
}
export {route as GET,route as POST,route as PATCH};



