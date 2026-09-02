import { adminSessionFromRequest } from "@/lib/admin-auth";
import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { OPS_LOUNGES, type OpsLoungeName } from "@/lib/lounge-ops-lounges";
import {
  getOpsAirlineOfflineConfig,
  getOpsAirlineProfile,
  listOpsAirlinePriceHistory,
  listOpsAirlineProfiles,
  saveOpsAirlineProfile,
  type AirlineProfileInput,
} from "@/lib/ops-airlines";
import { getOpsPricingSettings } from "@/lib/ops-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function session(request: Request) {
  const ops = opsSessionFromRequest(request);
  if (ops) return { ...ops, source: "ops" as const };
  const admin = adminSessionFromRequest(request);
  return admin ? { ...admin, employeeId: null, source: "admin" as const } : null;
}

function canRead(role: string) {
  return ["owner", "manager", "accountant"].includes(role);
}

function canManage(role: string) {
  return role === "owner" || role === "manager";
}

export async function GET(request: Request) {
  const current = session(request);
  if (!current) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "list";
    if (action === "offline-config") {
      const sessionLounge = "loungeName" in current ? current.loungeName : "";
      const loungeName = String(url.searchParams.get("lounge") || sessionLounge || "") as OpsLoungeName;
      if (!OPS_LOUNGES.includes(loungeName)) return Response.json({ message: "اسم الصالة غير صحيح" }, { status: 400 });
      const [airlines, settings] = await Promise.all([
        getOpsAirlineOfflineConfig(loungeName),
        getOpsPricingSettings(),
      ]);
      return Response.json({
        loungeName,
        airlines,
        defaultPriceIqd: Number((settings as any)?.default_price_iqd || 40000),
        childFreeUnder: Number((settings as any)?.child_free_under || 0),
        version: airlines.reduce((latest, airline) => airline.updatedAt > latest ? airline.updatedAt : latest, ""),
        generatedAt: new Date().toISOString(),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!canRead(String(current.role || ""))) return Response.json({ message: "صلاحية الإدارة مطلوبة" }, { status: 403 });
    const code = String(url.searchParams.get("code") || "").trim();
    if (action === "history" && code) return Response.json({ history: await listOpsAirlinePriceHistory(code) }, { headers: { "Cache-Control": "no-store" } });
    if (code) return Response.json({ airline: await getOpsAirlineProfile(code) }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ airlines: await listOpsAirlineProfiles(), lounges: OPS_LOUNGES }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ops airlines GET", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل شركات الطيران" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const current = session(request);
  if (!current || !canManage(String(current.role || ""))) return Response.json({ message: "صلاحية المالك أو المدير مطلوبة" }, { status: 403 });
  try {
    const body = await request.json() as AirlineProfileInput;
    const airline = await saveOpsAirlineProfile(body, String(current.username || current.name || "الإدارة"));
    return Response.json({ airline });
  } catch (error) {
    console.error("ops airlines PUT", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر حفظ شركة الطيران" }, { status: 400 });
  }
}
