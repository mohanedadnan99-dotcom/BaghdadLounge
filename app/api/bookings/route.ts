import { bookingReference, bookingSchema, totals } from "@/lib/booking";
import { createWaylPayment, notifyTelegram, saveBooking } from "@/lib/integrations";
import { findValidPromoCode, recordPromoUse } from "@/lib/promo-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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

    await saveBooking(reference, booking, pricing);
    const paymentUrl = booking.payment === "wayl" ? await createWaylPayment(reference, booking, pricing.total) : undefined;
    await notifyTelegram(reference, booking, pricing);
    if (promo) await recordPromoUse(promo.id);

    return Response.json({ reference, paymentUrl, pricing }, { status: 201 });
  } catch (error) {
    console.error("Booking creation failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "حدث خطأ أثناء الحجز، حاول مرة أخرى" }, { status: 500 });
  }
}
