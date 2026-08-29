import { adminSessionFromRequest } from "@/lib/admin-auth";
import { intelligenceSummary, saveIntelligenceTarget } from "@/lib/admin-intelligence-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function auth(request:Request){const s=adminSessionFromRequest(request);if(!s)return null;if(!['owner','manager'].includes(s.role))return null;return s}

let summaryCache:{at:number;value:any}|null=null;let inflight:Promise<any>|null=null;const TTL=15000;
async function fastSummary(){if(summaryCache&&Date.now()-summaryCache.at<TTL)return summaryCache.value;if(inflight)return inflight;inflight=intelligenceSummary().then(value=>{summaryCache={at:Date.now(),value};return value}).finally(()=>{inflight=null});return inflight}

export async function GET(request:Request){const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});try{return Response.json(await fastSummary(),{headers:{'Cache-Control':'private, max-age=10, stale-while-revalidate=20'}})}catch(e){console.error('intelligence GET',e);return Response.json({message:e instanceof Error?e.message:'تعذر تحميل مركز الذكاء الإداري'},{status:500})}}

export async function POST(request:Request){const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});if(s.role!=='owner')return Response.json({message:'تعديل الأهداف مخصص للمالك'},{status:403});try{const b=await request.json() as Record<string,unknown>;const key=String(b.key||''),value=Number(b.value||0);if(!Number.isFinite(value)||value<0)return Response.json({message:'قيمة الهدف غير صحيحة'},{status:400});const setting=await saveIntelligenceTarget(key,value);summaryCache=null;return Response.json({setting})}catch(e){return Response.json({message:e instanceof Error?e.message:'تعذر حفظ الهدف'},{status:500})}}
