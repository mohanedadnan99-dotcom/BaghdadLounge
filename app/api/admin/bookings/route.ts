import { adminTokenFromRequest, verifyAdminSession } from "@/lib/admin-auth";
import { listAdminBookings, updateAdminBooking } from "@/lib/admin-dashboard-db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const allowedStatus=new Set(["new","received","in_progress","completed","cancelled"]);
const allowedPriority=new Set(["normal","important","urgent"]);
function auth(request:Request){return verifyAdminSession(adminTokenFromRequest(request))}

type PatchInput={id?:number;status?:string;priority?:"normal"|"important"|"urgent";internalNote?:string;archived?:boolean};
function validate(input:PatchInput){
  const id=Number(input.id);
  if(!Number.isFinite(id))return "معرف الطلب غير صحيح";
  if(input.status!==undefined&&!allowedStatus.has(input.status))return "حالة الطلب غير صحيحة";
  if(input.priority!==undefined&&!allowedPriority.has(input.priority))return "أولوية الطلب غير صحيحة";
  if(input.internalNote!==undefined&&String(input.internalNote).length>2000)return "الملاحظة طويلة جداً";
  return null;
}
async function apply(input:PatchInput){
  return updateAdminBooking({id:Number(input.id),status:input.status,priority:input.priority,internalNote:input.internalNote,archived:input.archived});
}

export async function GET(request:Request){
  if(!auth(request))return Response.json({message:"غير مصرح"},{status:401});
  try{return Response.json({bookings:await listAdminBookings()},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل الطلبات"},{status:500})}
}

export async function PATCH(request:Request){
  if(!auth(request))return Response.json({message:"غير مصرح"},{status:401});
  try{
    const raw=await request.json() as Record<string,unknown>;
    if(Array.isArray(raw.items)){
      const items=raw.items as PatchInput[];
      if(!items.length||items.length>100)return Response.json({message:"اختر من 1 إلى 100 طلب للعملية الجماعية"},{status:400});
      for(const item of items){const error=validate(item);if(error)return Response.json({message:error},{status:400})}
      const results=await Promise.all(items.map(apply));
      const updated=results.filter(Boolean).length;
      return Response.json({ok:true,updated,requested:items.length});
    }
    const body=raw as PatchInput;
    const error=validate(body);if(error)return Response.json({message:error},{status:400});
    const booking=await apply(body);
    if(!booking)return Response.json({message:"الطلب غير موجود"},{status:404});
    return Response.json({booking});
  }catch(error){console.error(error);return Response.json({message:"تعذر تحديث الطلب"},{status:500})}
}
