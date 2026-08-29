import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { listCompanies360 } from "@/lib/admin-control-db";
import { addInvoicePayment, businessSummary, companyCreditDecision, createInvoice, customer360, customers360, getInvoice, listInvoices, profitability, saveCost, voidInvoice } from "@/lib/business-suite-db";
import { createApproval } from "@/lib/admin-security-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function session(request:Request){const s=adminSessionFromRequest(request);if(!s)return null;if(!(roleCan(s.role,'finance')||s.role==='manager'||s.role==='owner'))return null;return s}
const actor=(s:any)=>s?.name||s?.username||'admin';

type C={at:number;value:any};const cache=new Map<string,C>();const TTL=10000;
async function fast(key:string,fn:()=>Promise<any>){const hit=cache.get(key);if(hit&&Date.now()-hit.at<TTL)return hit.value;const value=await fn();cache.set(key,{at:Date.now(),value});return value}
function bust(){cache.clear()}

export async function GET(request:Request){
  const s=session(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});
  try{const u=new URL(request.url);const action=u.searchParams.get('action')||'summary';
    if(action==='summary')return Response.json(await fast('summary',businessSummary),{headers:{'Cache-Control':'private, max-age=5'}});
    if(action==='companies')return Response.json(await fast('companies',async()=>({companies:await listCompanies360()})));
    if(action==='invoices')return Response.json(await fast('invoices',async()=>({invoices:await listInvoices()})));
    if(action==='invoice'){const id=Number(u.searchParams.get('id'));return Response.json({invoice:await getInvoice(id)})}
    if(action==='customers')return Response.json({customers:await customers360(u.searchParams.get('q')||'')});
    if(action==='customer')return Response.json({customer:await customer360(u.searchParams.get('phone')||'')});
    if(action==='profit')return Response.json(await fast('profit',async()=>({profit:await profitability()})));
    if(action==='credit')return Response.json({credit:await companyCreditDecision(u.searchParams.get('company')||'')});
    return Response.json({message:'طلب غير معروف'},{status:400});
  }catch(e){console.error(e);return Response.json({message:e instanceof Error?e.message:'تعذر تحميل البيانات'},{status:500})}
}

export async function POST(request:Request){
  const s=session(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});
  try{const b=await request.json() as Record<string,unknown>;const action=String(b.action||'');
    if(action==='invoice'){const companyName=String(b.companyName||'').trim(),from=String(b.from||''),to=String(b.to||''),dueDate=String(b.dueDate||''),notes=String(b.notes||'').trim();if(!companyName||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return Response.json({message:'بيانات الفاتورة غير مكتملة'},{status:400});const invoice=await createInvoice({companyName,from,to,dueDate,notes,actor:actor(s)});bust();return Response.json({invoice},{status:201})}
    if(action==='payment'){const invoiceId=Number(b.invoiceId),amountIqd=Math.round(Number(b.amountIqd)),note=String(b.note||'').trim();if(!Number.isInteger(invoiceId)||invoiceId<=0||!Number.isFinite(amountIqd)||amountIqd<=0)return Response.json({message:'بيانات الدفعة غير صحيحة'},{status:400});const payment=await addInvoicePayment({invoiceId,amountIqd,note,actor:actor(s)});bust();return Response.json({payment},{status:201})}
    if(action==='cost'){if(s.role!=='owner'&&s.role!=='manager')return Response.json({message:'لا تملك صلاحية تعديل التكاليف'},{status:403});const key=String(b.key||''),value=Math.max(0,Math.round(Number(b.value)));const setting=await saveCost(key,value);bust();return Response.json({setting})}
    return Response.json({message:'إجراء غير معروف'},{status:400});
  }catch(e){console.error(e);return Response.json({message:e instanceof Error?e.message:'تعذر تنفيذ الإجراء'},{status:500})}
}

export async function PATCH(request:Request){
  const s=session(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});
  try{const b=await request.json() as Record<string,unknown>;
    if(String(b.action)==='voidInvoice'){
      if(s.role==='manager'){
        const id=Number(b.id);const approval=await createApproval({kind:'void_invoice',entityKey:String(id),title:`إلغاء فاتورة #${id}`,payload:{invoiceId:id},requestedBy:actor(s),requestedRole:s.role});
        return Response.json({pendingApproval:true,approval,message:'تم إرسال طلب إلغاء الفاتورة لموافقة المالك'},{status:202});
      }
      if(s.role!=='owner')return Response.json({message:'لا تملك صلاحية إلغاء الفاتورة'},{status:403});
      const invoice=await voidInvoice(Number(b.id));bust();return Response.json({invoice})
    }
    return Response.json({message:'إجراء غير معروف'},{status:400})
  }catch(e){return Response.json({message:e instanceof Error?e.message:'تعذر التنفيذ'},{status:500})}
}
