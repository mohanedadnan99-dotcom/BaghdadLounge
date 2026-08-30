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

  const [openShiftRows, metricsRows, employeeRows] = await Promise.all([
    db`
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
    `,
    db`
      SELECT
        u.lounge_name,
        COUNT(e.id)::int passengers,
        COUNT(e.id) FILTER(WHERE e.payment_type='cash')::int cash,
        COUNT(e.id) FILTER(WHERE e.payment_type='electronic')::int electronic,
        COUNT(e.id) FILTER(WHERE e.payment_type='credit')::int credit,
        COUNT(e.id) FILTER(WHERE e.payment_type='complimentary')::int complimentary,
        COALESCE(SUM(e.amount_iqd),0)::bigint total_iqd,
        COALESCE(SUM(e.amount_iqd) FILTER(WHERE e.payment_type='cash'),0)::bigint cash_iqd
      FROM ops_employees u
      LEFT JOIN ops_entries e ON e.employee_id=u.id AND e.created_at>=CURRENT_DATE
      GROUP BY u.lounge_name
    `,
    db`
      SELECT lounge_name,COUNT(*) FILTER(WHERE active)::int active_employees
      FROM ops_employees
      GROUP BY lounge_name
    `,
  ]);

  const shiftMap = new Map<string, any>();
  const metricsMap = new Map<string, any>();
  const employeeMap = new Map<string, any>();
  for (const row of openShiftRows) shiftMap.set(String((row as any).lounge_name), row);
  for (const row of metricsRows) metricsMap.set(String((row as any).lounge_name), row);
  for (const row of employeeRows) employeeMap.set(String((row as any).lounge_name), row);

  return OPS_LOUNGES.map((loungeName) => {
    const shift: any = shiftMap.get(loungeName);
    const metrics: any = metricsMap.get(loungeName) || {};
    const staff: any = employeeMap.get(loungeName) || {};
    return {
      loungeName,
      currentSupervisor: shift ? String(shift.employee_name) : "لا يوجد شفت مفتوح",
      username: shift ? String(shift.username) : "",
      role: shift ? String(shift.role) : "",
      shiftName: shift ? String(shift.shift_name) : "",
      openedAt: shift ? String(shift.opened_at) : "",
      passengers: Number(metrics.passengers || 0),
      cash: Number(metrics.cash || 0),
      electronic: Number(metrics.electronic || 0),
      credit: Number(metrics.credit || 0),
      complimentary: Number(metrics.complimentary || 0),
      totalIqd: String(metrics.total_iqd || 0),
      cashIqd: String(metrics.cash_iqd || 0),
      activeEmployees: Number(staff.active_employees || 0),
    };
  });
}
