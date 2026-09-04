import { neon } from "@neondatabase/serverless";
import { adminSessionFromRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

export async function POST(request: Request) {
  const session = adminSessionFromRequest(request);
  if (!session || session.role !== "owner") {
    return Response.json({ message: "صلاحية المالك مطلوبة" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { confirm?: string };
  if (body.confirm !== "RESET_HANDOVER_DATA") {
    return Response.json({ message: "تأكيد التصفير غير صحيح" }, { status: 400 });
  }

  const db = neon(connectionString());
  const opsBefore = await db`SELECT COUNT(*)::int AS count FROM ops_entries`;
  const publicBefore = await db`SELECT COUNT(*)::int AS count FROM lounge_bookings`;
  const captainBefore = await db`SELECT COUNT(*)::int AS count FROM captain_lounge_orders`;

  await db`DELETE FROM ops_company_settlements`;
  await db`DELETE FROM ops_shift_handovers`;
  await db`DELETE FROM ops_entries`;
  await db`DELETE FROM ops_audit_log`;
  await db`DELETE FROM ops_shifts`;
  await db`DELETE FROM captain_lounge_orders`;
  await db`DELETE FROM lounge_bookings`;
  await db`UPDATE company_promo_codes SET uses_count=0`;

  return Response.json({
    ok: true,
    removed: {
      opsEntries: Number((opsBefore[0] as any)?.count || 0),
      publicBookings: Number((publicBefore[0] as any)?.count || 0),
      captainOrders: Number((captainBefore[0] as any)?.count || 0)
    },
    preserved: ["employees", "admin accounts", "captain accounts", "companies", "airlines", "pricing", "settings"]
  });
}
