import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { listOpsCompanies } from "@/lib/ops-companies";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){const session=opsSessionFromRequest(request);if(!session)return Response.json({message:"غير مصرح"},{status:401});try{const companies=await listOpsCompanies();return Response.json({companies:(companies as any[]).filter(c=>c.active).map(c=>({id:Number(c.id),name:String(c.name),priceIqd:Number(c.price_iqd||40000),billingType:String(c.billing_type||'credit')}))},{headers:{"Cache-Control":"no-store"}})}catch(error){return Response.json({message:error instanceof Error?error.message:"تعذر تحميل الشركات"},{status:500})}}
