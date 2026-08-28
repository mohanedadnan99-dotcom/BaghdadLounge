import { adminTokenFromRequest, verifyAdminSession } from "@/lib/admin-auth";
import { adminOverview } from "@/lib/admin-dashboard-db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(!verifyAdminSession(adminTokenFromRequest(request))) return Response.json({message:"غير مصرح"},{status:401});
  try{return Response.json(await adminOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل لوحة الإدارة"},{status:500})}
}
