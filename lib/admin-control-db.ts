import { neon } from "@neondatabase/serverless";
import { ensureOperationsTables } from "./operations-db";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function ensureControlTables(){
  await ensureOperationsTables(); const db=sql();
  await db`CREATE TABLE IF NOT EXISTS company_profiles(
    company_name TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','late','suspended','vip')),
    credit_limit_iqd BIGINT NOT NULL DEFAULT 0,billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('weekly','monthly')),
    contact_name TEXT NOT NULL DEFAULT '',contact_phone TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS company_price_history(
    id BIGSERIAL PRIMARY KEY,company_name TEXT NOT NULL,old_price INTEGER NOT NULL DEFAULT 0,new_price INTEGER NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'admin',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS company_price_history_company_idx ON company_price_history(company_name,created_at DESC)`;
  await db`CREATE TABLE IF NOT EXISTS admin_tasks(
    id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,details TEXT NOT NULL DEFAULT '',entity_type TEXT NOT NULL DEFAULT 'general',entity_key TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','important','urgent')),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
    due_at TIMESTAMPTZ,created_by TEXT NOT NULL DEFAULT 'admin',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS admin_tasks_status_idx ON admin_tasks(status,due_at)`;
  await db`CREATE TABLE IF NOT EXISTS admin_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const defaults=[['sla_minutes','15'],['maintenance_booking','0'],['maintenance_captain','0'],['default_credit_limit','0'],['invoice_prefix','LB']];
  for(const [k,v] of defaults) await db`INSERT INTO admin_settings(key,value) VALUES(${k},${v}) ON CONFLICT(key) DO NOTHING`;
}

export async function getSetting(key:string, fallback=''){await ensureControlTables();const db=sql();const r=await db`SELECT value FROM admin_settings WHERE key=${key} LIMIT 1`;return String(r[0]?.value??fallback)}
export async function setSetting(key:string,value:string){await ensureControlTables();const db=sql();const r=await db`INSERT INTO admin_settings(key,value) VALUES(${key},${value}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW() RETURNING key,value,updated_at`;return r[0]}
export async function maintenanceState(){const [booking,captain]=await Promise.all([getSetting('maintenance_booking','0'),getSetting('maintenance_captain','0')]);return {booking:booking==='1',captain:captain==='1'}}

export async function executiveDashboard(){
  await ensureControlTables(); const db=sql(); const sla=Math.max(1,Number(await getSetting('sla_minutes','15'))||15);
  const [customer,captain,finance,tasks,alerts,settings]=await Promise.all([
    db`SELECT COUNT(*) FILTER(WHERE created_at>=date_trunc('day',NOW()))::int today,
      COUNT(*) FILTER(WHERE created_at>=date_trunc('month',NOW()))::int month,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=date_trunc('month',NOW())),0)::int passengers_month,
      COALESCE(SUM(total_iqd) FILTER(WHERE created_at>=date_trunc('month',NOW()) AND status<>'cancelled'),0)::bigint revenue_month
      FROM lounge_bookings`,
    db`SELECT COUNT(*) FILTER(WHERE created_at>=date_trunc('day',NOW()))::int today,
      COUNT(*) FILTER(WHERE created_at>=date_trunc('month',NOW()))::int month,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=date_trunc('month',NOW()) AND status<>'cancelled'),0)::int passengers_month,
      COUNT(*) FILTER(WHERE status='new' AND archived_at IS NULL)::int new_orders,
      COUNT(*) FILTER(WHERE status='new' AND archived_at IS NULL AND created_at<NOW()-(${sla}*INTERVAL '1 minute'))::int delayed
      FROM captain_lounge_orders`,
    db`WITH c AS(SELECT n.name,COALESCE(a.price_per_passenger,0) price FROM(
      SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>'' UNION SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>'' UNION SELECT company_name FROM company_accounts
    )n LEFT JOIN company_accounts a ON a.company_name=n.name)
    SELECT COALESCE(SUM((SELECT COALESCE(SUM(o.passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=c.name AND o.status<>'cancelled')*c.price),0)::bigint due,
      COALESCE((SELECT SUM(amount_iqd) FROM company_payments),0)::bigint paid FROM c`,
    db`SELECT COUNT(*) FILTER(WHERE status='open')::int open,COUNT(*) FILTER(WHERE status='open' AND due_at<NOW())::int overdue FROM admin_tasks`,
    db`SELECT COUNT(*) FILTER(WHERE active=TRUE)::int watch FROM operations_watchlist`,
    db`SELECT key,value FROM admin_settings`
  ]);
  const outstanding=Number(finance[0]?.due||0)-Number(finance[0]?.paid||0);
  return {slaMinutes:sla,customer:customer[0],captain:captain[0],finance:{due:Number(finance[0]?.due||0),paid:Number(finance[0]?.paid||0),outstanding},tasks:tasks[0],watch:Number(alerts[0]?.watch||0),settings:Object.fromEntries(settings.map((x:any)=>[x.key,x.value]))};
}

export async function morningBrief(){
  await ensureControlTables(); const db=sql(); const sla=Math.max(1,Number(await getSetting('sla_minutes','15'))||15);
  const [orders,finance,promos,tasks,errors]=await Promise.all([
    db`SELECT COUNT(*) FILTER(WHERE status='new')::int new_orders,COUNT(*) FILTER(WHERE status='new' AND created_at<NOW()-(${sla}*INTERVAL '1 minute'))::int delayed FROM(
      SELECT status,created_at FROM lounge_bookings WHERE archived_at IS NULL UNION ALL SELECT status,created_at FROM captain_lounge_orders WHERE archived_at IS NULL)t`,
    db`WITH c AS(SELECT n.name,COALESCE(a.price_per_passenger,0) price FROM(SELECT captain_company name FROM captain_lounge_orders WHERE captain_company IS NOT NULL GROUP BY captain_company)n LEFT JOIN company_accounts a ON a.company_name=n.name)
      SELECT COUNT(*) FILTER(WHERE ((SELECT COALESCE(SUM(o.passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=c.name AND o.status<>'cancelled')*c.price-(SELECT COALESCE(SUM(p.amount_iqd),0) FROM company_payments p WHERE p.company_name=c.name))>0)::int owing FROM c`,
    db`SELECT COUNT(*) FILTER(WHERE active=TRUE AND expires_at IS NOT NULL AND expires_at<NOW()+INTERVAL '7 days')::int expiring FROM company_promo_codes`,
    db`SELECT COUNT(*) FILTER(WHERE status='open' AND (due_at IS NULL OR due_at<=NOW()+INTERVAL '1 day'))::int due FROM admin_tasks`,
    db`SELECT COUNT(*) FILTER(WHERE resolved=FALSE)::int open FROM admin_system_errors`
  ]);
  return {newOrders:Number(orders[0]?.new_orders||0),delayed:Number(orders[0]?.delayed||0),companiesOwing:Number(finance[0]?.owing||0),promosExpiring:Number(promos[0]?.expiring||0),tasksDue:Number(tasks[0]?.due||0),systemErrors:Number(errors[0]?.open||0)};
}

export async function listCompanies360(){
  await ensureControlTables();const db=sql();
  return await db`WITH names AS(
    SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>'' UNION SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>'' UNION SELECT company_name FROM company_accounts UNION SELECT company_name FROM company_promo_codes UNION SELECT company_name FROM company_profiles
  ) SELECT n.name,COALESCE(p.status,'normal') status,COALESCE(p.credit_limit_iqd,0)::bigint credit_limit_iqd,COALESCE(p.billing_cycle,'monthly') billing_cycle,
    COALESCE(a.price_per_passenger,0)::int price_per_passenger,
    (SELECT COUNT(*) FROM captain_accounts c WHERE c.company=n.name)::int captains,
    (SELECT COUNT(*) FROM captain_lounge_orders o WHERE o.captain_company=n.name)::int orders,
    (SELECT COALESCE(SUM(o.passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name AND o.status<>'cancelled')::int passengers,
    ((SELECT COALESCE(SUM(o.passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name AND o.status<>'cancelled')*COALESCE(a.price_per_passenger,0))::bigint due_iqd,
    (SELECT COALESCE(SUM(x.amount_iqd),0) FROM company_payments x WHERE x.company_name=n.name)::bigint paid_iqd,
    (SELECT MAX(o.created_at) FROM captain_lounge_orders o WHERE o.captain_company=n.name) last_activity
    FROM names n LEFT JOIN company_profiles p ON p.company_name=n.name LEFT JOIN company_accounts a ON a.company_name=n.name ORDER BY n.name`;
}

export async function company360(name:string){
  await ensureControlTables();const db=sql();
  const [summary,captains,promos,orders,payments,prices,tasks]=await Promise.all([
    db`SELECT ${name}::text name,COALESCE(p.status,'normal') status,COALESCE(p.credit_limit_iqd,0)::bigint credit_limit_iqd,COALESCE(p.billing_cycle,'monthly') billing_cycle,COALESCE(p.contact_name,'') contact_name,COALESCE(p.contact_phone,'') contact_phone,COALESCE(p.tags,'') tags,COALESCE(p.notes,'') notes,COALESCE(a.price_per_passenger,0)::int price_per_passenger FROM (SELECT 1)x LEFT JOIN company_profiles p ON p.company_name=${name} LEFT JOIN company_accounts a ON a.company_name=${name}`,
    db`SELECT id::int,username,name,phone,active FROM captain_accounts WHERE company=${name} ORDER BY active DESC,name`,
    db`SELECT id::int,code,discount_percent,active,uses_count,max_uses,expires_at FROM company_promo_codes WHERE company_name=${name} ORDER BY created_at DESC`,
    db`SELECT reference,captain_name,lounge_name,passengers,status,created_at FROM captain_lounge_orders WHERE captain_company=${name} ORDER BY created_at DESC LIMIT 100`,
    db`SELECT id::int,amount_iqd,note,created_at FROM company_payments WHERE company_name=${name} ORDER BY created_at DESC LIMIT 100`,
    db`SELECT id::int,old_price,new_price,changed_by,created_at FROM company_price_history WHERE company_name=${name} ORDER BY created_at DESC LIMIT 50`,
    db`SELECT id::int,title,details,priority,status,due_at,created_at FROM admin_tasks WHERE entity_type='company' AND entity_key=${name} ORDER BY status,created_at DESC LIMIT 50`
  ]);
  const price=Number(summary[0]?.price_per_passenger||0);const passengers=orders.filter((o:any)=>o.status!=='cancelled').reduce((s:number,o:any)=>s+Number(o.passengers||0),0);const due=passengers*price;const paid=payments.reduce((s:number,p:any)=>s+Number(p.amount_iqd||0),0);
  return {summary:summary[0],metrics:{orders:orders.length,passengers,due,paid,balance:due-paid},captains,promos,orders,payments,prices,tasks};
}

export async function saveCompany360(input:{companyName:string;status:string;creditLimitIqd:number;billingCycle:string;contactName:string;contactPhone:string;tags:string;notes:string;pricePerPassenger:number;actor:string}){
  await ensureControlTables();const db=sql();const old=await db`SELECT price_per_passenger FROM company_accounts WHERE company_name=${input.companyName} LIMIT 1`;const oldPrice=Number(old[0]?.price_per_passenger||0);
  await db`INSERT INTO company_profiles(company_name,status,credit_limit_iqd,billing_cycle,contact_name,contact_phone,tags,notes) VALUES(${input.companyName},${input.status},${input.creditLimitIqd},${input.billingCycle},${input.contactName},${input.contactPhone},${input.tags},${input.notes}) ON CONFLICT(company_name) DO UPDATE SET status=EXCLUDED.status,credit_limit_iqd=EXCLUDED.credit_limit_iqd,billing_cycle=EXCLUDED.billing_cycle,contact_name=EXCLUDED.contact_name,contact_phone=EXCLUDED.contact_phone,tags=EXCLUDED.tags,notes=EXCLUDED.notes,updated_at=NOW()`;
  await db`INSERT INTO company_accounts(company_name,price_per_passenger,notes) VALUES(${input.companyName},${input.pricePerPassenger},${input.notes}) ON CONFLICT(company_name) DO UPDATE SET price_per_passenger=EXCLUDED.price_per_passenger,notes=EXCLUDED.notes,updated_at=NOW()`;
  if(oldPrice!==input.pricePerPassenger)await db`INSERT INTO company_price_history(company_name,old_price,new_price,changed_by) VALUES(${input.companyName},${oldPrice},${input.pricePerPassenger},${input.actor})`;
  return company360(input.companyName);
}

export async function listCaptains360(){await ensureControlTables();const db=sql();return await db`SELECT c.id::int,c.username,c.name,c.company,c.phone,c.active,(SELECT COUNT(*) FROM captain_lounge_orders o WHERE o.captain_name=c.name AND o.captain_company=c.company)::int orders,(SELECT COALESCE(SUM(passengers),0) FROM captain_lounge_orders o WHERE o.captain_name=c.name AND o.captain_company=c.company)::int passengers,(SELECT MAX(created_at) FROM captain_lounge_orders o WHERE o.captain_name=c.name AND o.captain_company=c.company) last_activity FROM captain_accounts c ORDER BY c.active DESC,c.name`}
export async function captain360(id:number){await ensureControlTables();const db=sql();const c=(await db`SELECT id::int,username,name,company,phone,active,created_at FROM captain_accounts WHERE id=${id} LIMIT 1`)[0];if(!c)return null;const [orders,tasks]=await Promise.all([db`SELECT reference,lounge_name,passengers,bags,carts,passenger_phone,status,created_at FROM captain_lounge_orders WHERE captain_name=${c.name} AND captain_company=${c.company} ORDER BY created_at DESC LIMIT 100`,db`SELECT id::int,title,details,priority,status,due_at,created_at FROM admin_tasks WHERE entity_type='captain' AND entity_key=${String(id)} ORDER BY status,created_at DESC LIMIT 50`]);const passengers=orders.reduce((s:number,o:any)=>s+Number(o.passengers||0),0);const loungeCounts=new Map<string,number>();for(const o of orders){const k=String(o.lounge_name||'');loungeCounts.set(k,(loungeCounts.get(k)||0)+1)}const top=[...loungeCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';return {captain:c,metrics:{orders:orders.length,passengers,topLounge:top,lastActivity:orders[0]?.created_at||null},orders,tasks}}

export async function listTasks(){await ensureControlTables();const db=sql();return await db`SELECT id::int,title,details,entity_type,entity_key,priority,status,due_at,created_by,created_at,updated_at FROM admin_tasks ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,CASE priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,due_at NULLS LAST,created_at DESC LIMIT 250`}
export async function createTask(input:{title:string;details:string;entityType:string;entityKey:string;priority:string;dueAt:string|null;actor:string}){await ensureControlTables();const db=sql();const r=await db`INSERT INTO admin_tasks(title,details,entity_type,entity_key,priority,due_at,created_by) VALUES(${input.title},${input.details},${input.entityType},${input.entityKey},${input.priority},${input.dueAt||null},${input.actor}) RETURNING id::int,title,details,entity_type,entity_key,priority,status,due_at,created_by,created_at`;return r[0]}
export async function updateTask(id:number,status:string){await ensureControlTables();const db=sql();const r=await db`UPDATE admin_tasks SET status=${status},updated_at=NOW() WHERE id=${id} RETURNING id::int,title,status,updated_at`;return r[0]}

export async function globalSearch(q:string){await ensureControlTables();const db=sql();const term=`%${q.trim()}%`;if(q.trim().length<2)return {orders:[],captains:[],companies:[],promos:[]};const [orders,captains,companies,promos]=await Promise.all([
 db`SELECT reference,customer_name title,phone subtitle,'customer' source,created_at FROM lounge_bookings WHERE reference ILIKE ${term} OR customer_name ILIKE ${term} OR phone ILIKE ${term} OR promo_code ILIKE ${term} UNION ALL SELECT reference,captain_name title,COALESCE(captain_company,'')||' · '||COALESCE(passenger_phone,'') subtitle,'captain' source,created_at FROM captain_lounge_orders WHERE reference ILIKE ${term} OR captain_name ILIKE ${term} OR captain_company ILIKE ${term} OR passenger_phone ILIKE ${term} ORDER BY created_at DESC LIMIT 30`,
 db`SELECT id::int,username,name,company,phone,active FROM captain_accounts WHERE username ILIKE ${term} OR name ILIKE ${term} OR company ILIKE ${term} OR phone ILIKE ${term} LIMIT 20`,
 db`SELECT name,status,credit_limit_iqd,price_per_passenger,due_iqd,paid_iqd FROM (WITH names AS(SELECT company name FROM captain_accounts UNION SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL UNION SELECT company_name FROM company_accounts) SELECT n.name,COALESCE(p.status,'normal') status,COALESCE(p.credit_limit_iqd,0) credit_limit_iqd,COALESCE(a.price_per_passenger,0) price_per_passenger,((SELECT COALESCE(SUM(passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name AND o.status<>'cancelled')*COALESCE(a.price_per_passenger,0)) due_iqd,(SELECT COALESCE(SUM(amount_iqd),0) FROM company_payments x WHERE x.company_name=n.name) paid_iqd FROM names n LEFT JOIN company_profiles p ON p.company_name=n.name LEFT JOIN company_accounts a ON a.company_name=n.name)s WHERE name ILIKE ${term} LIMIT 20`,
 db`SELECT id::int,company_name,code,discount_percent,active,uses_count,expires_at FROM company_promo_codes WHERE company_name ILIKE ${term} OR code ILIKE ${term} LIMIT 20`
 ]);return {orders,captains,companies,promos}}
