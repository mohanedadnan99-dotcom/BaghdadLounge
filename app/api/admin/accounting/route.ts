import { neon } from "@neondatabase/serverless";
import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { companyStatement } from "@/lib/admin-enterprise-db";
import { addCompanyPayment, ensureOperationsTables } from "@/lib/operations-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function sql(){const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!value)throw new Error("DATABASE_URL is not configured");return neon(value)}
function deny(request:Request){const s=adminSessionFromRequest(request);if(!s)return {response:Response.json({message:"غير مصرح"},{status:401}),session:null};if(!roleCan(s.role,"finance"))return {response:Response.json({message:"لا تملك صلاحية الحسابات"},{status:403}),session:s};return {response:null,session:s}}

async function companies(){
  await ensureOperationsTables();const db=sql();
  return await db`WITH names AS(
    SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>''
    UNION SELECT captain_company AS name FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>''
    UNION SELECT company_name AS name FROM company_promo_codes WHERE TRIM(company_name)<>''
    UNION SELECT company_name AS name FROM company_accounts
  )
  SELECT n.name,
    COALESCE(a.price_per_passenger,0)::int AS price_per_passenger,
    COALESCE(a.notes,'') AS notes,
    (SELECT COUNT(*) FROM captain_lounge_orders o WHERE o.captain_company=n.name)::int AS orders,
    (SELECT COALESCE(SUM(passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name)::int AS passengers,
    (SELECT COALESCE(SUM(amount_iqd),0) FROM company_payments p WHERE p.company_name=n.name)::bigint AS paid_iqd,
    ((SELECT COALESCE(SUM(passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name)*COALESCE(a.price_per_passenger,0))::bigint AS due_iqd
  FROM names n LEFT JOIN company_accounts a ON a.company_name=n.name ORDER BY n.name`;
}

export async function GET(request:Request){
  const a=deny(request);if(a.response)return a.response;
  try{
    const url=new URL(request.url);const company=String(url.searchParams.get("company")||"").trim();const from=String(url.searchParams.get("from")||"");const to=String(url.searchParams.get("to")||"");
    if(company){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return Response.json({message:"حدد الفترة بشكل صحيح"},{status:400});return Response.json({statement:await companyStatement(company,from,to)},{headers:{"Cache-Control":"no-store"}})}
    return Response.json({session:{name:a.session?.name||"المحاسب",role:a.session?.role},companies:await companies()},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error(error);return Response.json({message:"تعذر تحميل الحسابات"},{status:500})}
}

export async function POST(request:Request){
  const a=deny(request);if(a.response)return a.response;
  try{const body=await request.json() as Record<string,unknown>;const companyName=String(body.companyName||"").trim();const amountIqd=Math.round(Number(body.amountIqd));const note=String(body.note||"").trim();if(companyName.length<2||!Number.isFinite(amountIqd)||amountIqd<=0)return Response.json({message:"بيانات الدفعة غير صحيحة"},{status:400});return Response.json({payment:await addCompanyPayment(companyName,amountIqd,note)},{status:201})}catch(error){console.error(error);return Response.json({message:"تعذر تسجيل الدفعة"},{status:500})}
}
