import { z } from "zod";

export const bookingSchema = z.object({
  tripType: z.enum(["departure", "arrival"]),
  transport: z.enum(["self", "chauffeur"]),
  side: z.enum(["karkh", "rusafa"]),
  name: z.string().trim().min(3).max(100),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{8,15}$/),
  flightNumber: z.string().trim().min(2).max(20),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passengers: z.number().int().min(1).max(20),
  bags: z.number().int().min(0).max(40),
  address: z.string().trim().max(250),
  landmark: z.string().trim().max(200),
  notes: z.string().trim().max(1000),
  payment: z.enum(["cash", "wayl"]),
}).superRefine((data,ctx)=>{
  if(data.transport === "chauffeur" && data.address.length < 5) ctx.addIssue({ code:"custom", path:["address"], message:"العنوان مطلوب عند اختيار السيارة" });
});

export type BookingInput = z.infer<typeof bookingSchema>;

export function totals(booking: BookingInput) {
  const lounge = booking.passengers * 40000;
  const car = booking.transport === "chauffeur" ? 75000 : 0;
  return { lounge, car, total: lounge + car };
}

export function bookingReference() {
  const date = new Date();
  const stamp = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const random = crypto.randomUUID().replaceAll("-","").slice(0,4).toUpperCase();
  return `LB-${stamp}-${random}`;
}
