import { z } from "zod";

const fakeNamePattern = /^(test|testing|guest|unknown|name|xxx+|asdf+|qwer+|مجهول|اسم|تجربة|اختبار)$/i;

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function looksLikeRealName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 3 || fakeNamePattern.test(name)) return false;
  if (!/[\p{L}]/u.test(name)) return false;
  if (/^(.)\1{2,}$/u.test(name.replace(/\s/g, ""))) return false;
  return true;
}

function looksLikeRealPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const obviousDummyNumbers = new Set([
    "12345678", "123456789", "1234567890", "0123456789",
    "11111111", "00000000", "99999999",
  ]);
  if (obviousDummyNumbers.has(digits)) return false;
  return true;
}

export const bookingSchema = z.object({
  tripType: z.enum(["departure", "arrival"]),
  transport: z.enum(["self", "chauffeur"]),
  side: z.enum(["karkh", "rusafa"]),
  name: z.string().trim().min(3, "يرجى كتابة الاسم الحقيقي").max(100).refine(looksLikeRealName, "يرجى إدخال الاسم الحقيقي لإتمام الحجز"),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{8,20}$/, "يرجى إدخال رقم هاتف صحيح").refine(looksLikeRealPhone, "رقم الهاتف يبدو غير صحيح، يرجى إدخال رقم يمكن التواصل معك عليه"),
  airline: z.string().trim().min(2, "يرجى اختيار شركة الطيران").max(100),
  flightNumber: z.string().trim().min(2).max(20),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passengers: z.number().int().min(1).max(20),
  bags: z.number().int().min(0).max(40),
  address: z.string().trim().max(250),
  landmark: z.string().trim().max(200),
  notes: z.string().trim().max(1000),
  payment: z.enum(["cash", "wayl"]),
  promoCode: z.string().trim().max(40).default(""),
}).superRefine((data,ctx)=>{
  if(data.transport === "chauffeur" && data.address.length < 5) ctx.addIssue({ code:"custom", path:["address"], message:"العنوان مطلوب عند اختيار السيارة" });
  if(data.promoCode && !/^[A-Za-z0-9_-]{3,30}$/.test(normalizePromoCode(data.promoCode))) ctx.addIssue({ code:"custom", path:["promoCode"], message:"رمز الخصم غير صحيح" });
});

export type BookingInput = z.infer<typeof bookingSchema>;

export type AppliedPromo = {
  code: string;
  companyName: string;
  discountPercent: number;
};

export function totals(booking: BookingInput, promo?: AppliedPromo | null) {
  const lounge = booking.passengers * 40000;
  const car = booking.transport === "chauffeur" ? 75000 : 0;
  const extraBaggage = booking.bags > 4 ? 10000 : 0;
  const subtotal = lounge + car + extraBaggage;
  const promoCode = promo?.code || "";
  const promoCompany = promo?.companyName || "";
  const promoPercent = promo?.discountPercent || 0;
  const discount = promoCode ? Math.round(subtotal * promoPercent / 100) : 0;
  return { lounge, car, extraBaggage, subtotal, discount, total: subtotal - discount, promoCode, promoCompany, promoPercent };
}

export type BookingTotals = ReturnType<typeof totals>;

export function bookingReference() {
  const date = new Date();
  const stamp = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const random = crypto.randomUUID().replaceAll("-","").slice(0,4).toUpperCase();
  return `LB-${stamp}-${random}`;
}
