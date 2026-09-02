import { adminSessionFromRequest } from "@/lib/admin-auth";
import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { ownerDashboardInsights } from "@/lib/owner-dashboard-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function management(request: Request) {
  const ops = opsSessionFromRequest(request);
  if (ops && (ops.role === "owner" || ops.role === "manager")) return ops;
  const admin = adminSessionFromRequest(request);
  return admin && (admin.role === "owner" || admin.role === "manager") ? admin : null;
}

export async function GET(request: Request) {
  const current = management(request);
  if (!current) return Response.json({ message: "صلاحية المالك أو المدير مطلوبة" }, { status: 403 });
  try {
    const insights = await ownerDashboardInsights();
    return Response.json({
      ...insights,
      session: { name: current.name, role: current.role },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("owner dashboard insights", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل ملخص الإدارة" }, { status: 500 });
  }
}
