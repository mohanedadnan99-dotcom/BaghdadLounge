import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { createOpsEntry, findPossibleDuplicateEntry, getOpenOpsShift, type OpsPaymentType } from "@/lib/lounge-ops-db";
import { parseIataBcbp } from "@/lib/boarding-pass";
import { syncOpsEntryToGoogleSheet } from "@/lib/ops-sheet-sync";

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
    const boardingRaw = String(body.boardingRaw || "");
    const parsed = boardingRaw ? parseIataBcbp(boardingRaw) : null;
    const passengerName = String(body.passengerName || parsed?.passengerName || "").trim();
    const flightNumber = String(body.flightNumber || parsed?.flightNumber || "").trim();
    const paymentType = String(body.paymentType || "cash") as OpsPaymentType;
    if (!passengerName) return Response.json({ message: "اسم المسافر مطلوب أو امسح Boarding Pass صالح" }, { status: 400 });
    if (!payments.includes(paymentType)) return Response.json({ message: "طريقة الحساب غير صحيحة" }, { status: 400 });
    if (paymentType === "credit" && !String(body.billingCompany || "").trim()) return Response.json({ message: "حدد الشركة التي سيحسب عليها المسافر" }, { status: 400 });

    if (!body.overrideDuplicate) {
      const duplicate = await findPossibleDuplicateEntry({ boardingRaw, passengerName, flightNumber });
      if (duplicate) return Response.json({
        message: `تنبيه: هذا المسافر مسجل مسبقاً برقم ${(duplicate as any).reference}. إذا متأكد من الدخول مرة ثانية أكد التجاوز.`,
        duplicate,
        requiresDuplicateOverride: true,
      }, { status: 409 });
    }

    const requestedAmount = Number(body.amountIqd);
    const amountIqd = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : 40000;
    const entry = await createOpsEntry({
      passengerName,
      airline: String(body.airline || parsed?.carrier || ""),
      flightNumber,
      origin: String(body.origin || parsed?.origin || ""),
      destination: String(body.destination || parsed?.destination || ""),
      seat: String(body.seat || parsed?.seat || ""),
      travelClass: String(body.travelClass || parsed?.compartment || ""),
      boardingRaw,
      paymentType,
      billingCompany: String(body.billingCompany || ""),
      amountIqd,
      employeeId: session.employeeId,
      shiftId: Number(shift.id),
      entrySource: body.entrySource === "manual" || body.entrySource === "ticket_image" ? body.entrySource : "scan",
      notes: `${String(body.notes || "")}${body.overrideDuplicate ? " [تم تجاوز تنبيه التكرار]" : ""}`.trim()
    });
    const sync = await syncOpsEntryToGoogleSheet(Number((entry as any).id));
    return Response.json({ entry, parsed, sheetSync: sync.status }, { status: 201 });
  } catch (error) {
    console.error("ops entries", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تسجيل المسافر" }, { status: 400 });
  }
}
