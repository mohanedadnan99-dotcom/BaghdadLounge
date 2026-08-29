import { neon } from "@neondatabase/serverless";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function executiveDashboardFast(){
  const db=sql();
  const settings=await db`SELECT key,value FROM admin_settings`;
  const settingsMap=Object.fromEntries(settings.map((x:any)=>[x.key,x.value]));
  const sla=Math.max(1,Number(settingsMap.sla_minutes||15)||15);
  const [customer,captain,finance,tasks,alerts]=await Promise.all([
    db`SELECT
      COUNT(*) FILTER (WHERE created_at>=date_trunc('day',NOW()))::int AS today_count,
      COUNT(*) FILTER (WHERE created_at>=date_trunc('month',NOW()))::int AS month_count,
      COALESCE(SUM(passengers) FILTER (WHERE created_at>=date_trunc('month',NOW())),0)::int AS passengers_month,
      COALESCE(SUM(total_iqd) FILTER (WHERE created_at>=date_trunc('month',NOW()) AND status<>'cancelled'),0)::bigint AS revenue_month
      FROM lounge_bookings`,
    db`SELECT
      COUNT(*) FILTER (WHERE created_at>=date_trunc('day',NOW()))::int AS today_count,
      COUNT(*) FILTER (WHERE created_at>=date_trunc('month',NOW()))::int AS month_count,
      COALESCE(SUM(passengers) FILTER (WHERE created_at>=date_trunc('month',NOW()) AND status<>'cancelled'),0)::int AS passengers_month,
      COUNT(*) FILTER (WHERE status='new' AND archived_at IS NULL)::int AS new_orders,
      COUNT(*) FILTER (WHERE status='new' AND archived_at IS NULL AND created_at<NOW()-(${sla}*INTERVAL '1 minute'))::int AS delayed
      FROM captain_lounge_orders`,
    db`WITH names AS(
      SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>''
      UNION SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>''
      UNION SELECT company_name FROM company_accounts
    ), order_stats AS(
      SELECT captain_company AS name,COALESCE(SUM(passengers),0)::bigint AS pax
      FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND status<>'cancelled' GROUP BY captain_company
    ), pay_stats AS(
      SELECT company_name AS name,COALESCE(SUM(amount_iqd),0)::bigint AS paid
      FROM company_payments GROUP BY company_name
    )
    SELECT COALESCE(SUM(COALESCE(os.pax,0)*COALESCE(a.price_per_passenger,0)),0)::bigint AS due,
      COALESCE(SUM(COALESCE(ps.paid,0)),0)::bigint AS paid
    FROM names n LEFT JOIN company_accounts a ON a.company_name=n.name LEFT JOIN order_stats os ON os.name=n.name LEFT JOIN pay_stats ps ON ps.name=n.name`,
    db`SELECT COUNT(*) FILTER (WHERE status='open')::int AS open_count,COUNT(*) FILTER (WHERE status='open' AND due_at<NOW())::int AS overdue FROM admin_tasks`,
    db`SELECT COUNT(*) FILTER (WHERE active=TRUE)::int AS watch FROM operations_watchlist`
  ]);
  const c:any=customer[0]||{},k:any=captain[0]||{},f:any=finance[0]||{},t:any=tasks[0]||{},a:any=alerts[0]||{};
  const due=Number(f.due||0),paid=Number(f.paid||0);
  return {
    slaMinutes:sla,
    customer:{today:Number(c.today_count||0),month:Number(c.month_count||0),passengers_month:Number(c.passengers_month||0),revenue_month:Number(c.revenue_month||0)},
    captain:{today:Number(k.today_count||0),month:Number(k.month_count||0),passengers_month:Number(k.passengers_month||0),new_orders:Number(k.new_orders||0),delayed:Number(k.delayed||0)},
    finance:{due,paid,outstanding:due-paid},
    tasks:{open:Number(t.open_count||0),overdue:Number(t.overdue||0)},
    watch:Number(a.watch||0),settings:settingsMap
  };
}
