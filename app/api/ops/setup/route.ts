import { createOpsEmployee, listOpsEmployees, updateOpsEmployee } from "@/lib/lounge-ops-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ message: "الإعداد غير متاح على النسخة الرئيسية" }, { status: 403 });
  }
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (username.length < 3 || password.length < 6) {
      return Response.json({ message: "اليوزر 3 أحرف على الأقل والباسورد 6 أحرف على الأقل" }, { status: 400 });
    }
    const employees = await listOpsEmployees();
    const existing = employees.find((employee) => employee.username.toLowerCase() === username);
    if (existing) {
      await updateOpsEmployee({ id: existing.id, active: true, role: "owner", assignedShift: "الصباحي", permissions: ["dashboard","employees","shifts","scan","reports","accounting","settings"], password });
    } else {
      await createOpsEmployee({ name: "مالك النظام", username, password, role: "owner", assignedShift: "الصباحي", permissions: ["dashboard","employees","shifts","scan","reports","accounting","settings"] });
    }
    return Response.json({ ok: true, username }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ops setup", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر إعداد الحساب" }, { status: 500 });
  }
}
