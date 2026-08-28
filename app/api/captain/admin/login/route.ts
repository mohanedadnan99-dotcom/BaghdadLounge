import { createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username || "";
    const password = body.password || "";
    if (!verifyAdminCredentials(username, password)) {
      return Response.json({ message: "بيانات دخول الأدمن غير صحيحة" }, { status: 401 });
    }
    return Response.json({ token: createAdminSession() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
