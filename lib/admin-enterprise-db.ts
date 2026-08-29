import { neon } from "@neondatabase/serverless";
import { ensureOperationsTables } from "./operations-db";

function connectionString(){const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!value)throw new Error("DATABASE_URL is not configured");return value}
function sql(){return neon(connectionString())}

export type AutomationRule={id:number;kind:"delay_priority"|"auto_archive";name:string;threshold_value:number;active:boolean;created_at:string;updated_at:string};
export async function ensureEnterpriseTables(){
  const db=sql();
  await db`CREATE TABLE IF NOT EXISTS admin_automation_rules(
    id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('delay_priority','auto_archive')),name TEXT NOT NULL,
    threshold_value INTEGER NOT NULL CHECK(threshold_value>=1),active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS admin_system_errors(
    id BIGSERIAL PRIMARY KEY,source TEXT NOT NULL,message TEXT NOT NULL,details TEXT NOT NULL DEFAULT '',resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows=await db`SELECT COUNT(*)::int AS n FROM admin_automation_rules`;
  if(Number(rows[0]?.n||0)===0){
    await db`INSERT INTO admin_automation_rules(kind,name,threshold_value,active) VALUES
      ('delay_priority','رفع أولوية الطلب المتأخر',15,TRUE),('auto_archive','أرشفة المكتمل القديم',7,TRUE)`;
  }
}

export async function runAutomationRules(){
  await ensureEnterpriseTables();const db=sql();
  const rules=await db`SELECT id::int,kind,name,threshold_value,active FROM admin_automation_rules WHERE active=TRUE` as AutomationRule[];
  let affected=0;
  for(const r of rules){
    if(r.kind==="delay_priority"){
      const customer=await db`UPDATE lounge_bookings SET priority='urgent' WHERE status='new' AND archived_at IS NULL AND priority<>'urgent' AND created_at < NOW()-(${r.threshold_value}*INTERVAL '1 minute') RETURNING id`;
      const captain=await db`UPDATE captain_lounge_orders SET priority='urgent' WHERE status='new' AND archived_at IS NULL AND priority<>'urgent' AND created_at < NOW()-(${r.threshold_value}*INTERVAL '1 minute') RETURNING id`;
      affected+=customer.length+captain.length;
    }else if(r.kind==="auto_archive"){
      const customer=await db`UPDATE lounge_bookings SET archived_at=NOW() WHERE archived_at IS NULL AND status IN ('completed','cancelled') AND created_at < NOW()-(${r.threshold_value}*INTERVAL '1 day') RETURNING id`;
      const captain=await db`UPDATE captain_lounge_orders SET archived_at=NOW() WHERE archived_at IS NULL AND status IN ('completed','cancelled') AND created_at < NOW()-(${r.threshold_value}*INTERVAL '1 day') RETURNING id`;
      affected+=customer.length+captain.length;
    }
  }
  return {rules:rules.length,affected};
}
export async function listAutomationRules(){await ensureEnterpriseTables();const db=sql();return await db`SELECT id::int,kind,name,threshold_value,active,created_at,updated_at FROM admin_automation_rules ORDER BY id` as AutomationRule[]}
export async function updateAutomationRule(input:{id:number;thresholdValue:number;active:boolean}){await ensureEnterpriseTables();const db=sql();const rows=await db`UPDATE admin_automation_rules SET threshold_value=${input.thresholdValue},active=${input.active},updated_at=NOW() WHERE id=${input.id} RETURNING id::int,kind,name,threshold_value,active,created_at,updated_at`;return rows[0] as AutomationRule|undefined}

export async function recordSystemError(source:string,error:unknown){try{await ensureEnterpriseTables();const db=sql();const message=error instanceof Error?error.message:String(error);const details=error instanceof Error?(error.stack||""):"";await db`INSERT INTO admin_system_errors(source,message,details) VALUES(${source},${message.slice(0,500)},${details.slice(0,4000)})`}catch{}}
export async function listSystemErrors(){await ensureEnterpriseTables();const db=sql();return await db`SELECT id::int,source,message,details,resolved,created_at FROM admin_system_errors ORDER BY created_at DESC LIMIT 50`}
export async function resolveSystemError(id:number,resolved:boolean){await ensureEnterpriseTables();const db=sql();const rows=await db`UPDATE admin_system_errors SET resolved=${resolved} WHERE id=${id} RETURNING id::int,source,message,resolved,created_at`;return rows[0]}

export async function systemHealth(){
  const start=Date.now();await ensureEnterpriseTables();const db=sql();await db`SELECT 1 AS ok`;
  const unresolved=await db`SELECT COUNT(*)::int AS n FROM admin_system_errors WHERE resolved=FALSE AND created_at>NOW()-INTERVAL '7 days'`;
  return {
    database:{ok:true,latencyMs:Date.now()-start},
    telegram:{ok:Boolean(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),configured:Boolean(process.env.TELEGRAM_BOT_TOKEN)},
    payments:{ok:Boolean(process.env.WAYL_API_KEY||process.env.WAYL_SECRET||process.env.WAYL_TOKEN),configured:Boolean(process.env.WAYL_API_KEY||process.env.WAYL_SECRET||process.env.WAYL_TOKEN)},
    unresolvedErrors:Number(unresolved[0]?.n||0),checkedAt:new Date().toISOString()
  };
}

export async function companyStatement(companyName:string,from:string,to:string){
  await ensureOperationsTables();const db=sql();
  const account=await db`SELECT company_name,price_per_passenger,notes FROM company_accounts WHERE company_name=${companyName} LIMIT 1`;
  const price=Number(account[0]?.price_per_passenger||0);
  const start=`${from}T00:00:00+03:00`;const end=`${to}T23:59:59.999+03:00`;
  const [orders,payments,openingOrders,openingPayments,promoBookings]=await Promise.all([
    db`SELECT reference,captain_name,captain_phone,lounge_name,passengers,bags,carts,passenger_phone,status,created_at FROM captain_lounge_orders WHERE captain_company=${companyName} AND created_at>=${start}::timestamptz AND created_at<=${end}::timestamptz ORDER BY created_at`,
    db`SELECT id::int,amount_iqd::bigint,note,created_at FROM company_payments WHERE company_name=${companyName} AND created_at>=${start}::timestamptz AND created_at<=${end}::timestamptz ORDER BY created_at`,
    db`SELECT COALESCE(SUM(passengers),0)::bigint AS passengers FROM captain_lounge_orders WHERE captain_company=${companyName} AND status<>'cancelled' AND created_at<${start}::timestamptz`,
    db`SELECT COALESCE(SUM(amount_iqd),0)::bigint AS paid FROM company_payments WHERE company_name=${companyName} AND created_at<${start}::timestamptz`,
    db`SELECT b.reference,b.customer_name,b.phone,b.passengers,b.total_iqd,b.discount_iqd,b.created_at,p.code FROM lounge_bookings b JOIN company_promo_codes p ON UPPER(p.code)=UPPER(b.promo_code) WHERE p.company_name=${companyName} AND b.created_at>=${start}::timestamptz AND b.created_at<=${end}::timestamptz ORDER BY b.created_at`
  ]);
  const billableOrders=(orders as any[]).filter(o=>String(o.status)!=="cancelled");
  const passengers=billableOrders.reduce((sum,o)=>sum+Number(o.passengers||0),0);
  const periodDue=passengers*price;
  const periodPaid=(payments as any[]).reduce((sum,p)=>sum+Number(p.amount_iqd||0),0);
  const openingDue=Number(openingOrders[0]?.passengers||0)*price;
  const openingPaid=Number(openingPayments[0]?.paid||0);
  const openingBalance=openingDue-openingPaid;
  const closingBalance=openingBalance+periodDue-periodPaid;
  return {
    companyName,from,to,pricePerPassenger:price,notes:String(account[0]?.notes||""),
    opening:{passengers:Number(openingOrders[0]?.passengers||0),dueIqd:openingDue,paidIqd:openingPaid,balanceIqd:openingBalance},
    orders,passengers,dueIqd:periodDue,payments,paidIqd:periodPaid,balanceIqd:periodDue-periodPaid,closingBalanceIqd:closingBalance,
    promoBookings,promoBookingsCount:(promoBookings as any[]).length,promoPassengers:(promoBookings as any[]).reduce((s,o)=>s+Number(o.passengers||0),0),promoDiscountIqd:(promoBookings as any[]).reduce((s,o)=>s+Number(o.discount_iqd||0),0)
  };
}
