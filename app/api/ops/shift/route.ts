import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import {
  acceptOpsShiftHandover,
  closeOpsShift,
  getOpenOpsShift,
  getShiftHandoverContext,
  openOpsShift,
} from "@/lib/lounge-ops-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const [shift, context] = await Promise.all([
      getOpenOpsShift(session.employeeId),
      getShiftHandoverContext(session.employeeId),
    ]);
    return Response.json({ shift, ...context }, { headers: { "Cache-Control": "no-store" } });
  }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل الشفت" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as { openingCashIqd?: number };
    const shift = await openOpsShift(session.employeeId, session.assignedShift, Number(body.openingCashIqd || 0));
    const context = await getShiftHandoverContext(session.employeeId);
    return Response.json({ shift, ...context }, { status: 201 });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "تعذر فتح الشفت" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; note?: string; closingCashIqd?: number; incomingEmployeeId?: number; handoverId?: number };
    if (body.action === "accept_handover") {
      const handoverId = Number(body.handoverId);
      if (!Number.isInteger(handoverId) || handoverId <= 0) return Response.json({ message: "رقم التسليم غير صحيح" }, { status: 400 });
      const handover = await acceptOpsShiftHandover(session.employeeId, handoverId);
      const context = await getShiftHandoverContext(session.employeeId);
      return Response.json({ handover, ...context });
    }
    const incomingEmployeeId = body.incomingEmployeeId == null ? undefined : Number(body.incomingEmployeeId);
    if (incomingEmployeeId !== undefined && (!Number.isInteger(incomingEmployeeId) || incomingEmployeeId <= 0)) {
      return Response.json({ message: "مسؤول الشفت المستلم غير صحيح" }, { status: 400 });
    }
    const closingCashIqd = body.closingCashIqd == null ? undefined : Number(body.closingCashIqd);
    if (closingCashIqd !== undefined && (!Number.isFinite(closingCashIqd) || closingCashIqd < 0)) {
      return Response.json({ message: "مبلغ النقد الفعلي غير صحيح" }, { status: 400 });
    }
    const shift = await closeOpsShift(
      session.employeeId,
      String(body.note || "").trim().slice(0, 1000),
      closingCashIqd,
      incomingEmployeeId,
    );
    return Response.json({ shift });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "تعذر إغلاق الشفت" }, { status: 400 }); }
}
