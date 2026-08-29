import { createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";
import { createAdminDbSession } from "@/lib/admin-security-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request:Request){return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||''}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    if (!verifyAdminCredentials(body.username || "", body.password || "")) {
      return Response.json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    const sessionId=await createAdminDbSession({username:'admin',name:'Administrator',role:'owner',userAgent:request.headers.get('user-agent')||'',ip:clientIp(request)});
    return Response.json({ token: createAdminSession({role:'owner',name:'Administrator',username:'admin',legacy:true,sessionId}),sessionId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
