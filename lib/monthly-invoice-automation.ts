import { neon } from "@neondatabase/serverless";
import { createInvoice } from "./business-suite-db";
import { ensureGovernanceTables, writeAudit } from "./admin-governance-db";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error('DATABASE_URL is not configured');return v}
function sql(){return neon(connectionString())}
function baghdadParts(d=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const g=(t:string)=>p.find(x=>x.type===t)?.value||'';return {year:Number(g('year')),month:Number(g('month')),day:Number(g('day'))}}
const iso=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const lastDay=(y:number,m:number)=>new Date(Date.UTC(y,m,0)).getUTCDate();

export async function runMonthlyInvoiceAutomation(actor='system/cron',force=false){
  await ensureGovernanceTables();const now=baghdadParts();if(!force&&now.day!==1)return {skipped:true,reason:'not_first_day'};
  let y=now.year,m=now.month-1;if(m===0){m=12;y--}
  const from=iso(y,m,1),to=iso(y,m,lastDay(y,m)),runKey=`${from}:${to}`;const db=sql();
  const old=await db`SELECT id,invoices_created FROM monthly_invoice_runs WHERE run_key=${runKey} LIMIT 1`;if(old[0])return {skipped:true,reason:'already_ran',runKey,invoicesCreated:Number(old[0].invoices_created||0)};
  const companies=await db`SELECT p.company_name,COALESCE(a.price_per_passenger,0)::int price FROM company_profiles p LEFT JOIN company_accounts a ON a.company_name=p.company_name WHERE p.billing_cycle='monthly' AND p.status<>'suspended' AND COALESCE(a.price_per_passenger,0)>0 ORDER BY p.company_name`;
  let created=0;const errors:{company:string;message:string}[]=[];
  const dueDate=iso(now.year,now.month,15);
  for(const c of companies){try{await createInvoice({companyName:String(c.company_name),from,to,dueDate,notes:`فاتورة شهرية تلقائية عن ${from} إلى ${to}`,actor});created++}catch(e){const message=e instanceof Error?e.message:String(e);if(!message.includes('لا توجد طلبات غير مفوترة'))errors.push({company:String(c.company_name),message})}}
  await db`INSERT INTO monthly_invoice_runs(period_from,period_to,run_key,companies_checked,invoices_created,errors,created_by) VALUES(${from},${to},${runKey},${companies.length},${created},${JSON.stringify(errors)}::jsonb,${actor})`;
  await writeAudit({table:'monthly_invoice_runs',action:'AUTO_INVOICE',key:runKey,actor,newData:{companiesChecked:companies.length,invoicesCreated:created,errorCount:errors.length}});
  return {skipped:false,runKey,periodFrom:from,periodTo:to,companiesChecked:companies.length,invoicesCreated:created,errors};
}
