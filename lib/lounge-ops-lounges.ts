import { neon } from "@neondatabase/serverless";

export type OpsLoungeName = "لاونج بغداد" | "عراق لاونج";
export const OPS_LOUNGES: OpsLoungeName[] = ["لاونج بغداد", "عراق لاونج"];

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function sql() { return neon(connectionString()); }

export async function ensureOpsLoungeSupport() {
  const db = sql();
  await db`ALTER TABLE ops_employees ADD COLUMN IF NOT EXISTS lounge_name TEXT NOT NULL DEFAULT 'لاونج بغداد'`;
  await db`CREATE INDEX IF NOT EXISTS ops_employees_lounge_idx ON ops_employees(lounge_name,active,assigned_shift)`;
}

export async function setOpsEmployeeLounge(employeeId: number, loungeName: OpsLoungeName) {
  await ensureOpsLoungeSupport();
  const db = sql();
  await db`UPDATE ops_employees SET lounge_name=${loungeName},updated_at=NOW() WHERE id=${employeeId}`;
}

export async function getOpsEmployeeLounges() {
  await ensureOpsLoungeSupport();
  const db = sql();
  const rows = await db`SELECT id::int,lounge_name FROM ops_employees`;
  return new Map(rows.map((row: any) => [Number(row.id), String(row.lounge_name || 'لاونج بغداد') as OpsLoungeName]));
}

export async function loungeDashboardStatus() {
  await ensureOpsLoungeSupport();
  const db = sql();
  const rows = await db`
    SELECT DISTINCT ON (u.lounge_name)
      u.lounge_name,
      u.name employee_name,
      u.username,
      u.role,
      s.shift_name,
      s.opened_at
    FROM ops_shifts s
    JOIN ops_employees u ON u.id=s.employee_id
    WHERE s.status='open' AND u.active=TRUE
    ORDER BY u.lounge_name,s.opened_at DESC
  `;
  const map = new Map<string, any>();
  for (const row of rows) map.set(String((row as any).lounge_name), row);
  return OPS_LOUNGES.map((loungeName) => {
    const row: any = map.get(loungeName);
    return {
      loungeName,
      currentSupervisor: row ? String(row.employee_name) : "لا يوجد شفت مفتوح",
      username: row ? String(row.username) : "",
      role: row ? String(row.role) : "",
      shiftName: row ? String(row.shift_name) : "",
      openedAt: row ? String(row.opened_at) : "",
    };
  });
}
