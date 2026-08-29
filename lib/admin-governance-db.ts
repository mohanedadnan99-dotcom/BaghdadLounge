import { neon } from "@neondatabase/serverless";
import { ensureBusinessTables, createInvoice } from "./business-suite-db";
import { ensureSecurityTables } from "./admin-security-db";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function ensureGovernanceTables(){
  await ensureBusinessTables(); await ensureSecurityTables(); const db=sql();
  await db`CREATE TABLE IF NOT EXISTS admin_audit_log(
    id BIGSERIAL PRIMARY KEY,table_name TEXT NOT NULL,action TEXT NOT NULL,record_key TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT 'system/database',old_data JSONB,new_data JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS admin_audit_log_table_idx ON admin_audit_log(table_name,created_at DESC)`;
  await db`CREATE TABLE IF NOT EXISTS admin_backups(
    id BIGSERIAL PRIMARY KEY,label TEXT NOT NULL,scope TEXT NOT NULL DEFAULT 'critical',snapshot JSONB NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),restored_at TIMESTAMPTZ,restored_by TEXT NOT NULL DEFAULT ''
  )`;
  await db`CREATE TABLE IF NOT EXISTS monthly_invoice_runs(
    id BIGSERIAL PRIMARY KEY,period_from DATE NOT NULL,period_to DATE NOT NULL,run_key TEXT UNIQUE NOT NULL,
    companies_checked INTEGER NOT NULL DEFAULT 0,invoices_created INTEGER NOT NULL DEFAULT 0,errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT NOT NULL DEFAULT 'system',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE OR REPLACE FUNCTION admin_capture_audit() RETURNS trigger AS $$
  DECLARE oldj jsonb; newj jsonb; keyv text;
  BEGIN
    IF TG_OP='DELETE' THEN oldj=to_jsonb(OLD); newj=NULL; ELSE oldj=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END; newj=to_jsonb(NEW); END IF;
    oldj=CASE WHEN oldj IS NULL THEN NULL ELSE oldj-'password_hash' END;
    newj=CASE WHEN newj IS NULL THEN NULL ELSE newj-'password_hash' END;
    keyv=COALESCE(newj->>'reference',newj->>'invoice_number',newj->>'company_name',newj->>'username',newj->>'code',newj->>'id',oldj->>'reference',oldj->>'invoice_number',oldj->>'company_name',oldj->>'username',oldj->>'code',oldj->>'id','');
    INSERT INTO admin_audit_log(table_name,action,record_key,old_data,new_data) VALUES(TG_TABLE_NAME,TG_OP,keyv,oldj,newj);
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END; $$ LANGUAGE plpgsql`;
  const tables=['lounge_bookings','captain_lounge_orders','captain_accounts','company_promo_codes','company_accounts','company_profiles','company_payments','company_invoices','company_invoice_payments','lounge_settings','admin_tasks','admin_settings','admin_approvals','staff_shifts','daily_closes','business_cost_settings'];
  for(const t of tables){
    await db.query(`DROP TRIGGER IF EXISTS trg_admin_audit ON ${t}`);
    await db.query(`CREATE TRIGGER trg_admin_audit AFTER INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION admin_capture_audit()`);
  }
}

export async function writeAudit(input:{table:string;action:string;key?:string;actor:string;oldData?:unknown;newData?:unknown}){
  await ensureGovernanceTables();const db=sql();
  return (await db`INSERT INTO admin_audit_log(table_name,action,record_key,actor,old_data,new_data) VALUES(${input.table},${input.action},${input.key||''},${input.actor},${input.oldData?JSON.stringify(input.oldData):null}::jsonb,${input.newData?JSON.stringify(input.newData):null}::jsonb) RETURNING id::int,created_at`)[0];
}
export async function listAudit(q='',limit=200){await ensureGovernanceTables();const db=sql();const like=`%${q.trim()}%`;return db`SELECT id::int,table_name,action,record_key,actor,old_data,new_data,created_at FROM admin_audit_log WHERE (${q.trim()}='' OR table_name ILIKE ${like} OR record_key ILIKE ${like} OR actor ILIKE ${like}) ORDER BY created_at DESC LIMIT ${Math.min(500,Math.max(20,limit))}`}

async function criticalSnapshot(){
  const db=sql();
  const [profiles,accounts,promos,captains,lounges,messages,watchlist,tasks,settings,costs]=await Promise.all([
    db`SELECT * FROM company_profiles ORDER BY company_name`,db`SELECT * FROM company_accounts ORDER BY company_name`,db`SELECT * FROM company_promo_codes ORDER BY id`,db`SELECT * FROM captain_accounts ORDER BY id`,db`SELECT * FROM lounge_settings ORDER BY sort_order,id`,db`SELECT * FROM system_messages ORDER BY id`,db`SELECT * FROM operations_watchlist ORDER BY id`,db`SELECT * FROM admin_tasks ORDER BY id`,db`SELECT * FROM admin_settings ORDER BY key`,db`SELECT * FROM business_cost_settings ORDER BY key`
  ]);
  return {company_profiles:profiles,company_accounts:accounts,company_promo_codes:promos,captain_accounts:captains,lounge_settings:lounges,system_messages:messages,operations_watchlist:watchlist,admin_tasks:tasks,admin_settings:settings,business_cost_settings:costs};
}
export async function createBackup(label:string,actor:string){await ensureGovernanceTables();const db=sql();const snap=await criticalSnapshot();const count=Object.values(snap).reduce((n,a:any)=>n+a.length,0);return (await db`INSERT INTO admin_backups(label,scope,snapshot,row_count,created_by) VALUES(${label||'نسخة احتياطية يدوية'},'critical',${JSON.stringify(snap)}::jsonb,${count},${actor}) RETURNING id::int,label,scope,row_count,created_by,created_at`)[0]}
export async function listBackups(){await ensureGovernanceTables();const db=sql();return db`SELECT id::int,label,scope,row_count,created_by,created_at,restored_at,restored_by FROM admin_backups ORDER BY created_at DESC LIMIT 50`}
export async function restoreBackup(id:number,actor:string,confirmation:string){
  if(confirmation!=='RESTORE')throw new Error('تأكيد الاسترجاع غير صحيح');await ensureGovernanceTables();const db=sql();const row=(await db`SELECT snapshot FROM admin_backups WHERE id=${id} LIMIT 1`)[0];if(!row)throw new Error('النسخة الاحتياطية غير موجودة');const s=row.snapshot as Record<string,unknown[]>;
  // Restore only master/configuration tables. Transactional orders, invoices and payments are never overwritten by this action.
  await db`DELETE FROM company_profiles`; if(s.company_profiles?.length)await db`INSERT INTO company_profiles SELECT * FROM jsonb_populate_recordset(NULL::company_profiles,${JSON.stringify(s.company_profiles)}::jsonb)`;
  await db`DELETE FROM company_accounts`; if(s.company_accounts?.length)await db`INSERT INTO company_accounts SELECT * FROM jsonb_populate_recordset(NULL::company_accounts,${JSON.stringify(s.company_accounts)}::jsonb)`;
  await db`DELETE FROM company_promo_codes`; if(s.company_promo_codes?.length)await db`INSERT INTO company_promo_codes SELECT * FROM jsonb_populate_recordset(NULL::company_promo_codes,${JSON.stringify(s.company_promo_codes)}::jsonb)`;
  await db`DELETE FROM captain_accounts`; if(s.captain_accounts?.length)await db`INSERT INTO captain_accounts SELECT * FROM jsonb_populate_recordset(NULL::captain_accounts,${JSON.stringify(s.captain_accounts)}::jsonb)`;
  await db`DELETE FROM lounge_settings`; if(s.lounge_settings?.length)await db`INSERT INTO lounge_settings SELECT * FROM jsonb_populate_recordset(NULL::lounge_settings,${JSON.stringify(s.lounge_settings)}::jsonb)`;
  await db`DELETE FROM system_messages`; if(s.system_messages?.length)await db`INSERT INTO system_messages SELECT * FROM jsonb_populate_recordset(NULL::system_messages,${JSON.stringify(s.system_messages)}::jsonb)`;
  await db`DELETE FROM operations_watchlist`; if(s.operations_watchlist?.length)await db`INSERT INTO operations_watchlist SELECT * FROM jsonb_populate_recordset(NULL::operations_watchlist,${JSON.stringify(s.operations_watchlist)}::jsonb)`;
  await db`DELETE FROM admin_tasks`; if(s.admin_tasks?.length)await db`INSERT INTO admin_tasks SELECT * FROM jsonb_populate_recordset(NULL::admin_tasks,${JSON.stringify(s.admin_tasks)}::jsonb)`;
  await db`DELETE FROM admin_settings`; if(s.admin_settings?.length)await db`INSERT INTO admin_settings SELECT * FROM jsonb_populate_recordset(NULL::admin_settings,${JSON.stringify(s.admin_settings)}::jsonb)`;
  await db`DELETE FROM business_cost_settings`; if(s.business_cost_settings?.length)await db`INSERT INTO business_cost_settings SELECT * FROM jsonb_populate_recordset(NULL::business_cost_settings,${JSON.stringify(s.business_cost_settings)}::jsonb)`;
  await db`UPDATE admin_backups SET restored_at=NOW(),restored_by=${actor} WHERE id=${id}`;await writeAudit({table:'admin_backups',action:'RESTORE',key:String(id),actor,newData:{scope:'critical'}});return {restored:true,id};
}

export async function dataQuality(){
  await ensureGovernanceTables();const db=sql();
  const [dupCompanies,captains,companies,promos,orders,invoices,orphans]=await Promise.all([
    db`WITH n AS(SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>'' UNION ALL SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>'' UNION ALL SELECT company_name FROM company_accounts UNION ALL SELECT company_name FROM company_profiles) SELECT LOWER(TRIM(name)) normalized,ARRAY_AGG(DISTINCT name) names,COUNT(DISTINCT name)::int variants FROM n GROUP BY LOWER(TRIM(name)) HAVING COUNT(DISTINCT name)>1 ORDER BY variants DESC LIMIT 100`,
    db`SELECT id::int,username,name,company,phone FROM captain_accounts WHERE TRIM(COALESCE(company,''))='' OR TRIM(COALESCE(phone,''))='' OR phone !~ '^(\\+?964|0)?7[0-9]{9}$' ORDER BY id LIMIT 100`,
    db`SELECT n.name,COALESCE(a.price_per_passenger,0)::int price FROM(SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>'' UNION SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>'' UNION SELECT company_name FROM company_profiles)n LEFT JOIN company_accounts a ON a.company_name=n.name WHERE COALESCE(a.price_per_passenger,0)<=0 ORDER BY n.name LIMIT 100`,
    db`SELECT id::int,company_name,code,discount_percent,expires_at,max_uses,uses_count FROM company_promo_codes WHERE active=TRUE AND ((expires_at IS NOT NULL AND expires_at<NOW()) OR (max_uses IS NOT NULL AND uses_count>=max_uses)) ORDER BY id DESC LIMIT 100`,
    db`SELECT reference,customer_name,phone,passengers,total_iqd,created_at FROM lounge_bookings WHERE passengers<=0 OR total_iqd<0 OR TRIM(COALESCE(phone,''))='' ORDER BY created_at DESC LIMIT 100`,
    db`SELECT id::int,invoice_number,company_name,due_date,subtotal_iqd::bigint,status FROM company_invoices WHERE status IN ('unpaid','partial') AND due_date<CURRENT_DATE ORDER BY due_date LIMIT 100`,
    db`SELECT p.id::int,p.company_name,p.amount_iqd,p.created_at FROM company_payments p WHERE NOT EXISTS(SELECT 1 FROM company_accounts a WHERE a.company_name=p.company_name) AND NOT EXISTS(SELECT 1 FROM company_profiles x WHERE x.company_name=p.company_name) ORDER BY p.created_at DESC LIMIT 100`
  ]);
  const counts={duplicateCompanies:dupCompanies.length,captainIssues:captains.length,zeroPriceCompanies:companies.length,stalePromos:promos.length,bookingIssues:orders.length,overdueInvoices:invoices.length,orphanPayments:orphans.length};
  return {counts,total:Object.values(counts).reduce((a,b)=>a+b,0),duplicateCompanies:dupCompanies,captainIssues:captains,zeroPriceCompanies:companies,stalePromos:promos,bookingIssues:orders,overdueInvoices:invoices,orphanPayments:orphans};
}

function baghdadDateParts(d=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const g=(t:string)=>parts.find(x=>x.type===t)?.value||'';return {year:Number(g('year')),month:Number(g('month')),day:Number(g('day'))}}
function isoDate(y:number,m:number,d:number){return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
export async function runMonthlyInvoices(actor='system/cron',force=false){
  await ensureGovernanceTables();const now=baghdadDateParts();if(!force&&now.day!==1)return {skipped:true,reason:'not_first_day'};
  let y=now.year,m=now.month-1;if(m===0){m=12;y--}const from=isoDate(y,m,1);const to=isoDate(y,m+1,0);const runKey=`${from}:${to}`;const db=sql();const old=await db`SELECT id,invoices_created FROM monthly_invoice_runs WHERE run_key=${runKey} LIMIT 1`;if(old[0])return {skipped:true,reason:'already_ran',runKey,invoicesCreated:Number(old[0].invoices_created||0)};
  const companies=await db`SELECT p.company_name,COALESCE(a.price_per_passenger,0)::int price FROM company_profiles p LEFT JOIN company_accounts a ON a.company_name=p.company_name WHERE p.billing_cycle='monthly' AND p.status<>'suspended' AND COALESCE(a.price_per_passenger,0)>0 ORDER BY p.company_name`;
  let created=0;const errors:any[]=[];for(const c of companies){try{await createInvoice({companyName:String(c.company_name),from,to,dueDate:isoDate(now.year,now.month,15),notes:`فاتورة شهرية تلقائية عن ${from} إلى ${to}`,actor});created++}catch(e){const msg=e instanceof Error?e.message:String(e);if(!msg.includes('لا توجد طلبات غير مفوترة'))errors.push({company:String(c.company_name),message:msg})}}
  await db`INSERT INTO monthly_invoice_runs(period_from,period_to,run_key,companies_checked,invoices_created,errors,created_by) VALUES(${from},${to},${runKey},${companies.length},${created},${JSON.stringify(errors)}::jsonb,${actor})`;
  await writeAudit({table:'monthly_invoice_runs',action:'AUTO_INVOICE',key:runKey,actor,newData:{companies:companies.length,created,errors:errors.length}});return {skipped:false,runKey,companiesChecked:companies.length,invoicesCreated:created,errors};
}
export async function listMonthlyRuns(){await ensureGovernanceTables();const db=sql();return db`SELECT id::int,period_from,period_to,run_key,companies_checked,invoices_created,errors,created_by,created_at FROM monthly_invoice_runs ORDER BY created_at DESC LIMIT 24`}

export async function governanceSummary(){const [quality,backups,audit,runs]=await Promise.all([dataQuality(),listBackups(),listAudit('',80),listMonthlyRuns()]);return {quality,backups,audit,runs}}
