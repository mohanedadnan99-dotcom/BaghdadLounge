import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type OpsRole = "owner" | "manager" | "reception" | "supervisor" | "accountant";
export type OpsShiftName = "الصباحي" | "المسائي" | "الليلي";
export type OpsPaymentType = "cash" | "electronic" | "credit" | "complimentary" | "prepaid" | "voucher";

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql() { return neon(connectionString()); }
function hashPassword(password: string, salt = randomBytes(16).toString("hex")) { return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
function verifyPassword(password: string, stored: string) {
  try {
    const [salt, hex] = stored.split(":");
    if (!salt || !hex) return false;
    const a = scryptSync(password, salt, 64);
    const b = Buffer.from(hex, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export async function ensureOpsTables() {
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS ops_employees(
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','manager','reception','supervisor','accountant')),
    assigned_shift TEXT NOT NULL CHECK(assigned_shift IN ('الصباحي','المسائي','الليلي')),
    permissions TEXT[] NOT NULL DEFAULT '{}'::text[],
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS ops_employees_active_idx ON ops_employees(active,assigned_shift)`;
  await db`INSERT INTO ops_employees(name,username,password_hash,role,assigned_shift,permissions,active)
    VALUES('مهند عدنان','mohannad','c517e444c34056116a706266f511d2e2:f2dcf5a46f2627bddc7c0707b88573dd408c9bfb72fab39c2190c7ec712bb34b5d6ce872e7939840539a496961019921f5ea1022b453c414a5d1f3aeb7b9f46','owner','الصباحي',ARRAY['dashboard','employees','shifts','scan','reports','accounting','settings'],TRUE)
    ON CONFLICT(username) DO NOTHING`;

  await db`CREATE TABLE IF NOT EXISTS ops_shifts(
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES ops_employees(id),
    shift_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    handover_note TEXT NOT NULL DEFAULT '',
    opening_cash_iqd BIGINT NOT NULL DEFAULT 0,
    closing_cash_iqd BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS ops_one_open_shift_per_employee ON ops_shifts(employee_id) WHERE status='open'`;

  await db`CREATE TABLE IF NOT EXISTS ops_entries(
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    passenger_name TEXT NOT NULL,
    airline TEXT NOT NULL DEFAULT '',
    flight_number TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL DEFAULT '',
    destination TEXT NOT NULL DEFAULT '',
    seat TEXT NOT NULL DEFAULT '',
    travel_class TEXT NOT NULL DEFAULT '',
    boarding_raw TEXT NOT NULL DEFAULT '',
    payment_type TEXT NOT NULL CHECK(payment_type IN ('cash','electronic','credit','complimentary','prepaid','voucher')),
    billing_company TEXT NOT NULL DEFAULT '',
    amount_iqd BIGINT NOT NULL DEFAULT 0,
    employee_id BIGINT NOT NULL REFERENCES ops_employees(id),
    shift_id BIGINT NOT NULL REFERENCES ops_shifts(id),
    entry_source TEXT NOT NULL DEFAULT 'scan' CHECK(entry_source IN ('scan','manual','ticket_image')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_created_idx ON ops_entries(created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_airline_idx ON ops_entries(airline,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_company_idx ON ops_entries(billing_company,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_shift_idx ON ops_entries(shift_id,created_at DESC)`;
}

const normalizeEmployee = (row: any) => ({
  id: Number(row.id), name: String(row.name), username: String(row.username), role: row.role as OpsRole,
  assignedShift: row.assigned_shift as OpsShiftName, permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
  active: Boolean(row.active), createdAt: String(row.created_at)
});

export async function listOpsEmployees() {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT id::int,name,username,role,assigned_shift,permissions,active,created_at FROM ops_employees ORDER BY active DESC,created_at ASC`;
  return rows.map(normalizeEmployee);
}

export async function createOpsEmployee(input: { name: string; username: string; password: string; role: OpsRole; assignedShift: OpsShiftName; permissions?: string[] }) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`INSERT INTO ops_employees(name,username,password_hash,role,assigned_shift,permissions)
    VALUES(${input.name.trim()},${input.username.trim().toLowerCase()},${hashPassword(input.password)},${input.role},${input.assignedShift},${input.permissions || []})
    RETURNING id::int,name,username,role,assigned_shift,permissions,active,created_at`;
  return normalizeEmployee(rows[0]);
}

export async function updateOpsEmployee(input: { id: number; active?: boolean; role?: OpsRole; assignedShift?: OpsShiftName; permissions?: string[]; password?: string }) {
  await ensureOpsTables(); const db = sql();
  if (input.active !== undefined) await db`UPDATE ops_employees SET active=${input.active},updated_at=NOW() WHERE id=${input.id}`;
  if (input.role !== undefined) await db`UPDATE ops_employees SET role=${input.role},updated_at=NOW() WHERE id=${input.id}`;
  if (input.assignedShift !== undefined) await db`UPDATE ops_employees SET assigned_shift=${input.assignedShift},updated_at=NOW() WHERE id=${input.id}`;
  if (input.permissions !== undefined) await db`UPDATE ops_employees SET permissions=${input.permissions},updated_at=NOW() WHERE id=${input.id}`;
  if (input.password) await db`UPDATE ops_employees SET password_hash=${hashPassword(input.password)},updated_at=NOW() WHERE id=${input.id}`;
  const rows = await db`SELECT id::int,name,username,role,assigned_shift,permissions,active,created_at FROM ops_employees WHERE id=${input.id}`;
  return rows[0] ? normalizeEmployee(rows[0]) : undefined;
}

export async function authenticateOpsEmployee(username: string, password: string) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT id::int,name,username,password_hash,role,assigned_shift,permissions,active,created_at FROM ops_employees WHERE LOWER(username)=LOWER(${username.trim()}) LIMIT 1`;
  const row = rows[0] as any;
  if (!row || !row.active || !verifyPassword(password, String(row.password_hash))) return null;
  return normalizeEmployee(row);
}

export async function openOpsShift(employeeId: number, shiftName: OpsShiftName, openingCashIqd = 0) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`INSERT INTO ops_shifts(employee_id,shift_name,opening_cash_iqd) VALUES(${employeeId},${shiftName},${Math.max(0,Math.round(openingCashIqd))}) RETURNING id::int,employee_id::int,shift_name,status,opened_at,opening_cash_iqd`;
  return rows[0];
}

export async function closeOpsShift(employeeId: number, note = '', closingCashIqd?: number) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`UPDATE ops_shifts SET status='closed',closed_at=NOW(),handover_note=${note},closing_cash_iqd=${closingCashIqd == null ? null : Math.max(0,Math.round(closingCashIqd))}
    WHERE id=(SELECT id FROM ops_shifts WHERE employee_id=${employeeId} AND status='open' ORDER BY opened_at DESC LIMIT 1)
    RETURNING id::int,employee_id::int,shift_name,status,opened_at,closed_at,handover_note,opening_cash_iqd,closing_cash_iqd`;
  if (!rows[0]) throw new Error('ماكو شفت مفتوح لهذا الموظف');
  return rows[0];
}

export async function getOpenOpsShift(employeeId: number) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT id::int,employee_id::int,shift_name,status,opened_at,opening_cash_iqd FROM ops_shifts WHERE employee_id=${employeeId} AND status='open' ORDER BY opened_at DESC LIMIT 1`;
  return rows[0] || null;
}

export async function createOpsEntry(input: { passengerName: string; airline?: string; flightNumber?: string; origin?: string; destination?: string; seat?: string; travelClass?: string; boardingRaw?: string; paymentType: OpsPaymentType; billingCompany?: string; amountIqd?: number; employeeId: number; shiftId: number; entrySource?: 'scan'|'manual'|'ticket_image'; notes?: string }) {
  await ensureOpsTables(); const db = sql();
  const reference = `BL-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const rows = await db`INSERT INTO ops_entries(reference,passenger_name,airline,flight_number,origin,destination,seat,travel_class,boarding_raw,payment_type,billing_company,amount_iqd,employee_id,shift_id,entry_source,notes)
    VALUES(${reference},${input.passengerName.trim()},${input.airline||''},${input.flightNumber||''},${input.origin||''},${input.destination||''},${input.seat||''},${input.travelClass||''},${input.boardingRaw||''},${input.paymentType},${input.billingCompany||''},${Math.max(0,Math.round(input.amountIqd||0))},${input.employeeId},${input.shiftId},${input.entrySource||'scan'},${input.notes||''}) RETURNING id::int,reference,created_at`;
  return rows[0];
}

export async function opsDashboard() {
  await ensureOpsTables(); const db = sql();
  const [summary, activity, shifts] = await Promise.all([
    db`SELECT COUNT(*)::int passengers,
      COUNT(*) FILTER(WHERE payment_type='cash')::int cash,
      COUNT(*) FILTER(WHERE payment_type='electronic')::int electronic,
      COUNT(*) FILTER(WHERE payment_type='credit')::int credit,
      COUNT(*) FILTER(WHERE payment_type='complimentary')::int complimentary,
      COALESCE(SUM(amount_iqd) FILTER(WHERE payment_type='cash'),0)::bigint cash_iqd
      FROM ops_entries WHERE created_at>=CURRENT_DATE`,
    db`SELECT e.id::int,e.reference,e.passenger_name,e.airline,e.flight_number,e.payment_type,e.billing_company,e.amount_iqd,e.created_at,
      u.name employee_name,s.shift_name FROM ops_entries e JOIN ops_employees u ON u.id=e.employee_id JOIN ops_shifts s ON s.id=e.shift_id ORDER BY e.created_at DESC LIMIT 100`,
    db`SELECT s.id::int,s.shift_name,s.status,s.opened_at,s.closed_at,u.name employee_name,u.username FROM ops_shifts s JOIN ops_employees u ON u.id=s.employee_id ORDER BY s.opened_at DESC LIMIT 50`
  ]);
  const employees = await db`SELECT COUNT(*) FILTER(WHERE active)::int active FROM ops_employees`;
  return { summary: { ...(summary[0] || {}), activeEmployees: Number((employees[0] as any)?.active || 0) }, activity, shifts };
}
