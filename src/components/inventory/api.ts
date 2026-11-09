import { api,ApiError } from '@/components/identity/api';
export type Named={id:string;name:string;labId?:string};
export type Item={id:string;name:string;kind:string;categoryId?:string;uom?:string};
export type Stock={id:string;itemId:string;labId:string;locationId:string;assetId?:string|null;state:string;quantity:number;version:number};
export type Asset={id:string;itemId:string;serial?:string|null;state?:string};
export type Movement={id:string;itemId?:string;reason?:string;createdAt:string;kind:string;entries?:{cellId:string|null;account:string;delta:number}[]};
export type Adjustment={id:string;itemId:string;labId:string;locationId:string;quantity:number;reason:string;proposer:string;state:string;direction:string};
export type Page<T>={items:T[];limit:number;offset:number};
export type Preview={id:string;committed?:boolean;rowCount:number;rows:Record<string,unknown>[]};
function normalize(value:unknown):unknown{if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),normalize(item)]));return value;}
export async function inventoryRead<T>(path:string,signal?:AbortSignal):Promise<T>{return normalize(await api<unknown>(path.startsWith('/api/')?path:'/api/inventory/'+path,{signal})) as T;}
export type ImportIssue={row:number;column:string;code:string};
export class InventoryError extends ApiError {constructor(status:number,message:string,public issues:ImportIssue[]=[]){super(status,message);}}
export async function inventoryWrite<T>(path:string,body:unknown,csrfToken:string):Promise<T>{
 const response=await fetch('/api/inventory/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const issues:ImportIssue[]=Array.isArray(data?.errors)?data.errors.filter((issue:ImportIssue)=>Number.isInteger(issue?.row)&&typeof issue.column==='string'&&typeof issue.code==='string'):[];throw new InventoryError(response.status,response.status===409?'Conflict: reload current stock and review again.':response.status===403?'Permission denied.':response.status===401?'Session ended. Sign in again.':issues.length?'Server validation rejected the file. Review the row errors.':'Request failed. Check history before repeating an uncertain operation.',issues);}
 return data as T;
}
export function commandId(){return crypto.randomUUID();}




