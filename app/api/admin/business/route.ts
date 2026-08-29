import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { listCompanies360 } from "@/lib/admin-control-db";
import { addInvoicePayment, businessSummary, companyCreditDecision, createInvoice, customer360, customers360, getInvoice, listInvoices, profitability, saveCost, voidInvoice } from "@/lib/business-suite-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function session(request:Request){const s=adminSessionFromRequest(request);if(!s)return null;if(!(roleCan(s.role,'finance')||s.role==='manager'||s.role==='owner'))return null;return s}
const actor=(s:any)=>s?.name||s?.username||'admin';

export async function GET(request:Request){
  const s=session(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});
  try{const u=new URL(request.url);const action=u.searchParams.get('action')||'summary';
    if(action==='summary')return Response.json(await businessSummary(),{headers:{'Cache-Control':'no-store'}});
    if(action==='companies')return Response.json({companies:await listCompanies360()},{headers:{'Cache-Control':'no-store'}});
    if(action==='invoices')return Response.json({invoices:await listInvoices()},{headers:{'Cache-Control':'no-store'}});
    if(action==='invoice'){const id=Number(u.searchParams.get('id'));return Response.json({invoice:await getInvoice(id)},{headers:{'Cache-Control':'no-store'}})}
    if(action==='customers')return Response.json({customers:await customers360(u.searchParams.get('q')||'')},{headers:{'Cache-Control':'no-store'}});
    if(action==='customer')return Response.json({customer:await customer360(u.searchParams.get('phone')||'')},{headers:{'Cache-Control':'no-store'}});
    if(action==='profit')return Response.json({profit:await profitability()},{headers:{'Cache-Control':'no-store'}});
    if(action==='credit')return Response.json({credit:await companyCreditDecision(u.searchParams.get('company')||'')},{headers:{'Cache-Control':'no-store'}});
    return Response.json({message:'طلب غير معروف'},{status:400});
  }catch(e){console.error(e);return Response.json({message:e instanceof Error?e.message:'تعذر تحميل البيانات'},{status:500})}
}

export async function POST(request:Request){
  const s=session(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});
  try{const b=await request.json() as Record<string,unknown>;const action=String(b.action||'');
    if(action==='invoice'){const companyName=String(b.companyName||'').trim(),from=String(b.from||''),to=String(b.to||''),dueDate=String(b.dueDate||''),notes=String(b.notes||'').trim();if(!companyName||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return Response.json({message:'بيانات الفاتورة غير مكتملة'},{status:400});return Response.json({invoice:await createInvoice({companyName,from,to,dueDate,notes,actor:actor(s)})},{status:201})}
    if(action==='payment'){const invoiceId=Number(b.invoiceId),amountIqd=Math.round(Number(b.amountIqd)),note=String(b.note||'').trim();if(!Number.isInteger(invoiceId)||invoiceId<=0||!Number.isFinite(amountIqd)||amountIqd<=0)return Response.json({message:'بيانات الدفعة غير صحيحة'},{status:400});return Response.json({payment:await addInvoicePayment({invoiceId,amountIqd,note,actor:actor(s)})},{status:201})}
    if(action==='cost'){if(s.role!=='owner'&&s.role!=='manager')return Response.json({message:'لا تملك صلاحية تعديل التكاليف'},{status:403});const key=String(b.key||''),value=Math.max(0,Math.round(Number(b.value)));return Response.json({setting:await saveCost(key,value)})}
    return Response.json({message:'إجراء غير معروف'},{status:400});
  }catch(e){console.error(e);return Response.json({message:e instanceof Error?e.message:'تعذر تنفيذ الإجراء'},{status:500})}
}

export async function PATCH(request:Request){const s=session(request);if(!s)return Response.json({message:'غير مصرح'},{status:403});try{const b=await request.json() as Record<string,unknown>;if(String(b.action)==='voidInvoice'){if(s.role!=='owner'&&s.role!=='manager')return Response.json({message:'لا تملك صلاحية إلغاء الفاتورة'},{status:403});return Response.json({invoice:await voidInvoice(Number(b.id))})}return Response.json({message:'إجراء غير معروف'},{status:400})}catch(e){return Response.json({message:e instanceof Error?e.message:'تعذر التنفيذ'},{status:500})}}
