import { neon } from "@neondatabase/serverless";
import type { BookingInput } from "./booking";

export async function saveBooking(reference: string, booking: BookingInput, total: number) {
  if (!process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS lounge_bookings (
    id BIGSERIAL PRIMARY KEY, reference TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL,
    phone TEXT NOT NULL, flight_number TEXT NOT NULL, trip_type TEXT NOT NULL,
    transport TEXT NOT NULL, city_side TEXT, address TEXT, landmark TEXT,
    booking_date DATE NOT NULL, booking_time TIME NOT NULL, passengers INTEGER NOT NULL,
    bags INTEGER NOT NULL, notes TEXT, payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending', total_iqd INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`INSERT INTO lounge_bookings
    (reference, customer_name, phone, flight_number, trip_type, transport, city_side, address, landmark, booking_date, booking_time, passengers, bags, notes, payment_method, total_iqd)
    VALUES (${reference}, ${booking.name}, ${booking.phone}, ${booking.flightNumber}, ${booking.tripType}, ${booking.transport}, ${booking.side}, ${booking.address}, ${booking.landmark}, ${booking.date}, ${booking.time}, ${booking.passengers}, ${booking.bags}, ${booking.notes}, ${booking.payment}, ${total})`;
}

export async function notifyTelegram(reference: string, booking: BookingInput, total: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-5382562153";
  if (!token || token === "(توكن)") return;
  const trip = booking.tripType === "departure" ? "مغادرة 🛫" : "استقبال 🛬";
  const transport = booking.transport === "chauffeur" ? `سيارة خاصة 🚙 (${booking.side === "karkh" ? "الكرخ" : "الرصافة"})` : "يصل بنفسه";
  const message = [
    "✨ حجز جديد — لاونج بغداد", "━━━━━━━━━━━━━━", `🔖 رقم الحجز: ${reference}`,
    `✈️ نوع الرحلة: ${trip}`, `👤 الاسم: ${booking.name}`, `📞 الهاتف: ${booking.phone}`,
    `🛩 رقم الرحلة: ${booking.flightNumber}`, `📅 الموعد: ${booking.date} — ${booking.time}`,
    `👥 المسافرون: ${booking.passengers}`, `🧳 الحقائب: ${booking.bags}`, `🚘 الوصول: ${transport}`,
    booking.transport === "chauffeur" ? `📍 العنوان: ${booking.address}${booking.landmark ? ` — ${booking.landmark}` : ""}` : "",
    `💳 الدفع: ${booking.payment === "cash" ? "كاش" : "Wayl إلكتروني"}`,
    `💰 الإجمالي: ${new Intl.NumberFormat("en-US").format(total)} د.ع`, booking.notes ? `📝 ملاحظات: ${booking.notes}` : "",
  ].filter(Boolean).join("\n");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  if (!response.ok) throw new Error("Telegram notification failed");
}

export async function createWaylPayment(reference: string, booking: BookingInput, total: number) {
  const apiKey = process.env.WAYL_API_KEY;
  if (!apiKey || apiKey.startsWith("(")) throw new Error("خدمة الدفع الإلكتروني غير مفعلة حالياً، اختر الدفع كاش أو تواصل معنا");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
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
