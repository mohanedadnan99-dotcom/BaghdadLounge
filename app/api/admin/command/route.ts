import { neon } from "@neondatabase/serverless";
import { adminSessionFromRequest } from "@/lib/admin-auth";
import { ensureEnterpriseTables } from "@/lib/admin-enterprise-db";
import { ensureOperationsTables } from "@/lib/operations-db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function db(){const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!value)throw new Error("DATABASE_URL is not configured");return neon(value)}
function allowed(request:Request){const s=adminSessionFromRequest(request);if(!s)return {session:null,response:Response.json({message:"غير مصرح"},{status:401})};if(!["owner","manager"].includes(s.role))return {session:s,response:Response.json({message:"هذه المساحة مخصصة للإدارة"},{status:403})};return {session:s,response:null}}
async function ensure(){await ensureOperationsTables();await ensureEnterpriseTables();const sql=db();await sql`CREATE TABLE IF NOT EXISTS admin_notification_reads(user_key TEXT NOT NULL,notification_key TEXT NOT NULL,read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_key,notification_key))`}
function userKey(s:{userId?:number;username?:string}){return s.userId?`user:${s.userId}`:`username:${s.username||"admin"}`}

async function searchAll(q:string){
  const sql=db();const like=`%${q}%`;
  const [customerOrders,captainOrders,captains,promos,companies]=await Promise.all([
    sql`SELECT id::int,reference,customer_name AS title,phone AS subtitle,status,created_at,'customer_order' AS kind FROM lounge_bookings WHERE reference ILIKE ${like} OR customer_name ILIKE ${like} OR phone ILIKE ${like} OR COALESCE(promo_code,'') ILIKE ${like} ORDER BY created_at DESC LIMIT 12`,
    sql`SELECT id::int,reference,captain_name AS title,COALESCE(captain_company,'')||' · '||COALESCE(passenger_phone,'') AS subtitle,status,created_at,'captain_order' AS kind FROM captain_lounge_orders WHERE reference ILIKE ${like} OR captain_name ILIKE ${like} OR COALESCE(captain_company,'') ILIKE ${like} OR COALESCE(captain_phone,'') ILIKE ${like} OR COALESCE(passenger_phone,'') ILIKE ${like} OR COALESCE(lounge_name,'') ILIKE ${like} ORDER BY created_at DESC LIMIT 12`,
    sql`SELECT id::int,username AS reference,name AS title,company||' · '||phone AS subtitle,CASE WHEN active THEN 'active' ELSE 'disabled' END AS status,created_at,'captain' AS kind FROM captain_accounts WHERE username ILIKE ${like} OR name ILIKE ${like} OR company ILIKE ${like} OR phone ILIKE ${like} ORDER BY created_at DESC LIMIT 10`,
    sql`SELECT id::int,code AS reference,company_name AS title,discount_percent::text||'% خصم' AS subtitle,CASE WHEN active THEN 'active' ELSE 'disabled' END AS status,created_at,'promo' AS kind FROM company_promo_codes WHERE code ILIKE ${like} OR company_name ILIKE ${like} ORDER BY created_at DESC LIMIT 10`,
    sql`SELECT 0 AS id,company_name AS reference,company_name AS title,COALESCE(notes,'') AS subtitle,'company' AS status,updated_at AS created_at,'company' AS kind FROM company_accounts WHERE company_name ILIKE ${like} OR COALESCE(notes,'') ILIKE ${like} ORDER BY updated_at DESC LIMIT 10`
  ]);
  return [...customerOrders,...captainOrders,...captains,...promos,...companies].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,35)
}

async function notifications(user:string){
  const sql=db();
  const [delayed,urgent,balances,promos,errors,reads]=await Promise.all([
    sql`SELECT reference,created_at,'customer' AS source FROM lounge_bookings WHERE status='new' AND archived_at IS NULL AND created_at<NOW()-INTERVAL '15 minutes' UNION ALL SELECT reference,created_at,'captain' AS source FROM captain_lounge_orders WHERE status='new' AND archived_at IS NULL AND created_at<NOW()-INTERVAL '15 minutes' ORDER BY created_at ASC LIMIT 12`,
    sql`SELECT reference,created_at,'customer' AS source FROM lounge_bookings WHERE priority='urgent' AND archived_at IS NULL AND status NOT IN ('completed','cancelled') UNION ALL SELECT reference,created_at,'captain' AS source FROM captain_lounge_orders WHERE priority='urgent' AND archived_at IS NULL AND status NOT IN ('completed','cancelled') ORDER BY created_at DESC LIMIT 12`,
    sql`WITH names AS(SELECT company_name AS name FROM company_accounts UNION SELECT captain_company AS name FROM captain_lounge_orders WHERE captain_company IS NOT NULL), x AS(SELECT n.name,COALESCE(a.price_per_passenger,0) price,(SELECT COALESCE(SUM(passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name AND o.status<>'cancelled') passengers,(SELECT COALESCE(SUM(amount_iqd),0) FROM company_payments p WHERE p.company_name=n.name) paid FROM names n LEFT JOIN company_accounts a ON a.company_name=n.name) SELECT name,(passengers*price-paid)::bigint AS balance FROM x WHERE (passengers*price-paid)>0 ORDER BY balance DESC LIMIT 10`,
    sql`SELECT id::int,company_name,code,discount_percent,expires_at,max_uses,uses_count FROM company_promo_codes WHERE active=TRUE AND ((expires_at IS NOT NULL AND expires_at<=NOW()+INTERVAL '7 days') OR (max_uses IS NOT NULL AND max_uses>0 AND uses_count::numeric/max_uses>=0.8)) ORDER BY expires_at NULLS LAST LIMIT 10`,
    sql`SELECT id::int,source,message,created_at FROM admin_system_errors WHERE resolved=FALSE ORDER BY created_at DESC LIMIT 8`,
    sql`SELECT notification_key FROM admin_notification_reads WHERE user_key=${user}`
  ]);
  const read=new Set(reads.map((r:any)=>String(r.notification_key)));const out:any[]=[];
  for(const r of delayed as any[]){const key=`delayed:${r.source}:${r.reference}`;out.push({key,type:"order_delay",severity:"danger",title:`طلب متأخر ${r.reference}`,detail:"الطلب ما زال جديداً لأكثر من 15 دقيقة",href:"/admin",createdAt:r.created_at,read:read.has(key)})}
  for(const r of urgent as any[]){const key=`urgent:${r.source}:${r.reference}`;out.push({key,type:"urgent",severity:"warning",title:`طلب عاجل ${r.reference}`,detail:"يوجد طلب بأولوية عاجلة يحتاج متابعة",href:"/admin",createdAt:r.created_at,read:read.has(key)})}
  for(const r of balances as any[]){const key=`balance:${r.name}:${r.balance}`;out.push({key,type:"balance",severity:"warning",title:`رصيد مستحق — ${r.name}`,detail:`المتبقي ${new Intl.NumberFormat("en-US").format(Number(r.balance))} د.ع`,href:"/admin/accounting",createdAt:new Date().toISOString(),read:read.has(key)})}
  for(const r of promos as any[]){const nearUse=r.max_uses&&Number(r.uses_count)/Number(r.max_uses)>=.8;const key=`promo:${r.id}:${r.uses_count}:${r.expires_at||''}`;out.push({key,type:"promo",severity:"info",title:`تنبيه خصم — ${r.company_name}`,detail:nearUse?`الكود ${r.code} استُخدم ${r.uses_count} من ${r.max_uses}`:`الكود ${r.code} قريب من تاريخ الانتهاء`,href:"/admin",createdAt:r.expires_at||new Date().toISOString(),read:read.has(key)})}
  for(const r of errors as any[]){const key=`error:${r.id}`;out.push({key,type:"system",severity:"danger",title:`خطأ بالنظام — ${r.source}`,detail:String(r.message).slice(0,180),href:"/admin/system",createdAt:r.created_at,read:read.has(key)})}
  return out.sort((a,b)=>Number(a.read)-Number(b.read)||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,40)
}

export async function GET(request:Request){
  const a=allowed(request);if(a.response)return a.response;
  try{await ensure();const url=new URL(request.url);const q=String(url.searchParams.get("q")||"").trim();const user=userKey(a.session!);return Response.json({session:{name:a.session?.name||"الإدارة",role:a.session?.role},results:q.length>=2?await searchAll(q):[],notifications:await notifications(user)},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل مركز القيادة"},{status:500})}
}

export async function PATCH(request:Request){
  const a=allowed(request);if(a.response)return a.response;
  try{await ensure();const body=await request.json() as {key?:string;all?:boolean};const sql=db();const user=userKey(a.session!);if(body.all){const items=await notifications(user);for(const n of items)await sql`INSERT INTO admin_notification_reads(user_key,notification_key) VALUES(${user},${n.key}) ON CONFLICT(user_key,notification_key) DO UPDATE SET read_at=NOW()`;return Response.json({ok:true})}const key=String(body.key||"").trim();if(!key)return Response.json({message:"التنبيه غير محدد"},{status:400});await sql`INSERT INTO admin_notification_reads(user_key,notification_key) VALUES(${user},${key}) ON CONFLICT(user_key,notification_key) DO UPDATE SET read_at=NOW()`;return Response.json({ok:true})}catch(error){console.error(error);return Response.json({message:"تعذر تحديث التنبيه"},{status:500})}
}
