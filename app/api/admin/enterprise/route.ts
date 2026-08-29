import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser, type AdminRole } from "@/lib/admin-users-db";
import { companyStatement, listAutomationRules, listSystemErrors, recordSystemError, resolveSystemError, runAutomationRules, systemHealth, updateAutomationRule } from "@/lib/admin-enterprise-db";

export const runtime="nodejs";export const dynamic="force-dynamic";
function session(request:Request){return adminSessionFromRequest(request)}
function denied(){return Response.json({message:"غير مصرح لهذا الإجراء"},{status:403})}

export async function GET(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  try{
    const u=new URL(request.url);const action=u.searchParams.get("action")||"overview";
    if(action==="users"){if(!roleCan(s.role,"users"))return denied();return Response.json({users:await listAdminUsers()})}
    if(action==="rules"){if(!roleCan(s.role,"settings"))return denied();return Response.json({rules:await listAutomationRules()})}
    if(action==="errors"){if(!roleCan(s.role,"settings"))return denied();return Response.json({errors:await listSystemErrors()})}
    if(action==="health"){if(!roleCan(s.role,"settings"))return denied();return Response.json({health:await systemHealth()})}
    if(action==="statement"){
      if(!roleCan(s.role,"finance"))return denied();const company=String(u.searchParams.get("company")||"").trim();const from=String(u.searchParams.get("from")||"");const to=String(u.searchParams.get("to")||"");
      if(!company||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return Response.json({message:"حدد الشركة والفترة"},{status:400});
      return Response.json({statement:await companyStatement(company,from,to)});
    }
    const health=roleCan(s.role,"settings")?await systemHealth():null;
    const rules=roleCan(s.role,"settings")?await listAutomationRules():[];
    const users=roleCan(s.role,"users")?await listAdminUsers():[];
    return Response.json({session:{name:s.name||"Administrator",username:s.username||"admin",role:s.role},health,rules,users});
  }catch(error){await recordSystemError("admin-enterprise-get",error);console.error(error);return Response.json({message:"تعذر تحميل مركز الإدارة المتقدم"},{status:500})}
}

export async function POST(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="user"){
      if(!roleCan(s.role,"users"))return denied();
      const role=String(body.role||"") as AdminRole;
      const username=String(body.username||"").trim().toLowerCase();
      const name=String(body.name||"").trim();
      const password=String(body.password||"");
      if(name.length<2)return Response.json({message:"اكتب اسم الموظف"},{status:400});
      if(!username)return Response.json({message:"اكتب اسم المستخدم"},{status:400});
      if(!/^[a-z0-9._-]{1,32}$/.test(username))return Response.json({message:"اسم المستخدم يكون حروف إنكليزية أو أرقام فقط، بدون مسافات"},{status:400});
      if(password.length<6)return Response.json({message:"كلمة المرور لازم تكون 6 خانات على الأقل"},{status:400});
      if(!["owner","manager","reception","accountant"].includes(role))return Response.json({message:"اختر صلاحية الموظف"},{status:400});
      try{return Response.json({user:await createAdminUser({username,password,name,role})},{status:201})}
      catch(error){
        if(error instanceof Error&&/unique|duplicate/i.test(error.message))return Response.json({message:"اسم المستخدم مستخدم مسبقاً، اختار اسم ثاني"},{status:409});
        throw error;
      }
    }
    if(action==="run-rules"){if(!roleCan(s.role,"settings"))return denied();return Response.json(await runAutomationRules())}
    return Response.json({message:"الإجراء غير معروف"},{status:400});
  }catch(error){await recordSystemError("admin-enterprise-post",error);console.error(error);return Response.json({message:"تعذر تنفيذ الإجراء"},{status:500})}
}

export async function PATCH(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;const action=String(body.action||"");
    if(action==="user"){
      if(!roleCan(s.role,"users"))return denied();const id=Number(body.id);if(!Number.isFinite(id))return Response.json({message:"المعرف غير صحيح"},{status:400});
      const role=body.role?String(body.role) as AdminRole:undefined;if(role&&!["owner","manager","reception","accountant"].includes(role))return Response.json({message:"الصلاحية غير صحيحة"},{status:400});
      const username=body.username!==undefined?String(body.username).trim().toLowerCase():undefined;
      if(username!==undefined&&!/^[a-z0-9._-]{1,32}$/.test(username))return Response.json({message:"اسم المستخدم غير صحيح"},{status:400});
      const password=body.password?String(body.password):undefined;
      if(password&&password.length<6)return Response.json({message:"كلمة المرور لازم تكون 6 خانات على الأقل"},{status:400});
      return Response.json({user:await updateAdminUser({id,name:body.name!==undefined?String(body.name):undefined,username,role,active:body.active!==undefined?Boolean(body.active):undefined,password})});
    }
    if(action==="rule"){
      if(!roleCan(s.role,"settings"))return denied();const id=Number(body.id);const thresholdValue=Math.max(1,Math.round(Number(body.thresholdValue)||1));return Response.json({rule:await updateAutomationRule({id,thresholdValue,active:Boolean(body.active)})});
    }
    if(action==="error"){
      if(!roleCan(s.role,"settings"))return denied();return Response.json({error:await resolveSystemError(Number(body.id),Boolean(body.resolved))});
    }
    return Response.json({message:"الإجراء غير معروف"},{status:400});
  }catch(error){await recordSystemError("admin-enterprise-patch",error);console.error(error);return Response.json({message:"تعذر حفظ التغيير"},{status:500})}
}

export async function DELETE(request:Request){
  const s=session(request);if(!s)return Response.json({message:"غير مصرح"},{status:401});if(!roleCan(s.role,"users"))return denied();
  try{const u=new URL(request.url);const id=Number(u.searchParams.get("id"));if(!Number.isFinite(id))return Response.json({message:"المعرف غير صحيح"},{status:400});await deleteAdminUser(id);return Response.json({ok:true})}catch(error){await recordSystemError("admin-enterprise-delete",error);return Response.json({message:"تعذر حذف المستخدم"},{status:500})}
}
