import { createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";
import { authenticateAdminUser } from "@/lib/admin-users-db";
import { createAdminDbSession } from "@/lib/admin-security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request:Request){return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||''}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username || "";
    const password = body.password || "";
    const userAgent=request.headers.get('user-agent')||'';
    const ip=clientIp(request);
    if (verifyAdminCredentials(username, password)) {
      const sessionId=await createAdminDbSession({username:'admin',name:'Administrator',role:'owner',userAgent,ip});
      return Response.json({ token: createAdminSession({role:"owner",name:"Administrator",username:"admin",legacy:true,sessionId}), user:{name:"Administrator",username:"admin",role:"owner"},sessionId }, { headers: { "Cache-Control": "no-store" } });
    }
    const user=await authenticateAdminUser(username,password);
    if(!user)return Response.json({ message: "بيانات الدخول غير صحيحة أو الحساب موقوف" }, { status: 401 });
    const sessionId=await createAdminDbSession({userId:user.id,username:user.username,name:user.name,role:user.role,userAgent,ip});
    return Response.json({token:createAdminSession({role:user.role,userId:user.id,name:user.name,username:user.username,sessionId}),user:{id:user.id,name:user.name,username:user.username,role:user.role},sessionId}, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
