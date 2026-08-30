import { adminSessionFromRequest } from "@/lib/admin-auth";
import { createOpsEmployee, listOpsEmployees, opsDashboard, updateOpsEmployee, type OpsRole, type OpsShiftName } from "@/lib/lounge-ops-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles: OpsRole[] = ["owner","manager","reception","supervisor","accountant"];
const shifts: OpsShiftName[] = ["الصباحي","المسائي","الليلي"];
function owner(request: Request) { const s = adminSessionFromRequest(request); return s?.role === "owner" ? s : null; }

export async function GET(request: Request) {
  if (!owner(request)) return Response.json({ message: "صلاحية المالك فقط" }, { status: 403 });
  try {
    const action = new URL(request.url).searchParams.get("action") || "dashboard";
    if (action === "employees") return Response.json({ employees: await listOpsEmployees(), roles, shifts }, { headers: { "Cache-Control": "no-store" } });
    return Response.json(await opsDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ops admin GET", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل نظام التشغيل" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!owner(request)) return Response.json({ message: "صلاحية المالك فقط" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "reception") as OpsRole;
    const assignedShift = String(body.assignedShift || "الصباحي") as OpsShiftName;
    if (!name || !username || password.length < 6) return Response.json({ message: "أدخل الاسم واليوزر وكلمة مرور من 6 أحرف على الأقل" }, { status: 400 });
    if (!roles.includes(role) || !shifts.includes(assignedShift)) return Response.json({ message: "الصلاحية أو الشفت غير صحيح" }, { status: 400 });
    const employee = await createOpsEmployee({ name, username, password, role, assignedShift, permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [] });
    return Response.json({ employee }, { status: 201 });
  } catch (error: any) {
    console.error("ops admin POST", error);
    const duplicate = String(error?.message || "").toLowerCase().includes("unique");
    return Response.json({ message: duplicate ? "اسم المستخدم مستخدم مسبقاً" : error instanceof Error ? error.message : "تعذر إضافة الموظف" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!owner(request)) return Response.json({ message: "صلاحية المالك فقط" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ message: "رقم الموظف غير صحيح" }, { status: 400 });
    const role = body.role === undefined ? undefined : String(body.role) as OpsRole;
    const assignedShift = body.assignedShift === undefined ? undefined : String(body.assignedShift) as OpsShiftName;
    if (role && !roles.includes(role)) return Response.json({ message: "الصلاحية غير صحيحة" }, { status: 400 });
    if (assignedShift && !shifts.includes(assignedShift)) return Response.json({ message: "الشفت غير صحيح" }, { status: 400 });
    const employee = await updateOpsEmployee({ id, active: body.active === undefined ? undefined : Boolean(body.active), role, assignedShift, permissions: body.permissions === undefined ? undefined : Array.isArray(body.permissions) ? body.permissions.map(String) : [], password: body.password ? String(body.password) : undefined });
    if (!employee) return Response.json({ message: "الموظف غير موجود" }, { status: 404 });
    return Response.json({ employee });
  } catch (error) {
    console.error("ops admin PATCH", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر حفظ الموظف" }, { status: 400 });
  }
}
