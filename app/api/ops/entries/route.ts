import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import {
  createOpsEntry,
  findPossibleDuplicateEntry,
  getOpenOpsShift,
  listCurrentLoungePassengers,
  updateOpsPassengerFlight,
  updateOpsPassengerStatus,
  voidOpsPassengerEntry,
  type OpsPassengerStatus,
  type OpsPaymentType,
} from "@/lib/lounge-ops-db";
import { parseIataBcbp } from "@/lib/boarding-pass";
import { syncOpsEntryToGoogleSheet } from "@/lib/ops-sheet-sync";
import {
  applyPricingSnapshot,
  getCompanyCreditState,
  resolveOpsPassengerPrice,
  validateManualOverride,
} from "@/lib/ops-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payments: OpsPaymentType[] = ["cash", "electronic", "credit", "complimentary", "prepaid", "voucher"];
const passengerStatuses: OpsPassengerStatus[] = ["inside", "called", "departed"];

function parseBaghdadDeparture(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("وقت الإقلاع مطلوب حتى يشتغل تنبيه البوابة");
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(raw);
  const departure = new Date(local ? `${local[1]}T${local[2]}:00+03:00` : raw);
  if (Number.isNaN(departure.getTime())) throw new Error("وقت الإقلاع غير صحيح");
  const minutesAway = (departure.getTime() - Date.now()) / 60000;
  if (minutesAway < -30) throw new Error("وقت الإقلاع مضى؛ راجع التاريخ والوقت");
  if (minutesAway > 7 * 24 * 60) throw new Error("وقت الإقلاع بعيد أكثر من 7 أيام؛ راجع التاريخ");
  return departure.toISOString();
}

export async function GET(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const passengers = await listCurrentLoungePassengers(session.employeeId);
    return Response.json({ passengers, gateAlertMinutes: 15, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ops passengers GET", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تحميل مسافري الصالة" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ message: "رقم المسافر غير صحيح" }, { status: 400 });
    const action = String(body.action || "status");
    if (action === "update_flight") {
      const departureAt = parseBaghdadDeparture(body.departureAt);
      const passenger = await updateOpsPassengerFlight({
        id,
        employeeId: session.employeeId,
        departureAt,
        gateNumber: String(body.gateNumber || "").trim().slice(0, 20),
        reason: String(body.reason || "").trim(),
      });
      if (!passenger) return Response.json({ message: "المسافر غير موجود في صالتك" }, { status: 404 });
      return Response.json({ passenger });
    }
    if (action === "void") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 3) return Response.json({ message: "سبب إلغاء الإدخال مطلوب" }, { status: 400 });
      const passenger = await voidOpsPassengerEntry({ id, employeeId: session.employeeId, reason });
      if (!passenger) return Response.json({ message: "المسافر غير موجود في صالتك أو تم إلغاؤه مسبقاً" }, { status: 404 });
      return Response.json({ passenger });
    }
    const status = String(body.status || "") as OpsPassengerStatus;
    if (!passengerStatuses.includes(status)) return Response.json({ message: "حالة المسافر غير صحيحة" }, { status: 400 });
    const passenger = await updateOpsPassengerStatus({ id, employeeId: session.employeeId, status });
    if (!passenger) return Response.json({ message: "المسافر غير موجود في صالتك" }, { status: 404 });
    return Response.json({ passenger });
  } catch (error) {
    console.error("ops passenger status PATCH", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تحديث حالة المسافر" }, { status: 400 });
  }
}

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
    const airline = String(body.airline || parsed?.carrier || "").trim();
    const billingCompany = String(body.billingCompany || "").trim();
    const departureAt = parseBaghdadDeparture(body.departureAt);

    if (!passengerName) return Response.json({ message: "اسم المسافر مطلوب أو امسح Boarding Pass صالح" }, { status: 400 });
    if (!body.overrideDuplicate) {
      const duplicate = await findPossibleDuplicateEntry({ boardingRaw, passengerName, flightNumber });
      if (duplicate) {
        return Response.json({
          message: `تنبيه: هذا المسافر مسجل مسبقاً برقم ${(duplicate as any).reference}. إذا متأكد من الدخول مرة ثانية أكد التجاوز.`,
          duplicate,
          requiresDuplicateOverride: true,
        }, { status: 409 });
      }
    }

    const pricing = await resolveOpsPassengerPrice({
      companyName: billingCompany,
      loungeName: String(shift.lounge_name || body.loungeName || ""),
      shiftName: String(shift.shift_name || session.assignedShift || ""),
      category: String(body.passengerCategory || ""),
      airline,
      specialCode: String(body.specialCode || ""),
      age: body.passengerAge === undefined ? undefined : Number(body.passengerAge),
    });
    const requestedAmount = Number(body.amountIqd);
    const notes = String(body.notes || "").trim();
    const override = validateManualOverride(
      pricing,
      String(session.role || ""),
      Number.isFinite(requestedAmount) ? requestedAmount : Number(pricing.priceIqd || 0),
      notes,
    );
    const amountIqd = override.amount;
    let paymentType = String(pricing.paymentType || body.paymentType || "cash") as OpsPaymentType;
    if (pricing.source === "default" && payments.includes(String(body.paymentType || "") as OpsPaymentType)) {
      paymentType = String(body.paymentType) as OpsPaymentType;
    }
    if (!payments.includes(paymentType)) return Response.json({ message: "طريقة الحساب غير صحيحة" }, { status: 400 });
    if (paymentType === "credit" && !billingCompany) return Response.json({ message: "حدد الشركة التي سيحسب عليها المسافر" }, { status: 400 });
    if (paymentType === "credit" && billingCompany) {
      const credit: any = await getCompanyCreditState(billingCompany);
      if (credit && Number(credit.credit_limit_iqd || 0) > 0) {
        const projected = Number(credit.outstanding_iqd || 0) + amountIqd;
        if (projected > Number(credit.credit_limit_iqd || 0) && credit.block_over_credit) {
          return Response.json({
            message: `تم إيقاف الحساب الآجل للشركة لتجاوز السقف الائتماني ${Number(credit.credit_limit_iqd).toLocaleString("en-US")} د.ع`,
            creditLimitExceeded: true,
          }, { status: 409 });
        }
      }
    }

    const entry: any = await createOpsEntry({
      passengerName,
      airline,
      flightNumber,
      origin: String(body.origin || parsed?.origin || ""),
      destination: String(body.destination || parsed?.destination || ""),
      seat: String(body.seat || parsed?.seat || ""),
      travelClass: String(body.travelClass || parsed?.compartment || ""),
      boardingRaw,
      paymentType,
      billingCompany,
      amountIqd,
      employeeId: session.employeeId,
      shiftId: Number(shift.id),
      departureAt,
      gateNumber: String(body.gateNumber || "").trim().slice(0, 20),
      entrySource: body.entrySource === "manual" || body.entrySource === "ticket_image" ? body.entrySource : "scan",
      notes: `${notes}${override.overridden ? ` [تعديل سعر: المعتمد ${Number(pricing.priceIqd).toLocaleString("en-US")}]` : ""}${override.warning ? " [تنبيه سعر غير اعتيادي]" : ""}${body.overrideDuplicate ? " [تم تجاوز تنبيه التكرار]" : ""}`.trim(),
    });
    await applyPricingSnapshot(Number(entry.id), pricing, amountIqd);
    const sync = await syncOpsEntryToGoogleSheet(Number(entry.id));
    return Response.json({ entry, parsed, pricing, priceWarning: override.warning, sheetSync: sync.status }, { status: 201 });
  } catch (error) {
    console.error("ops entries", error);
    return Response.json({ message: error instanceof Error ? error.message : "تعذر تسجيل المسافر" }, { status: 400 });
  }
}
