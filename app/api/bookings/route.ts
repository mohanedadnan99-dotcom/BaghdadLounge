import { bookingReference, bookingSchema, totals } from "@/lib/booking";
import { createWaylPayment, notifyTelegram, saveBooking } from "@/lib/integrations";
import { findValidPromoCode, recordPromoUse } from "@/lib/promo-db";
import { readMaintenanceState } from "@/lib/maintenance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const maintenance = await readMaintenanceState();
    if (maintenance.booking) return Response.json({ error: "الحجز متوقف مؤقتاً من الإدارة. يرجى المحاولة لاحقاً." }, { status: 503 });

    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message;
      return Response.json({ error: firstIssue || "يرجى التأكد من جميع معلومات الحجز" }, { status: 400 });
    }

    const booking = parsed.data;
    const promo = booking.promoCode ? await findValidPromoCode(booking.promoCode) : null;
    if (booking.promoCode && !promo) {
      return Response.json({ error: "رمز الخصم غير صحيح أو غير فعّال" }, { status: 400 });
    }

    const reference = bookingReference();
    const pricing = totals(booking, promo ? {
      code: promo.code,
      companyName: promo.company_name,
      discountPercent: promo.discount_percent,
    } : null);

    // For electronic payments, obtain a valid checkout URL before persisting the booking.
    // This prevents a failed payment-provider call from leaving a saved booking that the customer thinks failed.
    const paymentUrl = booking.payment === "wayl" ? await createWaylPayment(reference, booking, pricing.total) : undefined;
    await saveBooking(reference, booking, pricing);

    // Once the booking is safely stored, secondary notifications must never turn a successful booking into a visible failure.
    const secondary = await Promise.allSettled([
      notifyTelegram(reference, booking, pricing),
      promo ? recordPromoUse(promo.id) : Promise.resolve(),
    ]);
    for (const result of secondary) if (result.status === "rejected") console.error("Booking secondary action failed", reference, result.reason);

    return Response.json({ reference, paymentUrl, pricing }, { status: 201 });
  } catch (error) {
    console.error("Booking creation failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "حدث خطأ أثناء الحجز، حاول مرة أخرى" }, { status: 500 });
  }
}
