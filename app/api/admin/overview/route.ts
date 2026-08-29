import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { adminOverview } from "@/lib/admin-dashboard-db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:Request){
  const session=adminSessionFromRequest(request);
  if(!session)return Response.json({message:"غير مصرح"},{status:401});
  if(!roleCan(session.role,"orders"))return Response.json({message:"لا تملك صلاحية لوحة التشغيل"},{status:403});
  try{return Response.json(await adminOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل لوحة الإدارة"},{status:500})}
}
