import { neon } from "@neondatabase/serverless";
import { ensureControlTables } from "./admin-control-db";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function ensureBusinessTables(){
  await ensureControlTables();const db=sql();
  await db`CREATE TABLE IF NOT EXISTS company_invoices(
    id BIGSERIAL PRIMARY KEY,invoice_number TEXT UNIQUE NOT NULL,company_name TEXT NOT NULL,
    period_from DATE NOT NULL,period_to DATE NOT NULL,issue_date DATE NOT NULL DEFAULT CURRENT_DATE,due_date DATE NOT NULL,
    subtotal_iqd BIGINT NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','void')),
    notes TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL DEFAULT 'admin',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS company_invoices_company_idx ON company_invoices(company_name,issue_date DESC)`;
  await db`CREATE TABLE IF NOT EXISTS company_invoice_items(
    id BIGSERIAL PRIMARY KEY,invoice_id BIGINT NOT NULL REFERENCES company_invoices(id) ON DELETE CASCADE,
    order_reference TEXT NOT NULL,service_date TIMESTAMPTZ NOT NULL,captain_name TEXT NOT NULL DEFAULT '',lounge_name TEXT NOT NULL DEFAULT '',
    passengers INTEGER NOT NULL DEFAULT 0,unit_price_iqd INTEGER NOT NULL DEFAULT 0,line_total_iqd BIGINT NOT NULL DEFAULT 0,
    UNIQUE(invoice_id,order_reference)
  )`;
  await db`CREATE TABLE IF NOT EXISTS company_invoice_payments(
    id BIGSERIAL PRIMARY KEY,invoice_id BIGINT NOT NULL REFERENCES company_invoices(id) ON DELETE CASCADE,
    amount_iqd BIGINT NOT NULL CHECK(amount_iqd>0),note TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL DEFAULT 'admin',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS company_invoice_payments_invoice_idx ON company_invoice_payments(invoice_id,created_at DESC)`;
  await db`CREATE TABLE IF NOT EXISTS business_cost_settings(key TEXT PRIMARY KEY,value_iqd INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  for(const [k,v] of [['lounge_cost_per_passenger',0],['car_cost',0],['baggage_cost',0]] as const){await db`INSERT INTO business_cost_settings(key,value_iqd) VALUES(${k},${v}) ON CONFLICT(key) DO NOTHING`}
}

export async function companyCreditDecision(companyName:string){
  await ensureBusinessTables();const db=sql();
  const rows=await db`SELECT COALESCE(p.status,'normal') status,COALESCE(p.credit_limit_iqd,0)::bigint credit_limit_iqd,COALESCE(a.price_per_passenger,0)::int price,
    ((SELECT COALESCE(SUM(o.passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=${companyName} AND o.status<>'cancelled')*COALESCE(a.price_per_passenger,0))::bigint due,
    (SELECT COALESCE(SUM(x.amount_iqd),0) FROM company_payments x WHERE x.company_name=${companyName})::bigint paid
    FROM (SELECT 1)x LEFT JOIN company_profiles p ON p.company_name=${companyName} LEFT JOIN company_accounts a ON a.company_name=${companyName}`;
  const r=rows[0]||{};const limit=Number(r.credit_limit_iqd||0);const balance=Math.max(0,Number(r.due||0)-Number(r.paid||0));const status=String(r.status||'normal');
  if(status==='suspended')return {allowed:false,reason:'حساب الشركة موقوف حالياً. يرجى التواصل مع الإدارة.',status,limit,balance};
  if(limit>0&&balance>=limit)return {allowed:false,reason:'تم الوصول إلى الحد الائتماني للشركة. يرجى التواصل مع الإدارة.',status,limit,balance};
  return {allowed:true,status,limit,balance};
}

async function invoiceStatus(id:number){const db=sql();const rows=await db`SELECT i.subtotal_iqd::bigint subtotal,COALESCE((SELECT SUM(p.amount_iqd) FROM company_invoice_payments p WHERE p.invoice_id=i.id),0)::bigint paid FROM company_invoices i WHERE i.id=${id}`;if(!rows[0])return;const subtotal=Number(rows[0].subtotal||0),paid=Number(rows[0].paid||0);const status=paid<=0?'unpaid':paid>=subtotal?'paid':'partial';await db`UPDATE company_invoices SET status=${status},updated_at=NOW() WHERE id=${id} AND status<>'void'`}

export async function createInvoice(input:{companyName:string;from:string;to:string;dueDate:string;notes:string;actor:string}){
  await ensureBusinessTables();const db=sql();
  if(input.from>input.to)throw new Error('فترة الفاتورة غير صحيحة');
  const account=await db`SELECT COALESCE(price_per_passenger,0)::int price FROM company_accounts WHERE company_name=${input.companyName} LIMIT 1`;const price=Number(account[0]?.price||0);if(price<=0)throw new Error('حدد سعر الشخص للشركة قبل إنشاء الفاتورة');
  const orders=await db`SELECT reference,captain_name,lounge_name,passengers,created_at FROM captain_lounge_orders o WHERE o.captain_company=${input.companyName} AND o.status<>'cancelled' AND o.created_at>=${input.from}::date AND o.created_at<(${input.to}::date+INTERVAL '1 day') AND NOT EXISTS(SELECT 1 FROM company_invoice_items x JOIN company_invoices i ON i.id=x.invoice_id WHERE x.order_reference=o.reference AND i.status<>'void') ORDER BY o.created_at`;
  if(!orders.length)throw new Error('لا توجد طلبات غير مفوترة ضمن هذه الفترة');
  const subtotal=orders.reduce((s:any,o:any)=>s+Number(o.passengers||0)*price,0);
  const seq=await db`SELECT nextval(pg_get_serial_sequence('company_invoices','id'))::bigint AS n`;const id=Number(seq[0].n);const y=new Date().getFullYear();const number=`LB-INV-${y}-${String(id).padStart(5,'0')}`;
  await db`INSERT INTO company_invoices(id,invoice_number,company_name,period_from,period_to,due_date,subtotal_iqd,notes,created_by) VALUES(${id},${number},${input.companyName},${input.from},${input.to},${input.dueDate},${subtotal},${input.notes},${input.actor})`;
  for(const o of orders){const passengers=Number(o.passengers||0);await db`INSERT INTO company_invoice_items(invoice_id,order_reference,service_date,captain_name,lounge_name,passengers,unit_price_iqd,line_total_iqd) VALUES(${id},${o.reference},${o.created_at},${o.captain_name||''},${o.lounge_name||''},${passengers},${price},${passengers*price})`}
  return getInvoice(id);
}

export async function getInvoice(id:number){await ensureBusinessTables();const db=sql();const invoice=(await db`SELECT id::int,invoice_number,company_name,period_from,period_to,issue_date,due_date,subtotal_iqd::bigint,status,notes,created_by,created_at FROM company_invoices WHERE id=${id} LIMIT 1`)[0];if(!invoice)return null;const [items,payments]=await Promise.all([db`SELECT id::int,order_reference,service_date,captain_name,lounge_name,passengers,unit_price_iqd,line_total_iqd::bigint FROM company_invoice_items WHERE invoice_id=${id} ORDER BY service_date`,db`SELECT id::int,amount_iqd::bigint,note,created_by,created_at FROM company_invoice_payments WHERE invoice_id=${id} ORDER BY created_at`]);const paid=payments.reduce((s:any,p:any)=>s+Number(p.amount_iqd||0),0);return {invoice,items,payments,paidIqd:paid,balanceIqd:Math.max(0,Number(invoice.subtotal_iqd||0)-paid)}}
export async function listInvoices(){await ensureBusinessTables();const db=sql();return db`SELECT i.id::int,i.invoice_number,i.company_name,i.period_from,i.period_to,i.issue_date,i.due_date,i.subtotal_iqd::bigint,i.status,COALESCE((SELECT SUM(p.amount_iqd) FROM company_invoice_payments p WHERE p.invoice_id=i.id),0)::bigint paid_iqd,(i.subtotal_iqd-COALESCE((SELECT SUM(p.amount_iqd) FROM company_invoice_payments p WHERE p.invoice_id=i.id),0))::bigint balance_iqd FROM company_invoices i ORDER BY i.created_at DESC LIMIT 250`}
export async function addInvoicePayment(input:{invoiceId:number;amountIqd:number;note:string;actor:string}){await ensureBusinessTables();const db=sql();const inv=await getInvoice(input.invoiceId);if(!inv||inv.invoice.status==='void')throw new Error('الفاتورة غير متاحة');if(input.amountIqd<=0||input.amountIqd>inv.balanceIqd)throw new Error('مبلغ الدفعة أكبر من الرصيد أو غير صحيح');const p=(await db`INSERT INTO company_invoice_payments(invoice_id,amount_iqd,note,created_by) VALUES(${input.invoiceId},${input.amountIqd},${input.note},${input.actor}) RETURNING id::int,amount_iqd,note,created_at`)[0];await db`INSERT INTO company_payments(company_name,amount_iqd,note) VALUES(${inv.invoice.company_name},${input.amountIqd},${`فاتورة ${inv.invoice.invoice_number}${input.note?` — ${input.note}`:''}`})`;await invoiceStatus(input.invoiceId);return p}
export async function voidInvoice(id:number){await ensureBusinessTables();const db=sql();const p=await db`SELECT COUNT(*)::int n FROM company_invoice_payments WHERE invoice_id=${id}`;if(Number(p[0]?.n||0)>0)throw new Error('لا يمكن إلغاء فاتورة عليها دفعات');await db`UPDATE company_invoices SET status='void',updated_at=NOW() WHERE id=${id}`;return getInvoice(id)}

export async function customers360(q=''){await ensureBusinessTables();const db=sql();const like=`%${q.trim()}%`;return db`SELECT phone,MAX(customer_name) customer_name,COUNT(*)::int bookings,COALESCE(SUM(total_iqd) FILTER(WHERE status<>'cancelled'),0)::bigint spend,MAX(created_at) last_booking,COUNT(*) FILTER(WHERE status='cancelled')::int cancelled FROM lounge_bookings WHERE (${q.trim()}='' OR phone ILIKE ${like} OR customer_name ILIKE ${like}) GROUP BY phone ORDER BY last_booking DESC LIMIT 200`}
export async function customer360(phone:string){await ensureBusinessTables();const db=sql();const orders=await db`SELECT reference,customer_name,phone,airline,flight_number,trip_type,transport,passengers,bags,payment_method,payment_status,total_iqd,promo_code,promo_company,promo_percent,status,created_at FROM lounge_bookings WHERE phone=${phone} ORDER BY created_at DESC LIMIT 100`;if(!orders.length)return null;const spend=orders.filter((o:any)=>o.status!=='cancelled').reduce((s:number,o:any)=>s+Number(o.total_iqd||0),0);return {phone,name:orders[0].customer_name,metrics:{bookings:orders.length,spend,average:Math.round(spend/Math.max(1,orders.filter((o:any)=>o.status!=='cancelled').length)),lastBooking:orders[0].created_at,cancelled:orders.filter((o:any)=>o.status==='cancelled').length},orders}}

export async function profitability(){await ensureBusinessTables();const db=sql();const settings=await db`SELECT key,value_iqd FROM business_cost_settings`;const s=Object.fromEntries(settings.map((x:any)=>[x.key,Number(x.value_iqd||0)]));const [customer,company]=await Promise.all([db`SELECT COALESCE(SUM(total_iqd) FILTER(WHERE status<>'cancelled' AND created_at>=date_trunc('month',NOW())),0)::bigint revenue,COALESCE(SUM(passengers) FILTER(WHERE status<>'cancelled' AND created_at>=date_trunc('month',NOW())),0)::int passengers,COUNT(*) FILTER(WHERE transport='chauffeur' AND status<>'cancelled' AND created_at>=date_trunc('month',NOW()))::int cars,COUNT(*) FILTER(WHERE bags>4 AND status<>'cancelled' AND created_at>=date_trunc('month',NOW()))::int baggage FROM lounge_bookings`,db`SELECT COALESCE(SUM(o.passengers*a.price_per_passenger) FILTER(WHERE o.status<>'cancelled' AND o.created_at>=date_trunc('month',NOW())),0)::bigint revenue,COALESCE(SUM(o.passengers) FILTER(WHERE o.status<>'cancelled' AND o.created_at>=date_trunc('month',NOW())),0)::int passengers FROM captain_lounge_orders o LEFT JOIN company_accounts a ON a.company_name=o.captain_company`]);const revenue=Number(customer[0]?.revenue||0)+Number(company[0]?.revenue||0);const loungePassengers=Number(customer[0]?.passengers||0)+Number(company[0]?.passengers||0);const cost=loungePassengers*(s.lounge_cost_per_passenger||0)+Number(customer[0]?.cars||0)*(s.car_cost||0)+Number(customer[0]?.baggage||0)*(s.baggage_cost||0);return {settings:s,revenueIqd:revenue,costIqd:cost,profitIqd:revenue-cost,marginPercent:revenue>0?Math.round(((revenue-cost)/revenue)*1000)/10:0,passengers:loungePassengers,cars:Number(customer[0]?.cars||0)}}
export async function saveCost(key:string,value:number){await ensureBusinessTables();const allowed=['lounge_cost_per_passenger','car_cost','baggage_cost'];if(!allowed.includes(key))throw new Error('إعداد تكلفة غير صالح');const db=sql();return (await db`INSERT INTO business_cost_settings(key,value_iqd) VALUES(${key},${value}) ON CONFLICT(key) DO UPDATE SET value_iqd=EXCLUDED.value_iqd,updated_at=NOW() RETURNING key,value_iqd`)[0]}

export async function businessSummary(){const [invoices,profit,customers]=await Promise.all([listInvoices(),profitability(),customers360('')]);return {invoices,profit,customers}}
