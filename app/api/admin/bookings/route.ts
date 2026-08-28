import { adminTokenFromRequest, verifyAdminSession } from "@/lib/admin-auth";
import { listAdminBookings, setBookingStatus } from "@/lib/admin-dashboard-db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const allowed=new Set(["new","received","in_progress","completed","cancelled"]);
function auth(request:Request){return verifyAdminSession(adminTokenFromRequest(request))}
export async function GET(request:Request){
  if(!auth(request)) return Response.json({message:"غير مصرح"},{status:401});
  try{return Response.json({bookings:await listAdminBookings()},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل الطلبات"},{status:500})}
}
export async function PATCH(request:Request){
  if(!auth(request)) return Response.json({message:"غير مصرح"},{status:401});
  try{const body=await request.json() as {id?:number;status?:string};const id=Number(body.id);const status=String(body.status||"");
    if(!Number.isFinite(id)||!allowed.has(status)) return Response.json({message:"بيانات الحالة غير صحيحة"},{status:400});
    const booking=await setBookingStatus(id,status); if(!booking)return Response.json({message:"الطلب غير موجود"},{status:404});
    return Response.json({booking});
  }catch(error){console.error(error);return Response.json({message:"تعذر تحديث حالة الطلب"},{status:500})}
}
