type Admission = {status?:number;code?:string;admitted?:boolean};
export async function runAdmitted<T>(admit:()=>Promise<Admission>,work:()=>Promise<T>):Promise<Admission|T>{
 const result=await admit();
 if(result.admitted!==true)return {status:result.status??503,code:result.code??'ADMISSION_UNAVAILABLE'};
 return work();
}
