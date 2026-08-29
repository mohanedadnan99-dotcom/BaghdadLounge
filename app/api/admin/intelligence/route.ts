import { adminSessionFromRequest } from "@/lib/admin-auth";
import { intelligenceSummary, saveIntelligenceTarget } from "@/lib/admin-intelligence-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function auth(request:Request){const s=adminSessionFromRequest(request);if(!s)return null;if(!['owner','manager'].includes(s.role))return null;return s}

export async function GET(request:Request){const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});try{return Response.json(await intelligenceSummary(),{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('intelligence GET',e);return Response.json({message:e instanceof Error?e.message:'تعذر تحميل مركز الذكاء الإداري'},{status:500})}}

export async function POST(request:Request){const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});if(s.role!=='owner')return Response.json({message:'تعديل الأهداف مخصص للمالك'},{status:403});try{const b=await request.json() as Record<string,unknown>;const key=String(b.key||''),value=Number(b.value||0);if(!Number.isFinite(value)||value<0)return Response.json({message:'قيمة الهدف غير صحيحة'},{status:400});return Response.json({setting:await saveIntelligenceTarget(key,value)})}catch(e){return Response.json({message:e instanceof Error?e.message:'تعذر حفظ الهدف'},{status:500})}}
