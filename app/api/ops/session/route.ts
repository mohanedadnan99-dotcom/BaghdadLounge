import { authenticateOpsEmployee } from "@/lib/lounge-ops-db";
import { clearOpsSessionCookie, createOpsSession, opsSessionCookie, opsSessionFromRequest } from "@/lib/lounge-ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ user: session }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const employee = await authenticateOpsEmployee(body.username || "", body.password || "");
    if (!employee) return Response.json({ message: "بيانات الدخول غير صحيحة أو الحساب موقوف" }, { status: 401 });
    const token = createOpsSession({ employeeId: employee.id, name: employee.name, username: employee.username, role: employee.role, assignedShift: employee.assignedShift, permissions: employee.permissions });
    return Response.json({ user: employee }, { headers: { "Cache-Control": "no-store", "Set-Cookie": opsSessionCookie(token) } });
  } catch (error) {
    console.error("ops login", error);
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearOpsSessionCookie(), "Cache-Control": "no-store" } });
}
