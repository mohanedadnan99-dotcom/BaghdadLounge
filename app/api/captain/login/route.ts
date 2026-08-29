import { createCaptainSession } from "@/lib/captain-auth";
import { findCaptainByUsername, verifyCaptainPassword } from "@/lib/captain-db";
import { readMaintenanceState } from "@/lib/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const maintenance = await readMaintenanceState();
    if (maintenance.captain) return Response.json({ message: "بوابة الكباتن متوقفة مؤقتاً من الإدارة. يرجى المحاولة لاحقاً." }, { status: 503 });

    const body = await request.json() as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase() || "";
    const password = body.password || "";
    const captain = await findCaptainByUsername(username);

    if (!captain || !captain.active || !verifyCaptainPassword(password, captain.password_hash)) {
      return Response.json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const sessionToken = createCaptainSession({
      username: captain.username,
      name: captain.name,
      company: captain.company,
      phone: captain.phone,
    });

    return Response.json(
      { captain: { name: captain.name, company: captain.company }, sessionToken },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
