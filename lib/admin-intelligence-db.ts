import { neon } from "@neondatabase/serverless";
import { ensureBusinessTables } from "./business-suite-db";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function ensureIntelligenceTables(){
  await ensureBusinessTables();const db=sql();
  await db`CREATE TABLE IF NOT EXISTS intelligence_settings(
    key TEXT PRIMARY KEY,value_iqd BIGINT NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`INSERT INTO intelligence_settings(key,value_iqd) VALUES('monthly_revenue_target',0),('monthly_passenger_target',0) ON CONFLICT(key) DO NOTHING`;
}

const n=(v:any)=>Number(v||0);
const pct=(a:number,b:number)=>b===0?(a>0?100:0):Math.round(((a-b)/b)*1000)/10;

export async function saveIntelligenceTarget(key:string,value:number){
  await ensureIntelligenceTables();const allowed=['monthly_revenue_target','monthly_passenger_target'];if(!allowed.includes(key))throw new Error('إعداد هدف غير صالح');const db=sql();
  return (await db`INSERT INTO intelligence_settings(key,value_iqd) VALUES(${key},${Math.max(0,Math.round(value))}) ON CONFLICT(key) DO UPDATE SET value_iqd=EXCLUDED.value_iqd,updated_at=NOW() RETURNING key,value_iqd`)[0];
}

export async function intelligenceSummary(){
  await ensureIntelligenceTables();const db=sql();
  const [settings,base,companies,lounges,hours,weekdays,overdue,credit]=await Promise.all([
    db`SELECT key,value_iqd::bigint FROM intelligence_settings`,
    db`WITH bounds AS(
      SELECT date_trunc('month',NOW()) m0,date_trunc('month',NOW())-INTERVAL '1 month' p0,date_trunc('day',NOW()) d0
    ), all_orders AS(
      SELECT created_at,status,passengers,total_iqd::bigint revenue FROM lounge_bookings
      UNION ALL
      SELECT o.created_at,o.status,o.passengers,(o.passengers*COALESCE(a.price_per_passenger,0))::bigint revenue FROM captain_lounge_orders o LEFT JOIN company_accounts a ON a.company_name=o.captain_company
    )
    SELECT
      COUNT(*) FILTER(WHERE created_at>=b.d0)::int today_orders,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=b.d0 AND status<>'cancelled'),0)::int today_passengers,
      COUNT(*) FILTER(WHERE created_at>=b.m0)::int month_orders,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=b.m0 AND status<>'cancelled'),0)::int month_passengers,
      COALESCE(SUM(revenue) FILTER(WHERE created_at>=b.m0 AND status<>'cancelled'),0)::bigint month_revenue,
      COUNT(*) FILTER(WHERE created_at>=b.p0 AND created_at<b.m0)::int prev_orders,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=b.p0 AND created_at<b.m0 AND status<>'cancelled'),0)::int prev_passengers,
      COALESCE(SUM(revenue) FILTER(WHERE created_at>=b.p0 AND created_at<b.m0 AND status<>'cancelled'),0)::bigint prev_revenue,
      COUNT(*) FILTER(WHERE created_at>=b.m0 AND status='cancelled')::int month_cancelled
    FROM all_orders CROSS JOIN bounds b`,
    db`WITH c AS(
      SELECT captain_company company_name,
        COUNT(*) FILTER(WHERE created_at>=date_trunc('month',NOW()))::int orders_now,
        COALESCE(SUM(passengers) FILTER(WHERE created_at>=date_trunc('month',NOW()) AND status<>'cancelled'),0)::int pax_now,
        COUNT(*) FILTER(WHERE created_at>=date_trunc('month',NOW())-INTERVAL '1 month' AND created_at<date_trunc('month',NOW()))::int orders_prev,
        COALESCE(SUM(passengers) FILTER(WHERE created_at>=date_trunc('month',NOW())-INTERVAL '1 month' AND created_at<date_trunc('month',NOW()) AND status<>'cancelled'),0)::int pax_prev,
        MAX(created_at) last_order
      FROM captain_lounge_orders WHERE captain_company<>'' GROUP BY captain_company
    ) SELECT c.*,COALESCE(a.price_per_passenger,0)::int price_per_passenger,(c.pax_now*COALESCE(a.price_per_passenger,0))::bigint estimated_revenue FROM c LEFT JOIN company_accounts a ON a.company_name=c.company_name ORDER BY pax_now DESC,orders_now DESC LIMIT 100`,
    db`WITH x AS(
      SELECT lounge_name,created_at,status,passengers FROM captain_lounge_orders
      UNION ALL
      SELECT 'لاونج بغداد'::text AS lounge_name,created_at,status,passengers FROM lounge_bookings
    ) SELECT lounge_name,
      COUNT(*) FILTER(WHERE created_at>=date_trunc('month',NOW()))::int orders_now,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=date_trunc('month',NOW()) AND status<>'cancelled'),0)::int pax_now,
      COUNT(*) FILTER(WHERE created_at>=date_trunc('month',NOW())-INTERVAL '1 month' AND created_at<date_trunc('month',NOW()))::int orders_prev,
      COALESCE(SUM(passengers) FILTER(WHERE created_at>=date_trunc('month',NOW())-INTERVAL '1 month' AND created_at<date_trunc('month',NOW()) AND status<>'cancelled'),0)::int pax_prev
      FROM x WHERE COALESCE(lounge_name,'')<>'' GROUP BY lounge_name ORDER BY pax_now DESC LIMIT 50`,
    db`WITH x AS(SELECT created_at,status FROM lounge_bookings UNION ALL SELECT created_at,status FROM captain_lounge_orders) SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Baghdad')::int AS "hour",COUNT(*)::int AS orders FROM x WHERE created_at>=NOW()-INTERVAL '90 days' AND status<>'cancelled' GROUP BY 1 ORDER BY orders DESC,"hour" LIMIT 8`,
    db`WITH x AS(SELECT created_at,status FROM lounge_bookings UNION ALL SELECT created_at,status FROM captain_lounge_orders) SELECT EXTRACT(ISODOW FROM created_at AT TIME ZONE 'Asia/Baghdad')::int dow,COUNT(*)::int orders FROM x WHERE created_at>=NOW()-INTERVAL '90 days' AND status<>'cancelled' GROUP BY 1 ORDER BY orders DESC,dow`,
    db`SELECT id::int,invoice_number,company_name,due_date,subtotal_iqd::bigint,COALESCE((SELECT SUM(p.amount_iqd) FROM company_invoice_payments p WHERE p.invoice_id=i.id),0)::bigint paid_iqd,(CURRENT_DATE-due_date)::int days_overdue FROM company_invoices i WHERE status IN ('unpaid','partial') AND due_date<CURRENT_DATE ORDER BY due_date LIMIT 50`,
    db`WITH b AS(SELECT p.company_name,p.credit_limit_iqd::bigint lim,COALESCE(a.price_per_passenger,0)::int price,(SELECT COALESCE(SUM(o.passengers),0) FROM captain_lounge_orders o WHERE o.captain_company=p.company_name AND o.status<>'cancelled')::bigint pax,(SELECT COALESCE(SUM(x.amount_iqd),0) FROM company_payments x WHERE x.company_name=p.company_name)::bigint paid FROM company_profiles p LEFT JOIN company_accounts a ON a.company_name=p.company_name WHERE p.credit_limit_iqd>0) SELECT company_name,lim,((pax*price)-paid)::bigint balance,ROUND(GREATEST(0,((pax*price)-paid))::numeric*100/NULLIF(lim,0),1) percent FROM b WHERE ((pax*price)-paid)>=lim*0.7 ORDER BY percent DESC LIMIT 50`
  ]);
  const s=Object.fromEntries(settings.map((x:any)=>[x.key,n(x.value_iqd)]));const b:any=base[0]||{};
  const now=new Date();const baghdad=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Baghdad'}));const day=Math.max(1,baghdad.getDate());const daysInMonth=new Date(baghdad.getFullYear(),baghdad.getMonth()+1,0).getDate();
  const monthRevenue=n(b.month_revenue),monthPassengers=n(b.month_passengers),monthOrders=n(b.month_orders);const forecastRevenue=Math.round(monthRevenue/day*daysInMonth);const forecastPassengers=Math.round(monthPassengers/day*daysInMonth);const forecastOrders=Math.round(monthOrders/day*daysInMonth);
  const revenueTarget=n(s.monthly_revenue_target),passengerTarget=n(s.monthly_passenger_target);
  const companyRows=companies.map((c:any)=>({...c,orders_now:n(c.orders_now),pax_now:n(c.pax_now),orders_prev:n(c.orders_prev),pax_prev:n(c.pax_prev),estimated_revenue:n(c.estimated_revenue),growth_percent:pct(n(c.pax_now),n(c.pax_prev))}));
  const loungeRows=lounges.map((l:any)=>({...l,orders_now:n(l.orders_now),pax_now:n(l.pax_now),orders_prev:n(l.orders_prev),pax_prev:n(l.pax_prev),growth_percent:pct(n(l.pax_now),n(l.pax_prev))}));
  const decisions:Array<{severity:'critical'|'warning'|'positive'|'info';title:string;detail:string;action:string}>=[];
  for(const c of credit as any[]){const p=n(c.percent);decisions.push({severity:p>=100?'critical':'warning',title:`الحد الائتماني — ${c.company_name}`,detail:`الاستخدام ${p}%، الرصيد ${n(c.balance).toLocaleString('en-US')} د.ع من حد ${n(c.lim).toLocaleString('en-US')} د.ع.`,action:p>=100?'أوقف الطلبات الجديدة وراجع التحصيل.':'تابع التحصيل قبل الوصول للحد.'})}
  for(const i of (overdue as any[]).slice(0,5)){decisions.push({severity:'critical',title:`فاتورة متأخرة — ${i.company_name}`,detail:`${i.invoice_number} متأخرة ${n(i.days_overdue)} يوم، المتبقي ${(n(i.subtotal_iqd)-n(i.paid_iqd)).toLocaleString('en-US')} د.ع.`,action:'تابع الشركة وسجل الدفعة أو خطة التحصيل.'})}
  for(const c of companyRows.filter((x:any)=>x.pax_prev>=3&&x.growth_percent<=-40).slice(0,5)){decisions.push({severity:'warning',title:`انخفاض نشاط — ${c.company_name}`,detail:`المسافرون انخفضوا ${Math.abs(c.growth_percent)}% مقارنة بالشهر السابق.`,action:'تواصل مع الشركة واعرف سبب انخفاض الطلبات.'})}
  for(const c of companyRows.filter((x:any)=>x.pax_now>=5&&x.growth_percent>=50).slice(0,3)){decisions.push({severity:'positive',title:`نمو قوي — ${c.company_name}`,detail:`النشاط ارتفع ${c.growth_percent}% عن الشهر السابق.`,action:'حافظ على العلاقة وراجع إمكانية توسيع التعاون.'})}
  if(revenueTarget>0){const projected=Math.round(forecastRevenue/revenueTarget*100);decisions.push({severity:projected>=100?'positive':projected>=80?'info':'warning',title:'هدف الإيراد الشهري',detail:`التوقع الحالي ${forecastRevenue.toLocaleString('en-US')} د.ع، أي ${projected}% من الهدف.`,action:projected<100?'ركز على الشركات الأعلى فرصة للنمو قبل نهاية الشهر.':'المعدل الحالي يتجاوز الهدف الشهري.'})}
  const cancelRate=monthOrders?Math.round(n(b.month_cancelled)/monthOrders*1000)/10:0;if(monthOrders>=10&&cancelRate>=20)decisions.push({severity:'warning',title:'معدل إلغاء مرتفع',detail:`الإلغاء هذا الشهر ${cancelRate}% من الطلبات.`,action:'راجع أسباب الإلغاء حسب القناة والصالة والكابتن.'});
  return {generatedAt:new Date().toISOString(),targets:{revenueIqd:revenueTarget,passengers:passengerTarget},kpis:{todayOrders:n(b.today_orders),todayPassengers:n(b.today_passengers),monthOrders,monthPassengers,monthRevenueIqd:monthRevenue,previousOrders:n(b.prev_orders),previousPassengers:n(b.prev_passengers),previousRevenueIqd:n(b.prev_revenue),ordersGrowthPercent:pct(monthOrders,n(b.prev_orders)),passengersGrowthPercent:pct(monthPassengers,n(b.prev_passengers)),revenueGrowthPercent:pct(monthRevenue,n(b.prev_revenue)),cancelRatePercent:cancelRate},forecast:{orders:forecastOrders,passengers:forecastPassengers,revenueIqd:forecastRevenue,revenueTargetProgress:revenueTarget?Math.round(monthRevenue/revenueTarget*1000)/10:null,revenueForecastProgress:revenueTarget?Math.round(forecastRevenue/revenueTarget*1000)/10:null,passengerTargetProgress:passengerTarget?Math.round(monthPassengers/passengerTarget*1000)/10:null,passengerForecastProgress:passengerTarget?Math.round(forecastPassengers/passengerTarget*1000)/10:null,day,daysInMonth},companies:companyRows,lounges:loungeRows,peakHours:hours,peakWeekdays:weekdays,overdueInvoices:overdue,creditAlerts:credit,decisions:decisions.slice(0,20)};
}
