import { randomUUID, createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { ensureControlTables } from "./admin-control-db";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function ensureSecurityTables(){
  await ensureControlTables(); const db=sql();
  await db`CREATE TABLE IF NOT EXISTS admin_sessions(
    id TEXT PRIMARY KEY,user_id BIGINT,username TEXT NOT NULL,name TEXT NOT NULL DEFAULT '',role TEXT NOT NULL,
    device_label TEXT NOT NULL DEFAULT '',user_agent TEXT NOT NULL DEFAULT '',ip_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,revoked_by TEXT NOT NULL DEFAULT ''
  )`;
  await db`CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions(username,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS admin_sessions_active_idx ON admin_sessions(revoked_at,expires_at)`;
  await db`CREATE TABLE IF NOT EXISTS admin_approvals(
    id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL,entity_key TEXT NOT NULL DEFAULT '',title TEXT NOT NULL,payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_by TEXT NOT NULL,requested_role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','executed')),
    decided_by TEXT NOT NULL DEFAULT '',decision_note TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),decided_at TIMESTAMPTZ
  )`;
  await db`CREATE INDEX IF NOT EXISTS admin_approvals_status_idx ON admin_approvals(status,created_at DESC)`;
  await db`CREATE TABLE IF NOT EXISTS staff_shifts(
    id BIGSERIAL PRIMARY KEY,username TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),ended_at TIMESTAMPTZ,handover_note TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS staff_shifts_user_idx ON staff_shifts(username,status,started_at DESC)`;
  await db`CREATE TABLE IF NOT EXISTS daily_closes(
    id BIGSERIAL PRIMARY KEY,close_date DATE NOT NULL UNIQUE,created_by TEXT NOT NULL,customer_orders INTEGER NOT NULL DEFAULT 0,captain_orders INTEGER NOT NULL DEFAULT 0,
    completed_orders INTEGER NOT NULL DEFAULT 0,cancelled_orders INTEGER NOT NULL DEFAULT 0,customer_revenue_iqd BIGINT NOT NULL DEFAULT 0,
    invoice_payments_iqd BIGINT NOT NULL DEFAULT 0,company_payments_iqd BIGINT NOT NULL DEFAULT 0,open_tasks INTEGER NOT NULL DEFAULT 0,
    overdue_invoices INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

const ipHash=(ip:string)=>ip?createHash('sha256').update(ip).digest('hex').slice(0,24):'';
export async function createAdminDbSession(input:{userId?:number;username:string;name:string;role:string;userAgent:string;ip:string;hours?:number}){
  await ensureSecurityTables();const db=sql();const id=randomUUID();const hours=Math.min(24,Math.max(1,input.hours||8));
  const device=(input.userAgent||'').slice(0,180);
  await db`INSERT INTO admin_sessions(id,user_id,username,name,role,device_label,user_agent,ip_hash,expires_at) VALUES(${id},${input.userId||null},${input.username},${input.name},${input.role},${device},${device},${ipHash(input.ip)},NOW()+(${hours}*INTERVAL '1 hour'))`;
  return id;
}
export async function isAdminDbSessionActive(id:string){if(!id)return false;await ensureSecurityTables();const db=sql();const r=await db`UPDATE admin_sessions SET last_seen_at=NOW() WHERE id=${id} AND revoked_at IS NULL AND expires_at>NOW() RETURNING id`;return Boolean(r[0])}
export async function listAdminDbSessions(){await ensureSecurityTables();const db=sql();return db`SELECT id,username,name,role,device_label,created_at,last_seen_at,expires_at,revoked_at,revoked_by FROM admin_sessions ORDER BY created_at DESC LIMIT 200`}
export async function revokeAdminDbSession(id:string,actor:string){await ensureSecurityTables();const db=sql();const r=await db`UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoked_by=${actor} WHERE id=${id} RETURNING id,username,revoked_at`;return r[0]}
export async function revokeUserSessions(username:string,actor:string,exceptId=''){await ensureSecurityTables();const db=sql();return db`UPDATE admin_sessions SET revoked_at=NOW(),revoked_by=${actor} WHERE username=${username} AND revoked_at IS NULL AND (${exceptId}='' OR id<>${exceptId}) RETURNING id`}

export async function createApproval(input:{kind:string;entityKey:string;title:string;payload:Record<string,unknown>;requestedBy:string;requestedRole:string}){await ensureSecurityTables();const db=sql();const r=await db`INSERT INTO admin_approvals(kind,entity_key,title,payload,requested_by,requested_role) VALUES(${input.kind},${input.entityKey},${input.title},${JSON.stringify(input.payload)}::jsonb,${input.requestedBy},${input.requestedRole}) RETURNING id::int,kind,entity_key,title,payload,requested_by,requested_role,status,created_at`;return r[0]}
export async function listApprovals(){await ensureSecurityTables();const db=sql();return db`SELECT id::int,kind,entity_key,title,payload,requested_by,requested_role,status,decided_by,decision_note,created_at,decided_at FROM admin_approvals ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 200`}
export async function decideApproval(id:number,status:'approved'|'rejected',actor:string,note:string){await ensureSecurityTables();const db=sql();const r=await db`UPDATE admin_approvals SET status=${status},decided_by=${actor},decision_note=${note},decided_at=NOW() WHERE id=${id} AND status='pending' RETURNING id::int,kind,entity_key,title,payload,status`;return r[0]}
export async function markApprovalExecuted(id:number){await ensureSecurityTables();const db=sql();await db`UPDATE admin_approvals SET status='executed' WHERE id=${id} AND status='approved'`}

export async function startShift(input:{username:string;name:string;role:string}){await ensureSecurityTables();const db=sql();const open=await db`SELECT id FROM staff_shifts WHERE username=${input.username} AND status='open' LIMIT 1`;if(open[0])throw new Error('عندك شفت مفتوح بالفعل');const r=await db`INSERT INTO staff_shifts(username,name,role) VALUES(${input.username},${input.name},${input.role}) RETURNING id::int,username,name,role,status,started_at`;return r[0]}
export async function endShift(username:string,note:string){await ensureSecurityTables();const db=sql();const r=await db`UPDATE staff_shifts SET status='closed',ended_at=NOW(),handover_note=${note} WHERE id=(SELECT id FROM staff_shifts WHERE username=${username} AND status='open' ORDER BY started_at DESC LIMIT 1) RETURNING id::int,username,name,role,status,started_at,ended_at,handover_note`;if(!r[0])throw new Error('ماكو شفت مفتوح لهذا الموظف');return r[0]}
export async function listShifts(){await ensureSecurityTables();const db=sql();return db`SELECT id::int,username,name,role,status,started_at,ended_at,handover_note FROM staff_shifts ORDER BY started_at DESC LIMIT 150`}

export async function createDailyClose(date:string,actor:string,notes:string){await ensureSecurityTables();const db=sql();const d=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:new Date().toISOString().slice(0,10);const [orders,pays,tasks,invoices]=await Promise.all([
  db`SELECT (SELECT COUNT(*) FROM lounge_bookings WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day')::int customer_orders,(SELECT COUNT(*) FROM captain_lounge_orders WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day')::int captain_orders,(SELECT COUNT(*) FROM (SELECT status,created_at FROM lounge_bookings UNION ALL SELECT status,created_at FROM captain_lounge_orders)x WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day' AND status='completed')::int completed,(SELECT COUNT(*) FROM (SELECT status,created_at FROM lounge_bookings UNION ALL SELECT status,created_at FROM captain_lounge_orders)x WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day' AND status='cancelled')::int cancelled,(SELECT COALESCE(SUM(total_iqd),0) FROM lounge_bookings WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day' AND status<>'cancelled')::bigint revenue`,
  db`SELECT (SELECT COALESCE(SUM(amount_iqd),0) FROM company_invoice_payments WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day')::bigint invoice_payments,(SELECT COALESCE(SUM(amount_iqd),0) FROM company_payments WHERE created_at>=${d}::date AND created_at<${d}::date+INTERVAL '1 day')::bigint company_payments`,
  db`SELECT COUNT(*) FILTER(WHERE status='open')::int open_tasks FROM admin_tasks`,
  db`SELECT COUNT(*) FILTER(WHERE status IN ('unpaid','partial') AND due_date<CURRENT_DATE)::int overdue FROM company_invoices`
]);
 const o=orders[0]||{},p=pays[0]||{},t=tasks[0]||{},i=invoices[0]||{};
 const r=await db`INSERT INTO daily_closes(close_date,created_by,customer_orders,captain_orders,completed_orders,cancelled_orders,customer_revenue_iqd,invoice_payments_iqd,company_payments_iqd,open_tasks,overdue_invoices,notes) VALUES(${d},${actor},${Number(o.customer_orders||0)},${Number(o.captain_orders||0)},${Number(o.completed||0)},${Number(o.cancelled||0)},${Number(o.revenue||0)},${Number(p.invoice_payments||0)},${Number(p.company_payments||0)},${Number(t.open_tasks||0)},${Number(i.overdue||0)},${notes}) ON CONFLICT(close_date) DO UPDATE SET created_by=EXCLUDED.created_by,customer_orders=EXCLUDED.customer_orders,captain_orders=EXCLUDED.captain_orders,completed_orders=EXCLUDED.completed_orders,cancelled_orders=EXCLUDED.cancelled_orders,customer_revenue_iqd=EXCLUDED.customer_revenue_iqd,invoice_payments_iqd=EXCLUDED.invoice_payments_iqd,company_payments_iqd=EXCLUDED.company_payments_iqd,open_tasks=EXCLUDED.open_tasks,overdue_invoices=EXCLUDED.overdue_invoices,notes=EXCLUDED.notes,created_at=NOW() RETURNING *`;return r[0]
}
export async function listDailyCloses(){await ensureSecurityTables();const db=sql();return db`SELECT id::int,close_date,created_by,customer_orders,captain_orders,completed_orders,cancelled_orders,customer_revenue_iqd,invoice_payments_iqd,company_payments_iqd,open_tasks,overdue_invoices,notes,created_at FROM daily_closes ORDER BY close_date DESC LIMIT 90`}

export async function operationalAlerts(){await ensureSecurityTables();const db=sql();const [credit,invoices]=await Promise.all([
 db`WITH n AS(SELECT company_name name,credit_limit_iqd lim FROM company_profiles WHERE credit_limit_iqd>0),b AS(SELECT n.name,n.lim,COALESCE(a.price_per_passenger,0) price,(SELECT COALESCE(SUM(passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=n.name AND o.status<>'cancelled') passengers,(SELECT COALESCE(SUM(amount_iqd),0) FROM company_payments p WHERE p.company_name=n.name) paid FROM n LEFT JOIN company_accounts a ON a.company_name=n.name) SELECT name,lim::bigint,((passengers*price)-paid)::bigint balance,ROUND(GREATEST(0,((passengers*price)-paid))::numeric*100/NULLIF(lim,0),1) percent FROM b WHERE ((passengers*price)-paid)>=lim*0.7 ORDER BY percent DESC`,
 db`SELECT id::int,invoice_number,company_name,due_date,total_iqd,paid_iqd,status,(CURRENT_DATE-due_date)::int days_overdue FROM company_invoices WHERE status IN ('unpaid','partial') AND due_date<=CURRENT_DATE+INTERVAL '3 days' ORDER BY due_date ASC LIMIT 100`
]);return {credit,invoices}}
