import { runMonthlyInvoices } from "@/lib/admin-governance-db";

export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
  const schedule=request.headers.get('x-vercel-cron-schedule')||'';
  const ua=request.headers.get('user-agent')||'';
  if(schedule!=='10 2 * * *'||!ua.includes('vercel-cron'))return Response.json({ok:false},{status:401});
  try{const result=await runMonthlyInvoices('system/vercel-cron',false);return Response.json({ok:true,result},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('monthly invoice cron',e);return Response.json({ok:false,message:e instanceof Error?e.message:'cron failed'},{status:500})}
}
