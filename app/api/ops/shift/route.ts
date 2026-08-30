import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { closeOpsShift, getOpenOpsShift, openOpsShift } from "@/lib/lounge-ops-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try { return Response.json({ shift: await getOpenOpsShift(session.employeeId) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل الشفت" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as { openingCashIqd?: number };
    const shift = await openOpsShift(session.employeeId, session.assignedShift, Number(body.openingCashIqd || 0));
    return Response.json({ shift }, { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "تعذر فتح الشفت" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as { note?: string; closingCashIqd?: number };
    const shift = await closeOpsShift(session.employeeId, String(body.note || ""), body.closingCashIqd == null ? undefined : Number(body.closingCashIqd));
    return Response.json({ shift });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "تعذر إغلاق الشفت" }, { status: 400 }); }
}
