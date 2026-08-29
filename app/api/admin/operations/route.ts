import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import {
  addCompanyPayment,addWatchItem,createMessage,deleteMessage,deleteWatchItem,getOperationsAdminData,
  saveCompanyAccount,toggleMessage,toggleWatchItem,updateLounge
} from "@/lib/operations-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function session(request:Request){return adminSessionFromRequest(request)}
function denied(){return Response.json({message:"غير مصرح لهذا الإجراء"},{status:403})}

export async function GET(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  if(!roleCan(s.role,"operations")&&!roleCan(s.role,"finance"))return denied();
  try{return Response.json(await getOperationsAdminData(),{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({message:"تعذر تحميل إعدادات التشغيل"},{status:500})}
}
export async function POST(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="payment"){
      if(!roleCan(s.role,"finance"))return denied();
      const companyName=String(body.companyName||"").trim();const amountIqd=Math.round(Number(body.amountIqd));const note=String(body.note||"").trim();
      if(companyName.length<2||!Number.isFinite(amountIqd)||amountIqd<=0)return Response.json({message:"بيانات الدفعة غير صحيحة"},{status:400});
      return Response.json({item:await addCompanyPayment(companyName,amountIqd,note)},{status:201});
    }
    if(!roleCan(s.role,"operations"))return denied();
    if(action==="message"){
      const text=String(body.text||"").trim();if(text.length<3)return Response.json({message:"اكتب رسالة واضحة"},{status:400});
      return Response.json({item:await createMessage(text)},{status:201});
    }
    if(action==="watch"){
      const kind=String(body.kind||"");const value=String(body.value||"").trim();const note=String(body.note||"").trim();
      if(!["phone","captain","company"].includes(kind)||value.length<2)return Response.json({message:"بيانات قائمة المراقبة غير صحيحة"},{status:400});
      return Response.json({item:await addWatchItem({kind,value,note})},{status:201});
    }
    return Response.json({message:"الإجراء غير معروف"},{status:400});
  }catch(error){console.error(error);return Response.json({message:"تعذر حفظ التغيير"},{status:500})}
}
export async function PATCH(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="company"){
      if(!roleCan(s.role,"finance"))return denied();
      const companyName=String(body.companyName||"").trim();const pricePerPassenger=Math.max(0,Math.round(Number(body.pricePerPassenger)||0));
      if(companyName.length<2)return Response.json({message:"اسم الشركة غير صحيح"},{status:400});
      return Response.json({item:await saveCompanyAccount(companyName,pricePerPassenger,String(body.notes||""))});
    }
    if(!roleCan(s.role,"operations"))return denied();
    if(action==="lounge"){
      const id=String(body.id||"");const name=String(body.name||"").trim();const priceIqd=Math.max(0,Math.round(Number(body.priceIqd)||0));const sortOrder=Math.round(Number(body.sortOrder)||0);
      if(!id||name.length<2)return Response.json({message:"بيانات الصالة غير صحيحة"},{status:400});
      return Response.json({item:await updateLounge({id,name,active:Boolean(body.active),priceIqd,note:String(body.note||""),sortOrder})});
    }
    if(action==="message")return Response.json({item:await toggleMessage(Number(body.id),Boolean(body.active))});
    if(action==="watch")return Response.json({item:await toggleWatchItem(Number(body.id),Boolean(body.active))});
    return Response.json({message:"الإجراء غير معروف"},{status:400});
  }catch(error){console.error(error);return Response.json({message:"تعذر تحديث الإعداد"},{status:500})}
}
export async function DELETE(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});if(!roleCan(s.role,"operations"))return denied();
  try{
    const url=new URL(request.url);const action=url.searchParams.get("action");const id=Number(url.searchParams.get("id"));
    if(!Number.isFinite(id))return Response.json({message:"المعرف غير صحيح"},{status:400});
    if(action==="message")await deleteMessage(id);else if(action==="watch")await deleteWatchItem(id);else return Response.json({message:"الإجراء غير معروف"},{status:400});
    return Response.json({ok:true});
  }catch(error){console.error(error);return Response.json({message:"تعذر الحذف"},{status:500})}
}
