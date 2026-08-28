import { adminTokenFromRequest, verifyAdminSession } from "@/lib/admin-auth";
import { listAdminBookings, updateAdminBooking } from "@/lib/admin-dashboard-db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const allowedStatus=new Set(["new","received","in_progress","completed","cancelled"]);
const allowedPriority=new Set(["normal","important","urgent"]);
function auth(request:Request){return verifyAdminSession(adminTokenFromRequest(request))}
export async function GET(request:Request){
  if(!auth(request)) return Response.json({message:"غير مصرح"},{status:401});
  try{return Response.json({bookings:await listAdminBookings()},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل الطلبات"},{status:500})}
}
export async function PATCH(request:Request){
  if(!auth(request)) return Response.json({message:"غير مصرح"},{status:401});
  try{
    const body=await request.json() as {id?:number;status?:string;priority?:"normal"|"important"|"urgent";internalNote?:string;archived?:boolean};
    const id=Number(body.id);
    if(!Number.isFinite(id)) return Response.json({message:"معرف الطلب غير صحيح"},{status:400});
    if(body.status!==undefined&&!allowedStatus.has(body.status)) return Response.json({message:"حالة الطلب غير صحيحة"},{status:400});
    if(body.priority!==undefined&&!allowedPriority.has(body.priority)) return Response.json({message:"أولوية الطلب غير صحيحة"},{status:400});
    if(body.internalNote!==undefined&&String(body.internalNote).length>2000) return Response.json({message:"الملاحظة طويلة جداً"},{status:400});
    const booking=await updateAdminBooking({id,status:body.status,priority:body.priority,internalNote:body.internalNote,archived:body.archived});
    if(!booking)return Response.json({message:"الطلب غير موجود"},{status:404});
    return Response.json({booking});
  }catch(error){console.error(error);return Response.json({message:"تعذر تحديث الطلب"},{status:500})}
}
