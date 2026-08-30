import { adminSessionFromRequest } from "@/lib/admin-auth";
import { createAdminUser, deleteAdminUser, listAdminUsers, ROLE_DEFAULT_PERMISSIONS, updateAdminUser, type AdminPermission, type AdminRole } from "@/lib/admin-users-db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const roles:AdminRole[]=["owner","manager","reception","booking","captain_coordinator","lounge_supervisor","accountant","marketing","customer_service","viewer"];
const permissions:AdminPermission[]=["orders","operations","captains","promos","finance","users","settings","reports","activity","companies","lounges"];

function auth(request:Request){
  const session=adminSessionFromRequest(request);
  return session?.role==="owner"?session:null;
}
function validRole(value:unknown):value is AdminRole{return roles.includes(String(value) as AdminRole)}
function cleanPermissions(value:unknown,role:AdminRole){
  if(!Array.isArray(value))return ROLE_DEFAULT_PERMISSIONS[role];
  return value.map(String).filter((x):x is AdminPermission=>permissions.includes(x as AdminPermission));
}

export async function GET(request:Request){
  if(!auth(request))return Response.json({message:"صلاحية المالك فقط"},{status:403});
  try{return Response.json({users:await listAdminUsers(),roles,permissions,defaults:ROLE_DEFAULT_PERMISSIONS},{headers:{"Cache-Control":"no-store"}})}
  catch(e){console.error("users GET",e);return Response.json({message:e instanceof Error?e.message:"تعذر تحميل الموظفين"},{status:500})}
}

export async function POST(request:Request){
  if(!auth(request))return Response.json({message:"صلاحية المالك فقط"},{status:403});
  try{
    const b=await request.json() as Record<string,unknown>;
    const name=String(b.name||"").trim(),username=String(b.username||"").trim(),password=String(b.password||"");
    if(!name||!username||password.length<6)return Response.json({message:"أدخل الاسم واسم المستخدم وكلمة مرور من 6 أحرف على الأقل"},{status:400});
    if(!validRole(b.role))return Response.json({message:"الدور الوظيفي غير صحيح"},{status:400});
    const user=await createAdminUser({name,username,password,phone:String(b.phone||""),role:b.role,permissions:cleanPermissions(b.permissions,b.role)});
    return Response.json({user},{status:201});
  }catch(e:any){console.error("users POST",e);const duplicate=String(e?.message||"").toLowerCase().includes("unique");return Response.json({message:duplicate?"اسم المستخدم مستخدم مسبقاً":e instanceof Error?e.message:"تعذر إنشاء الموظف"},{status:400})}
}

export async function PATCH(request:Request){
  const session=auth(request);if(!session)return Response.json({message:"صلاحية المالك فقط"},{status:403});
  try{
    const b=await request.json() as Record<string,unknown>;const id=Number(b.id);
    if(!Number.isInteger(id)||id<=0)return Response.json({message:"رقم الموظف غير صحيح"},{status:400});
    if(session.userId===id&&b.active===false)return Response.json({message:"لا يمكنك إيقاف حسابك الحالي"},{status:400});
    const role=b.role===undefined?undefined:(validRole(b.role)?b.role:null);if(role===null)return Response.json({message:"الدور الوظيفي غير صحيح"},{status:400});
    const user=await updateAdminUser({id,name:b.name===undefined?undefined:String(b.name),username:b.username===undefined?undefined:String(b.username),phone:b.phone===undefined?undefined:String(b.phone),role:role||undefined,permissions:b.permissions===undefined?undefined:cleanPermissions(b.permissions,role||"viewer"),active:b.active===undefined?undefined:Boolean(b.active),password:b.password?String(b.password):undefined});
    if(!user)return Response.json({message:"الموظف غير موجود"},{status:404});
    return Response.json({user});
  }catch(e:any){console.error("users PATCH",e);const duplicate=String(e?.message||"").toLowerCase().includes("unique");return Response.json({message:duplicate?"اسم المستخدم مستخدم مسبقاً":e instanceof Error?e.message:"تعذر حفظ الموظف"},{status:400})}
}

export async function DELETE(request:Request){
  const session=auth(request);if(!session)return Response.json({message:"صلاحية المالك فقط"},{status:403});
  try{const id=Number(new URL(request.url).searchParams.get("id"));if(!Number.isInteger(id)||id<=0)return Response.json({message:"رقم الموظف غير صحيح"},{status:400});if(session.userId===id)return Response.json({message:"لا يمكنك حذف حسابك الحالي"},{status:400});await deleteAdminUser(id);return Response.json({ok:true})}
  catch(e){console.error("users DELETE",e);return Response.json({message:e instanceof Error?e.message:"تعذر حذف الموظف"},{status:400})}
}
