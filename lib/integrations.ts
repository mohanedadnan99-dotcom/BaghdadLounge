import { neon } from "@neondatabase/serverless";
import type { BookingInput, BookingTotals } from "./booking";

function connection(){return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || ""}
let bookingSchemaInit:Promise<void>|null=null;
async function ensureBookingSchema(){
  const value=connection();if(!value)return;
  if(bookingSchemaInit)return bookingSchemaInit;
  bookingSchemaInit=(async()=>{
    const sql=neon(value);
    await sql`CREATE TABLE IF NOT EXISTS lounge_bookings (
      id BIGSERIAL PRIMARY KEY, reference TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL,
      phone TEXT NOT NULL, airline TEXT, flight_number TEXT NOT NULL, trip_type TEXT NOT NULL,
      transport TEXT NOT NULL, city_side TEXT, address TEXT, landmark TEXT,
      booking_date DATE NOT NULL, booking_time TIME NOT NULL, passengers INTEGER NOT NULL,
      bags INTEGER NOT NULL, notes TEXT, payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending', total_iqd INTEGER NOT NULL,
      promo_code TEXT, promo_company TEXT, promo_percent INTEGER NOT NULL DEFAULT 0, discount_iqd INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS airline TEXT`;
    await sql`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS promo_code TEXT`;
    await sql`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS promo_company TEXT`;
    await sql`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS promo_percent INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS discount_iqd INTEGER NOT NULL DEFAULT 0`;
  })();
  try{await bookingSchemaInit}catch(error){bookingSchemaInit=null;throw error}
}

export async function saveBooking(reference: string, booking: BookingInput, pricing: BookingTotals) {
  const value=connection();
  if (!value) throw new Error("قاعدة بيانات الحجوزات غير مفعلة");
  await ensureBookingSchema();
  const sql = neon(value);
  await sql`INSERT INTO lounge_bookings
    (reference, customer_name, phone, airline, flight_number, trip_type, transport, city_side, address, landmark, booking_date, booking_time, passengers, bags, notes, payment_method, promo_code, promo_company, promo_percent, discount_iqd, total_iqd)
    VALUES (${reference}, ${booking.name}, ${booking.phone}, ${booking.airline}, ${booking.flightNumber}, ${booking.tripType}, ${booking.transport}, ${booking.side}, ${booking.address}, ${booking.landmark}, ${booking.date}, ${booking.time}, ${booking.passengers}, ${booking.bags}, ${booking.notes}, ${booking.payment}, ${pricing.promoCode || null}, ${pricing.promoCompany || null}, ${pricing.promoPercent || 0}, ${pricing.discount}, ${pricing.total})`;
}

export async function notifyTelegram(reference: string, booking: BookingInput, pricing: BookingTotals) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-5382562153";
  if (!token || token === "(توكن)") return;

  const trip = booking.tripType === "departure" ? "مغادرة" : "استقبال";
  const side = booking.side === "karkh" ? "الكرخ" : "الرصافة";
  const transport = booking.transport === "chauffeur" ? `نعم — ${side}` : "لا";

  const message = [
    "حجز جديد — لاونج بغداد",
    "━━━━━━━━━━━━━━",
    `رقم الحجز: ${reference}`,
    `نوع الرحلة: ${trip}`,
    `الاسم: ${booking.name}`,
    `رقم الهاتف: ${booking.phone}`,
    `شركة الطيران: ${booking.airline}`,
    `رقم الرحلة: ${booking.flightNumber}`,
    `التاريخ: ${booking.date}`,
    `الوقت: ${booking.time}`,
    `عدد المسافرين: ${booking.passengers}`,
    `عدد الحقائب: ${booking.bags}`,
    `خدمة السيارة: ${transport}`,
    booking.transport === "chauffeur" ? `العنوان: ${booking.address}` : "",
    booking.transport === "chauffeur" && booking.landmark ? `أقرب نقطة دالة: ${booking.landmark}` : "",
    `طريقة الدفع: ${booking.payment === "cash" ? "كاش" : "Wayl إلكتروني"}`,
    booking.notes ? `ملاحظات: ${booking.notes}` : "",
    "━━━━━━━━━━━━━━",
    pricing.promoCode ? `خصم شركة: ${pricing.promoCompany || "—"}` : "",
    pricing.promoCode ? `رمز الخصم: ${pricing.promoCode} — ${pricing.promoPercent}%` : "",
    pricing.discount ? `قيمة الخصم: ${new Intl.NumberFormat("en-US").format(pricing.discount)} د.ع` : "",
    pricing.discount ? `المجموع قبل الخصم: ${new Intl.NumberFormat("en-US").format(pricing.subtotal)} د.ع` : "",
    `الحساب النهائي: ${new Intl.NumberFormat("en-US").format(pricing.total)} د.ع`,
  ].filter(Boolean).join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  if (!response.ok) throw new Error("Telegram notification failed");
}

export async function createWaylPayment(reference: string, booking: BookingInput, total: number) {
  const apiKey = process.env.WAYL_API_KEY;
  if (!apiKey || apiKey.startsWith("(")) throw new Error("خدمة الدفع الإلكتروني غير مفعلة حالياً، اختر الدفع كاش أو تواصل معنا");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://baghdad-lounge.vercel.app";
  const response = await fetch("https://api.thewayl.com/api/v1/links", {
    method: "POST", headers: { "Content-Type": "application/json", "X-WAYL-AUTHENTICATION": apiKey },
    body: JSON.stringify({ title: `Lounge Baghdad - ${reference}`, description: `حجز لاونج بغداد باسم ${booking.name}`,
      amount: total, currency: "IQD", reference, redirect_url: `${baseUrl}/payment-result?reference=${encodeURIComponent(reference)}`,
      customer: { name: booking.name, phone: booking.phone } }),
  });
  if (!response.ok) throw new Error("تعذر إنشاء رابط الدفع من Wayl");
  const data = await response.json() as Record<string, unknown>;
  const url = data.url ?? data.payment_url ?? data.checkout_url ?? (data.data as Record<string,unknown> | undefined)?.url;
  if (typeof url !== "string") throw new Error("لم يرجع Wayl رابط دفع صالح");
  return url;
}
