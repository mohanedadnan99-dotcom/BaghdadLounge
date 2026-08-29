import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { captain360, company360, createTask, executiveDashboard, globalSearch, listCaptains360, listCompanies360, listTasks, maintenanceState, morningBrief, saveCompany360, setSetting, updateTask } from "@/lib/admin-control-db";
import { createApproval } from "@/lib/admin-security-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function auth(request:Request){const s=adminSessionFromRequest(request);if(!s)return {response:Response.json({message:"غير مصرح"},{status:401}),session:null};if(!["owner","manager"].includes(s.role))return {response:Response.json({message:"هذه الصفحة مخصصة للإدارة"},{status:403}),session:s};return {response:null,session:s}}

type CacheEntry={at:number;value:any};
const cache=new Map<string,CacheEntry>();
const TTL=5000;
function cached(key:string){const c=cache.get(key);return c&&Date.now()-c.at<TTL?c.value:null}
function put(key:string,value:any){cache.set(key,{at:Date.now(),value});return value}
function clearCache(){cache.clear()}

export async function GET(request:Request){const a=auth(request);if(a.response)return a.response;try{const u=new URL(request.url);const action=u.searchParams.get("action")||"dashboard";
  if(action==="dashboard"){
    const hit=cached("dashboard");if(hit)return Response.json(hit,{headers:{"Cache-Control":"private, max-age=3"}});
    const [dashboard,brief,maintenance,tasks]=await Promise.all([executiveDashboard(),morningBrief(),maintenanceState(),listTasks()]);
    const value=put("dashboard",{dashboard,brief,maintenance,tasks});return Response.json(value,{headers:{"Cache-Control":"private, max-age=3"}})
  }
  if(action==="companies"){const hit=cached("companies");if(hit)return Response.json(hit);const value=put("companies",{companies:await listCompanies360()});return Response.json(value)}
  if(action==="company")return Response.json({company:await company360(String(u.searchParams.get("name")||""))});
  if(action==="captains"){const hit=cached("captains");if(hit)return Response.json(hit);const value=put("captains",{captains:await listCaptains360()});return Response.json(value)}
  if(action==="captain")return Response.json({captain:await captain360(Number(u.searchParams.get("id")||0))});
  if(action==="search")return Response.json({results:await globalSearch(String(u.searchParams.get("q")||""))});
  if(action==="tasks")return Response.json({tasks:await listTasks()});return Response.json({message:"إجراء غير معروف"},{status:400})
}catch(error){console.error("Control GET",error);return Response.json({message:"تعذر تحميل مركز الإدارة"},{status:500})}}

export async function POST(request:Request){const a=auth(request);if(a.response)return a.response;try{const b=await request.json() as Record<string,unknown>;const action=String(b.action||"");const actor=a.session?.name||a.session?.username||"admin";if(action==="task"){const title=String(b.title||"").trim();if(title.length<2)return Response.json({message:"اكتب عنوان المهمة"},{status:400});const task=await createTask({title,details:String(b.details||""),entityType:String(b.entityType||"general"),entityKey:String(b.entityKey||""),priority:String(b.priority||"normal"),dueAt:b.dueAt?String(b.dueAt):null,actor});clearCache();return Response.json({task},{status:201})}return Response.json({message:"إجراء غير معروف"},{status:400})}catch(error){console.error("Control POST",error);return Response.json({message:"تعذر تنفيذ الإجراء"},{status:500})}}

export async function PATCH(request:Request){const a=auth(request);if(a.response)return a.response;try{const b=await request.json() as Record<string,unknown>;const action=String(b.action||"");const actor=a.session?.name||a.session?.username||"admin";if(action==="task"){const task=await updateTask(Number(b.id),String(b.status||"done"));clearCache();return Response.json({task})}if(action==="setting"){if(!roleCan(a.session!.role,"settings")&&a.session!.role!=="manager")return Response.json({message:"لا تملك صلاحية الإعدادات"},{status:403});const setting=await setSetting(String(b.key||""),String(b.value??""));clearCache();return Response.json({setting})}if(action==="company"){
  const companyName=String(b.companyName||"").trim();if(companyName.length<2)return Response.json({message:"اسم الشركة غير صحيح"},{status:400});
  const payload={companyName,status:String(b.status||"normal"),creditLimitIqd:Math.max(0,Math.round(Number(b.creditLimitIqd)||0)),billingCycle:String(b.billingCycle||"monthly"),contactName:String(b.contactName||""),contactPhone:String(b.contactPhone||""),tags:String(b.tags||""),notes:String(b.notes||""),pricePerPassenger:Math.max(0,Math.round(Number(b.pricePerPassenger)||0))};
  if(a.session!.role==='manager'){
    const current:any=await company360(companyName);const currentPrice=Number(current?.summary?.price_per_passenger||0),currentLimit=Number(current?.summary?.credit_limit_iqd||0);
    if(currentPrice!==payload.pricePerPassenger||currentLimit!==payload.creditLimitIqd){
      const approval=await createApproval({kind:'company_change',entityKey:companyName,title:`تغيير مالي لشركة ${companyName}`,payload,requestedBy:actor,requestedRole:a.session!.role});
      return Response.json({pendingApproval:true,approval,message:'تم إرسال تغيير السعر/الحد الائتماني لموافقة المالك'},{status:202});
    }
  }
  const company=await saveCompany360({...payload,actor});clearCache();return Response.json({company})
}return Response.json({message:"إجراء غير معروف"},{status:400})}catch(error){console.error("Control PATCH",error);return Response.json({message:"تعذر حفظ التغيير"},{status:500})}}
