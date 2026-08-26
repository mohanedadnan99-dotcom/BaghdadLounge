import { bookingReference, bookingSchema, totals } from "@/lib/booking";
import { createWaylPayment, notifyTelegram, saveBooking } from "@/lib/integrations";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message;
      return Response.json({ error: firstIssue || "يرجى التأكد من جميع معلومات الحجز" }, { status: 400 });
    }
    const booking = parsed.data;
    const reference = bookingReference();
    const { total } = totals(booking);
    await saveBooking(reference, booking, total);
    const paymentUrl = booking.payment === "wayl" ? await createWaylPayment(reference, booking, total) : undefined;
    await notifyTelegram(reference, booking, total);
    return Response.json({ reference, paymentUrl }, { status: 201 });
  } catch (error) {
    console.error("Booking creation failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "حدث خطأ أثناء الحجز، حاول مرة أخرى" }, { status: 500 });
  }
}
