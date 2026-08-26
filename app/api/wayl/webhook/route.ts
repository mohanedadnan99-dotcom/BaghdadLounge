import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.WAYL_WEBHOOK_SECRET;
  const signature = request.headers.get("x-wayl-signature") ?? "";
  const raw = await request.text();
  if (!secret) return Response.json({ error: "Webhook not configured" }, { status: 503 });
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const valid = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return Response.json({ error: "Invalid signature" }, { status: 401 });
  const event = JSON.parse(raw) as { reference?: string; status?: string; data?: { reference?: string; status?: string } };
  const reference = event.reference ?? event.data?.reference;
  const status = event.status ?? event.data?.status ?? "unknown";
  if (reference && process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    await sql`UPDATE lounge_bookings SET payment_status = ${status} WHERE reference = ${reference}`;
  }
  return Response.json({ received: true });
}
