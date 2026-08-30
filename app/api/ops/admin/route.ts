import { adminSessionFromRequest } from "@/lib/admin-auth";
import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { createOpsEmployee, getOpsSyncStatus, listOpsAudit, listOpsEmployees, listPendingOpsEntries, opsDashboard, searchOpsEntries, updateOpsEmployee, type OpsRole, type OpsShiftName } from "@/lib/lounge-ops-db";
import { getOpsEmployeeLounges, loungeDashboardStatus, OPS_LOUNGES, setOpsEmployeeLounge, type OpsLoungeName } from "@/lib/lounge-ops-lounges";
import { syncOpsEntryToGoogleSheet } from "@/lib/ops-sheet-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles: OpsRole[] = ["owner","manager","reception","supervisor","accountant"];
const shifts: OpsShiftName[] = ["الصباحي","المسائي","الليلي"];
function owner(request: Request) {
  const ops = opsSessionFromRequest(request);
  if (ops?.role === "owner") return ops;
  const admin = adminSessionFromRequest(request);
  return admin?.role === "owner" ? admin : null;
}

export async function GET(request: Request) {
  if (!owner(request)) return Response.json({ message: "صلاحية المالك فقط" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "dashboard";
    if (action === "employees") {
      const [employees, loungesById] = await Promise.all([listOpsEmployees(), getOpsEmployeeLounges()]);
      return Response.json({ employees: employees.map((employee) => ({ ...employee, loungeName: loungesById.get(employee.id) || employee.loungeName || "لاونج بغداد" })), roles, shifts, lounges: OPS_LOUNGES }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "search") {
      const q = String(url.searchParams.get("q") || "").trim();
      return Response.json({ results: q ? await searchOpsEntries(q) : [] }, { headers: { "Cache-Control":"no-store" } });
    }
    if (action === "audit") return Response.json({ audit: await listOpsAudit(150) }, { headers: { "Cache-Control":"no-store" } });
    if (action === "sync") return Response.json({ sync: await getOpsSyncStatus(), pending: await listPendingOpsEntries(100) }, { headers: { "Cache-Control":"no-store" } });
    const [dashboard, lounges] = await Promise.all([opsDashboard(), loungeDashboardStatus()]);
    return Response.json({ ...dashboard, lounges }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ops admin GET", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل نظام التشغيل" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = owner(request);
  if (!auth) return Response.json({ message: "صلاحية المالك فقط" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "retrySync") {
      const entryId = Number(body.entryId);
      if (!Number.isInteger(entryId) || entryId <= 0) return Response.json({ message:"رقم العملية غير صحيح" }, { status:400 });
      const result = await syncOpsEntryToGoogleSheet(entryId);
      return Response.json({ result });
    }
    if (body.action === "retryAllSync") {
      const pending = await listPendingOpsEntries(100);
      const results = [];
      for (const row of pending as any[]) results.push({ id:Number(row.id), ...(await syncOpsEntryToGoogleSheet(Number(row.id))) });
      return Response.json({ results, sync: await getOpsSyncStatus() });
    }

    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "reception") as OpsRole;
    const assignedShift = String(body.assignedShift || "الصباحي") as OpsShiftName;
    const loungeName = String(body.loungeName || "لاونج بغداد") as OpsLoungeName;
    if (!name || !username || password.length < 6) return Response.json({ message: "أدخل الاسم واليوزر وكلمة مرور من 6 أحرف على الأقل" }, { status: 400 });
    if (!roles.includes(role) || !shifts.includes(assignedShift) || !OPS_LOUNGES.includes(loungeName)) return Response.json({ message: "الصلاحية أو الشفت أو الصالة غير صحيحة" }, { status: 400 });
    const employee = await createOpsEmployee({ name, username, password, role, assignedShift, permissions: Array.isArray(body.permissions) ? body.permissions.map(String) : [] });
    await setOpsEmployeeLounge(employee.id, loungeName);
    return Response.json({ employee: { ...employee, loungeName } }, { status: 201 });
  } catch (error: any) {
    console.error("ops admin POST", error);
    const duplicate = String(error?.message || "").toLowerCase().includes("unique");
    return Response.json({ message: duplicate ? "اسم المستخدم مستخدم مسبقاً" : error instanceof Error ? error.message : "تعذر تنفيذ العملية" }, { status: 400 });
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
    const loungeName = body.loungeName === undefined ? undefined : String(body.loungeName) as OpsLoungeName;
    if (role && !roles.includes(role)) return Response.json({ message: "الصلاحية غير صحيحة" }, { status: 400 });
    if (assignedShift && !shifts.includes(assignedShift)) return Response.json({ message: "الشفت غير صحيح" }, { status: 400 });
    if (loungeName && !OPS_LOUNGES.includes(loungeName)) return Response.json({ message: "الصالة غير صحيحة" }, { status: 400 });
    const employee = await updateOpsEmployee({ id, active: body.active === undefined ? undefined : Boolean(body.active), role, assignedShift, permissions: body.permissions === undefined ? undefined : Array.isArray(body.permissions) ? body.permissions.map(String) : [], password: body.password ? String(body.password) : undefined });
    if (!employee) return Response.json({ message: "الموظف غير موجود" }, { status: 404 });
    if (loungeName) await setOpsEmployeeLounge(id, loungeName);
    return Response.json({ employee: { ...employee, ...(loungeName ? { loungeName } : {}) } });
  } catch (error) {
    console.error("ops admin PATCH", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر حفظ الموظف" }, { status: 400 });
  }
}
