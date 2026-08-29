import { createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";
import { authenticateAdminUser } from "@/lib/admin-users-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username || "";
    const password = body.password || "";
    if (verifyAdminCredentials(username, password)) {
      return Response.json({ token: createAdminSession({role:"owner",name:"Administrator",username:"admin",legacy:true}), user:{name:"Administrator",username:"admin",role:"owner"} }, { headers: { "Cache-Control": "no-store" } });
    }
    const user=await authenticateAdminUser(username,password);
    if(!user)return Response.json({ message: "بيانات الدخول غير صحيحة أو الحساب موقوف" }, { status: 401 });
    return Response.json({token:createAdminSession({role:user.role,userId:user.id,name:user.name,username:user.username}),user:{id:user.id,name:user.name,username:user.username,role:user.role}}, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
