import { adminTokenFromRequest, verifyAdminSession } from "@/lib/admin-auth";
import { listOrderActivity } from "@/lib/admin-ops-db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:Request){
  if(!verifyAdminSession(adminTokenFromRequest(request))) return Response.json({message:"غير مصرح"},{status:401});
  try{
    const {searchParams}=new URL(request.url);
    const reference=searchParams.get("reference")||undefined;
    return Response.json({activity:await listOrderActivity(reference,150)},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error(error);return Response.json({message:"تعذر تحميل سجل النشاط"},{status:500})}
}
