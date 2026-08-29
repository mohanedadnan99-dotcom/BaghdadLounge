import { adminSessionFromRequest } from "@/lib/admin-auth";
import { createApproval, createDailyClose, decideApproval, endShift, listAdminDbSessions, listApprovals, listDailyCloses, listShifts, markApprovalExecuted, operationalAlerts, revokeAdminDbSession, revokeUserSessions, startShift } from "@/lib/admin-security-db";
import { saveCompany360 } from "@/lib/admin-control-db";
import { voidInvoice } from "@/lib/business-suite-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
const who=(s:any)=>s?.name||s?.username||'admin';
function auth(request:Request){return adminSessionFromRequest(request)}

export async function GET(request:Request){
  const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:401});
  try{const u=new URL(request.url);const action=u.searchParams.get('action')||'overview';
    if(action==='overview')return Response.json({sessions:s.role==='owner'?await listAdminDbSessions():[],approvals:['owner','manager'].includes(s.role)?await listApprovals():[],shifts:await listShifts(),closes:['owner','manager','accountant'].includes(s.role)?await listDailyCloses():[],alerts:['owner','manager','accountant'].includes(s.role)?await operationalAlerts():{credit:[],invoices:[]},currentSessionId:s.sessionId||null,session:s},{headers:{'Cache-Control':'no-store'}});
    if(action==='sessions'){if(s.role!=='owner')return Response.json({message:'صلاحية المالك فقط'},{status:403});return Response.json({sessions:await listAdminDbSessions(),currentSessionId:s.sessionId||null})}
    if(action==='approvals'){if(!['owner','manager'].includes(s.role))return Response.json({message:'غير مصرح'},{status:403});return Response.json({approvals:await listApprovals()})}
    if(action==='shifts')return Response.json({shifts:await listShifts()});
    if(action==='closes'){if(!['owner','manager','accountant'].includes(s.role))return Response.json({message:'غير مصرح'},{status:403});return Response.json({closes:await listDailyCloses()})}
    if(action==='alerts')return Response.json({alerts:await operationalAlerts()});
    return Response.json({message:'إجراء غير معروف'},{status:400});
  }catch(e){console.error('security GET',e);return Response.json({message:e instanceof Error?e.message:'تعذر تحميل مركز الأمان'},{status:500})}
}

export async function POST(request:Request){
  const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:401});
  try{const b=await request.json() as Record<string,unknown>;const action=String(b.action||'');
    if(action==='shiftStart')return Response.json({shift:await startShift({username:s.username||'admin',name:s.name||s.username||'admin',role:s.role})},{status:201});
    if(action==='shiftEnd')return Response.json({shift:await endShift(s.username||'admin',String(b.note||''))});
    if(action==='dailyClose'){if(!['owner','manager','accountant'].includes(s.role))return Response.json({message:'غير مصرح'},{status:403});return Response.json({close:await createDailyClose(String(b.date||''),who(s),String(b.notes||''))},{status:201})}
    if(action==='approval'){if(!['owner','manager'].includes(s.role))return Response.json({message:'غير مصرح'},{status:403});return Response.json({approval:await createApproval({kind:String(b.kind||''),entityKey:String(b.entityKey||''),title:String(b.title||'طلب موافقة'),payload:(b.payload&&typeof b.payload==='object'?b.payload:{}) as Record<string,unknown>,requestedBy:who(s),requestedRole:s.role})},{status:201})}
    return Response.json({message:'إجراء غير معروف'},{status:400});
  }catch(e){console.error('security POST',e);return Response.json({message:e instanceof Error?e.message:'تعذر تنفيذ الإجراء'},{status:500})}
}

export async function PATCH(request:Request){
  const s=auth(request);if(!s)return Response.json({message:'غير مصرح'},{status:401});
  try{const b=await request.json() as Record<string,unknown>;const action=String(b.action||'');
    if(action==='revokeSession'){if(s.role!=='owner')return Response.json({message:'صلاحية المالك فقط'},{status:403});return Response.json({session:await revokeAdminDbSession(String(b.id||''),who(s))})}
    if(action==='revokeUserSessions'){if(s.role!=='owner')return Response.json({message:'صلاحية المالك فقط'},{status:403});return Response.json({revoked:await revokeUserSessions(String(b.username||''),who(s),String(b.exceptId||''))})}
    if(action==='decideApproval'){
      if(s.role!=='owner')return Response.json({message:'الموافقة النهائية للمالك فقط'},{status:403});
      const id=Number(b.id),decision=String(b.decision||'rejected') as 'approved'|'rejected';if(!['approved','rejected'].includes(decision))return Response.json({message:'قرار غير صحيح'},{status:400});
      const approval:any=await decideApproval(id,decision,who(s),String(b.note||''));if(!approval)return Response.json({message:'الطلب غير موجود أو تمت معالجته'},{status:404});
      if(decision==='approved'){
        if(approval.kind==='company_change'){
          const p=approval.payload||{};await saveCompany360({companyName:String(p.companyName||approval.entity_key),status:String(p.status||'normal'),creditLimitIqd:Number(p.creditLimitIqd||0),billingCycle:String(p.billingCycle||'monthly'),contactName:String(p.contactName||''),contactPhone:String(p.contactPhone||''),tags:String(p.tags||''),notes:String(p.notes||''),pricePerPassenger:Number(p.pricePerPassenger||0),actor:who(s)});
        }else if(approval.kind==='void_invoice'){await voidInvoice(Number((approval.payload||{}).invoiceId||approval.entity_key))}
        await markApprovalExecuted(id);
      }
      return Response.json({approval});
    }
    return Response.json({message:'إجراء غير معروف'},{status:400});
  }catch(e){console.error('security PATCH',e);return Response.json({message:e instanceof Error?e.message:'تعذر تنفيذ الإجراء'},{status:500})}
}
