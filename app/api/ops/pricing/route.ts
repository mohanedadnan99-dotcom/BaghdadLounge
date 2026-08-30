import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { getOpsPricingSettings, resolveOpsPassengerPrice, updateOpsPricingSettings } from "@/lib/ops-pricing";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function canManage(request:Request){const s=opsSessionFromRequest(request);return s&&(s.role==="owner"||s.role==="manager"||s.role==="accountant")?s:null}

export async function GET(request:Request){
  const s=opsSessionFromRequest(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  const url=new URL(request.url);const companyName=url.searchParams.get("company")||"";
  if(url.searchParams.get("action")==="resolve")return Response.json({pricing:await resolveOpsPassengerPrice({companyName})},{headers:{"Cache-Control":"no-store"}});
  if(!canManage(request))return Response.json({message:"صلاحية الإدارة مطلوبة"},{status:403});
  return Response.json({settings:await getOpsPricingSettings()},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:Request){
  if(!canManage(request))return Response.json({message:"صلاحية الإدارة مطلوبة"},{status:403});
  try{
    const body=await request.json() as Record<string,unknown>;
    const allowed=["cash","electronic","credit","complimentary","prepaid","voucher"];
    const payment=String(body.defaultPaymentType||"cash");
    if(!allowed.includes(payment))return Response.json({message:"طريقة الحساب غير صحيحة"},{status:400});
    const settings=await updateOpsPricingSettings({defaultPriceIqd:Number(body.defaultPriceIqd||0),defaultPaymentType:payment,allowManualOverride:body.allowManualOverride!==false,requireOverrideReason:body.requireOverrideReason!==false});
    return Response.json({settings});
  }catch(error){return Response.json({message:error instanceof Error?error.message:"تعذر حفظ إعدادات التسعير"},{status:400})}
}
