import { neon } from "@neondatabase/serverless";

export type MaintenanceState = { booking: boolean; captain: boolean };

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

export async function readMaintenanceState(): Promise<MaintenanceState> {
  const db = neon(connectionString());
  try {
    const rows = await db`SELECT key,value FROM admin_settings WHERE key IN ('maintenance_booking','maintenance_captain')`;
    const settings = Object.fromEntries(rows.map((row: any) => [String(row.key), String(row.value)]));
    return {
      booking: settings.maintenance_booking === "1",
      captain: settings.maintenance_captain === "1",
    };
  } catch (error: any) {
    // During first deployment the settings table may not exist yet. Fail open so public traffic is not accidentally locked out.
    if (error?.code === "42P01") return { booking: false, captain: false };
    throw error;
  }
}
