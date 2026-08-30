import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { createOpsEntry, getOpenOpsShift, type OpsPaymentType } from "@/lib/lounge-ops-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const payments: OpsPaymentType[] = ["cash","electronic","credit","complimentary","prepaid","voucher"];

export async function POST(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const shift: any = await getOpenOpsShift(session.employeeId);
    if (!shift) return Response.json({ message: "افتح الشفت أولاً قبل تسجيل أي مسافر" }, { status: 409 });
    const body = await request.json() as Record<string, unknown>;
    const passengerName = String(body.passengerName || "").trim();
    const paymentType = String(body.paymentType || "cash") as OpsPaymentType;
    if (!passengerName) return Response.json({ message: "اسم المسافر مطلوب" }, { status: 400 });
    if (!payments.includes(paymentType)) return Response.json({ message: "طريقة الحساب غير صحيحة" }, { status: 400 });
    if (paymentType === "credit" && !String(body.billingCompany || "").trim()) return Response.json({ message: "حدد الشركة التي سيحسب عليها المسافر" }, { status: 400 });
    const entry = await createOpsEntry({
      passengerName,
      airline: String(body.airline || ""),
      flightNumber: String(body.flightNumber || ""),
      origin: String(body.origin || ""),
      destination: String(body.destination || ""),
      seat: String(body.seat || ""),
      travelClass: String(body.travelClass || ""),
      boardingRaw: String(body.boardingRaw || ""),
      paymentType,
      billingCompany: String(body.billingCompany || ""),
      amountIqd: Number(body.amountIqd || 0),
      employeeId: session.employeeId,
      shiftId: Number(shift.id),
      entrySource: body.entrySource === "manual" || body.entrySource === "ticket_image" ? body.entrySource : "scan",
      notes: String(body.notes || "")
    });
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("ops entries", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تسجيل المسافر" }, { status: 400 });
  }
}
