import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type OpsRole = "owner" | "manager" | "reception" | "supervisor" | "accountant";
export type OpsShiftName = "الصباحي" | "المسائي" | "الليلي";
export type OpsPaymentType = "cash" | "electronic" | "credit" | "complimentary" | "prepaid" | "voucher";
export type OpsLoungeName = "لاونج بغداد" | "عراق لاونج";
export type OpsPassengerStatus = "inside" | "called" | "departed";

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
    lounge_name TEXT NOT NULL DEFAULT 'لاونج بغداد',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`ALTER TABLE ops_employees ADD COLUMN IF NOT EXISTS lounge_name TEXT NOT NULL DEFAULT 'لاونج بغداد'`;
  await db`CREATE INDEX IF NOT EXISTS ops_employees_active_idx ON ops_employees(active,assigned_shift)`;
  await db`CREATE INDEX IF NOT EXISTS ops_employees_lounge_idx ON ops_employees(lounge_name,active,assigned_shift)`;

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
    lounge_name TEXT NOT NULL DEFAULT 'لاونج بغداد',
    entry_source TEXT NOT NULL DEFAULT 'scan',
    notes TEXT NOT NULL DEFAULT '',
    sheet_sync_status TEXT NOT NULL DEFAULT 'pending',
    sheet_sync_error TEXT NOT NULL DEFAULT '',
    sheet_synced_at TIMESTAMPTZ,
    departure_at TIMESTAMPTZ,
    lounge_status TEXT NOT NULL DEFAULT 'inside',
    gate_called_at TIMESTAMPTZ,
    gate_departed_at TIMESTAMPTZ,
    status_updated_by BIGINT REFERENCES ops_employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS lounge_name TEXT NOT NULL DEFAULT 'لاونج بغداد'`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_sync_status TEXT NOT NULL DEFAULT 'pending'`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_sync_error TEXT NOT NULL DEFAULT ''`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS departure_at TIMESTAMPTZ`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS lounge_status TEXT NOT NULL DEFAULT 'inside'`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS gate_called_at TIMESTAMPTZ`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS gate_departed_at TIMESTAMPTZ`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS status_updated_by BIGINT REFERENCES ops_employees(id)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_created_idx ON ops_entries(created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_airline_idx ON ops_entries(airline,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_company_idx ON ops_entries(billing_company,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_shift_idx ON ops_entries(shift_id,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_lounge_idx ON ops_entries(lounge_name,created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_sync_idx ON ops_entries(sheet_sync_status,created_at ASC)`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_gate_idx ON ops_entries(lounge_name,lounge_status,departure_at)`;

  await db`CREATE TABLE IF NOT EXISTS ops_audit_log(
    id BIGSERIAL PRIMARY KEY,
    actor_employee_id BIGINT REFERENCES ops_employees(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL DEFAULT '',
    before_data JSONB,
    after_data JSONB,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS ops_audit_created_idx ON ops_audit_log(created_at DESC)`;
}

const normalizeEmployee = (row: any) => ({
  id: Number(row.id), name: String(row.name), username: String(row.username), role: row.role as OpsRole,
  assignedShift: row.assigned_shift as OpsShiftName, loungeName: String(row.lounge_name || 'لاونج بغداد') as OpsLoungeName,
  permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
  active: Boolean(row.active), createdAt: String(row.created_at)
});

export async function listOpsEmployees() {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT id::int,name,username,role,assigned_shift,lounge_name,permissions,active,created_at FROM ops_employees ORDER BY active DESC,created_at ASC`;
  return rows.map(normalizeEmployee);
}

export async function createOpsEmployee(input: { name: string; username: string; password: string; role: OpsRole; assignedShift: OpsShiftName; permissions?: string[] }) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`INSERT INTO ops_employees(name,username,password_hash,role,assigned_shift,permissions)
    VALUES(${input.name.trim()},${input.username.trim().toLowerCase()},${hashPassword(input.password)},${input.role},${input.assignedShift},${input.permissions || []})
    RETURNING id::int,name,username,role,assigned_shift,lounge_name,permissions,active,created_at`;
  return normalizeEmployee(rows[0]);
}

export async function updateOpsEmployee(input: { id: number; active?: boolean; role?: OpsRole; assignedShift?: OpsShiftName; permissions?: string[]; password?: string }) {
  await ensureOpsTables(); const db = sql();
  const beforeRows = await db`SELECT id::int,name,username,role,assigned_shift,lounge_name,permissions,active FROM ops_employees WHERE id=${input.id}`;
  if (input.active !== undefined) await db`UPDATE ops_employees SET active=${input.active},updated_at=NOW() WHERE id=${input.id}`;
  if (input.role !== undefined) await db`UPDATE ops_employees SET role=${input.role},updated_at=NOW() WHERE id=${input.id}`;
  if (input.assignedShift !== undefined) await db`UPDATE ops_employees SET assigned_shift=${input.assignedShift},updated_at=NOW() WHERE id=${input.id}`;
  if (input.permissions !== undefined) await db`UPDATE ops_employees SET permissions=${input.permissions},updated_at=NOW() WHERE id=${input.id}`;
  if (input.password) await db`UPDATE ops_employees SET password_hash=${hashPassword(input.password)},updated_at=NOW() WHERE id=${input.id}`;
  const rows = await db`SELECT id::int,name,username,role,assigned_shift,lounge_name,permissions,active,created_at FROM ops_employees WHERE id=${input.id}`;
  if (beforeRows[0] && rows[0]) await writeOpsAudit(input.id, 'employee_update', 'employee', String(input.id), beforeRows[0], rows[0]);
  return rows[0] ? normalizeEmployee(rows[0]) : undefined;
}

export async function authenticateOpsEmployee(username: string, password: string) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT id::int,name,username,password_hash,role,assigned_shift,lounge_name,permissions,active,created_at FROM ops_employees WHERE LOWER(username)=LOWER(${username.trim()}) LIMIT 1`;
  const row = rows[0] as any;
  if (!row || !row.active || !verifyPassword(password, String(row.password_hash))) return null;
  return normalizeEmployee(row);
}

export async function openOpsShift(employeeId: number, shiftName: OpsShiftName, openingCashIqd = 0) {
  await ensureOpsTables(); const db = sql();
  const employeeRows = await db`SELECT lounge_name FROM ops_employees WHERE id=${employeeId} AND active=TRUE`;
  const loungeName = String((employeeRows[0] as any)?.lounge_name || 'لاونج بغداد');
  const existing = await db`SELECT s.id::int,u.name,s.shift_name FROM ops_shifts s JOIN ops_employees u ON u.id=s.employee_id WHERE s.status='open' AND u.lounge_name=${loungeName} AND s.shift_name=${shiftName} LIMIT 1`;
  if (existing[0]) throw new Error(`هذا الشفت مفتوح مسبقاً في ${loungeName} بواسطة ${(existing[0] as any).name}`);
  const rows = await db`INSERT INTO ops_shifts(employee_id,shift_name,opening_cash_iqd) VALUES(${employeeId},${shiftName},${Math.max(0,Math.round(openingCashIqd))}) RETURNING id::int,employee_id::int,shift_name,status,opened_at,opening_cash_iqd`;
  await writeOpsAudit(employeeId, 'shift_open', 'shift', String((rows[0] as any).id), null, rows[0]);
  return rows[0];
}

export async function getShiftSummary(shiftId: number) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT COUNT(*)::int passengers,
    COALESCE(SUM(amount_iqd),0)::bigint total_iqd,
    COALESCE(SUM(amount_iqd) FILTER(WHERE payment_type='cash'),0)::bigint cash_iqd,
    COALESCE(SUM(amount_iqd) FILTER(WHERE payment_type='electronic'),0)::bigint electronic_iqd,
    COALESCE(SUM(amount_iqd) FILTER(WHERE payment_type='credit'),0)::bigint credit_iqd,
    COUNT(*) FILTER(WHERE payment_type='complimentary')::int complimentary,
    COUNT(*) FILTER(WHERE payment_type='prepaid')::int prepaid,
    COUNT(*) FILTER(WHERE payment_type='voucher')::int voucher
    FROM ops_entries WHERE shift_id=${shiftId}`;
  return rows[0] || {};
}

export async function closeOpsShift(employeeId: number, note = '', closingCashIqd?: number) {
  await ensureOpsTables(); const db = sql();
  const openRows = await db`SELECT id::int,opening_cash_iqd FROM ops_shifts WHERE employee_id=${employeeId} AND status='open' ORDER BY opened_at DESC LIMIT 1`;
  if (!openRows[0]) throw new Error('ماكو شفت مفتوح لهذا الموظف');
  const shiftId = Number((openRows[0] as any).id);
  const summary: any = await getShiftSummary(shiftId);
  const expectedCash = Number((openRows[0] as any).opening_cash_iqd || 0) + Number(summary.cash_iqd || 0);
  const actualClosing = closingCashIqd == null ? expectedCash : Math.max(0,Math.round(closingCashIqd));
  const rows = await db`UPDATE ops_shifts SET status='closed',closed_at=NOW(),handover_note=${note},closing_cash_iqd=${actualClosing}
    WHERE id=${shiftId}
    RETURNING id::int,employee_id::int,shift_name,status,opened_at,closed_at,handover_note,opening_cash_iqd,closing_cash_iqd`;
  const result = { ...(rows[0] as any), summary: { ...summary, expectedCashIqd: expectedCash, closingCashIqd: actualClosing, cashDifferenceIqd: actualClosing - expectedCash } };
  await writeOpsAudit(employeeId, 'shift_close', 'shift', String(shiftId), null, result);
  return result;
}

export async function getOpenOpsShift(employeeId: number) {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT s.id::int,s.employee_id::int,s.shift_name,s.status,s.opened_at,s.opening_cash_iqd,u.lounge_name
    FROM ops_shifts s JOIN ops_employees u ON u.id=s.employee_id
    WHERE s.employee_id=${employeeId} AND s.status='open' ORDER BY s.opened_at DESC LIMIT 1`;
  return rows[0] || null;
}

export async function findPossibleDuplicateEntry(input: { boardingRaw?: string; passengerName?: string; flightNumber?: string; loungeName?: string }) {
  await ensureOpsTables(); const db = sql();
  const raw = String(input.boardingRaw || '').trim();
  if (raw) {
    const rows = await db`SELECT id::int,reference,passenger_name,flight_number,lounge_name,created_at FROM ops_entries WHERE boarding_raw=${raw} AND created_at>NOW()-INTERVAL '18 hours' ORDER BY created_at DESC LIMIT 1`;
    if (rows[0]) return rows[0];
  }
  const passenger = String(input.passengerName || '').trim().toLowerCase();
  const flight = String(input.flightNumber || '').trim().toLowerCase();
  if (passenger && flight) {
    const rows = await db`SELECT id::int,reference,passenger_name,flight_number,lounge_name,created_at FROM ops_entries WHERE LOWER(passenger_name)=${passenger} AND LOWER(flight_number)=${flight} AND created_at>NOW()-INTERVAL '8 hours' ORDER BY created_at DESC LIMIT 1`;
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function createOpsEntry(input: { passengerName: string; airline?: string; flightNumber?: string; origin?: string; destination?: string; seat?: string; travelClass?: string; boardingRaw?: string; paymentType: OpsPaymentType; billingCompany?: string; amountIqd?: number; employeeId: number; shiftId: number; loungeName?: OpsLoungeName; entrySource?: 'scan'|'manual'|'ticket_image'; notes?: string; departureAt?: string }) {
  await ensureOpsTables(); const db = sql();
  const employeeRows = await db`SELECT lounge_name FROM ops_employees WHERE id=${input.employeeId}`;
  const loungeName = String(input.loungeName || (employeeRows[0] as any)?.lounge_name || 'لاونج بغداد');
  const reference = `BL-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const rows = await db`INSERT INTO ops_entries(reference,passenger_name,airline,flight_number,origin,destination,seat,travel_class,boarding_raw,payment_type,billing_company,amount_iqd,employee_id,shift_id,lounge_name,entry_source,notes,sheet_sync_status,departure_at,lounge_status)
    VALUES(${reference},${input.passengerName.trim()},${input.airline||''},${input.flightNumber||''},${input.origin||''},${input.destination||''},${input.seat||''},${input.travelClass||''},${input.boardingRaw||''},${input.paymentType},${input.billingCompany||''},${Math.max(0,Math.round(input.amountIqd||0))},${input.employeeId},${input.shiftId},${loungeName},${input.entrySource||'scan'},${input.notes||''},'pending',${input.departureAt || null},'inside')
    RETURNING id::int,reference,passenger_name,airline,flight_number,origin,destination,seat,payment_type,billing_company,amount_iqd,lounge_name,entry_source,notes,sheet_sync_status,departure_at,lounge_status,created_at`;
  await writeOpsAudit(input.employeeId, 'entry_create', 'entry', String((rows[0] as any).id), null, rows[0]);
  return rows[0];
}

export async function listCurrentLoungePassengers(employeeId: number) {
  await ensureOpsTables(); const db = sql();
  const employeeRows = await db`SELECT lounge_name FROM ops_employees WHERE id=${employeeId} AND active=TRUE LIMIT 1`;
  if (!employeeRows[0]) return [];
  const loungeName = String((employeeRows[0] as any).lounge_name || 'لاونج بغداد');
  return db`SELECT e.id::int,e.reference,e.passenger_name,e.airline,e.flight_number,e.destination,e.seat,
    e.departure_at,e.lounge_status,e.gate_called_at,e.gate_departed_at,e.created_at,e.lounge_name,
    creator.name employee_name,updater.name status_updated_by_name
    FROM ops_entries e
    JOIN ops_employees creator ON creator.id=e.employee_id
    LEFT JOIN ops_employees updater ON updater.id=e.status_updated_by
    WHERE e.lounge_name=${loungeName}
      AND e.created_at>=NOW()-INTERVAL '24 hours'
      AND (e.lounge_status<>'departed' OR e.gate_departed_at>=NOW()-INTERVAL '2 hours')
    ORDER BY CASE e.lounge_status WHEN 'inside' THEN 0 WHEN 'called' THEN 1 ELSE 2 END,
      e.departure_at ASC NULLS LAST,e.created_at DESC
    LIMIT 200`;
}

export async function updateOpsPassengerStatus(input: { id: number; employeeId: number; status: OpsPassengerStatus }) {
  await ensureOpsTables(); const db = sql();
  const beforeRows = await db`SELECT e.id::int,e.reference,e.passenger_name,e.lounge_name,e.lounge_status,e.departure_at,e.gate_called_at,e.gate_departed_at
    FROM ops_entries e JOIN ops_employees u ON u.lounge_name=e.lounge_name
    WHERE e.id=${input.id} AND u.id=${input.employeeId} AND u.active=TRUE LIMIT 1`;
  if (!beforeRows[0]) return null;
  const rows = await db`UPDATE ops_entries SET
      lounge_status=${input.status},
      gate_called_at=CASE WHEN ${input.status}='inside' THEN NULL WHEN ${input.status}='called' THEN NOW() ELSE COALESCE(gate_called_at,NOW()) END,
      gate_departed_at=CASE WHEN ${input.status}='departed' THEN NOW() ELSE NULL END,
      status_updated_by=${input.employeeId},updated_at=NOW()
    WHERE id=${input.id}
    RETURNING id::int,reference,passenger_name,airline,flight_number,destination,seat,departure_at,lounge_status,gate_called_at,gate_departed_at,created_at,lounge_name`;
  if (rows[0]) await writeOpsAudit(input.employeeId, 'passenger_status_update', 'entry', String(input.id), beforeRows[0], rows[0]);
  return rows[0] || null;
}

export async function markEntrySync(entryId: number, status: 'pending'|'synced'|'failed', error = '') {
  await ensureOpsTables(); const db = sql();
  const rows = await db`UPDATE ops_entries SET sheet_sync_status=${status},sheet_sync_error=${error},sheet_synced_at=${status === 'synced' ? new Date().toISOString() : null},updated_at=NOW() WHERE id=${entryId} RETURNING id::int,reference,sheet_sync_status,sheet_sync_error,sheet_synced_at`;
  return rows[0] || null;
}

export async function getOpsSyncStatus() {
  await ensureOpsTables(); const db = sql();
  const rows = await db`SELECT COUNT(*) FILTER(WHERE sheet_sync_status='pending')::int pending,
    COUNT(*) FILTER(WHERE sheet_sync_status='failed')::int failed,
    COUNT(*) FILTER(WHERE sheet_sync_status='synced')::int synced,
    MAX(sheet_synced_at) last_synced_at FROM ops_entries`;
  return rows[0] || { pending:0,failed:0,synced:0,last_synced_at:null };
}

export async function listPendingOpsEntries(limit = 100) {
  await ensureOpsTables(); const db = sql();
  return db`SELECT e.id::int,e.reference,e.created_at,e.lounge_name,s.shift_name,u.name employee_name,e.passenger_name,e.airline,e.flight_number,e.origin,e.destination,e.seat,e.payment_type,e.billing_company,e.amount_iqd,e.entry_source,e.notes,e.boarding_raw,e.sheet_sync_status,e.sheet_sync_error
    FROM ops_entries e JOIN ops_employees u ON u.id=e.employee_id JOIN ops_shifts s ON s.id=e.shift_id
    WHERE e.sheet_sync_status IN ('pending','failed') ORDER BY e.created_at ASC LIMIT ${Math.max(1,Math.min(500,limit))}`;
}

export async function searchOpsEntries(query: string) {
  await ensureOpsTables(); const db = sql();
  const q = `%${query.trim()}%`;
  return db`SELECT e.id::int,e.reference,e.passenger_name,e.airline,e.flight_number,e.origin,e.destination,e.seat,e.payment_type,e.billing_company,e.amount_iqd,e.lounge_name,e.entry_source,e.sheet_sync_status,e.created_at,u.name employee_name,s.shift_name
    FROM ops_entries e JOIN ops_employees u ON u.id=e.employee_id JOIN ops_shifts s ON s.id=e.shift_id
    WHERE e.reference ILIKE ${q} OR e.passenger_name ILIKE ${q} OR e.flight_number ILIKE ${q} OR e.airline ILIKE ${q} OR e.billing_company ILIKE ${q}
    ORDER BY e.created_at DESC LIMIT 100`;
}

export async function writeOpsAudit(actorEmployeeId: number | null, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown, note = '') {
  const db = sql();
  await db`INSERT INTO ops_audit_log(actor_employee_id,action,entity_type,entity_id,before_data,after_data,note) VALUES(${actorEmployeeId},${action},${entityType},${entityId},${beforeData == null ? null : JSON.stringify(beforeData)}::jsonb,${afterData == null ? null : JSON.stringify(afterData)}::jsonb,${note})`;
}

export async function listOpsAudit(limit = 100) {
  await ensureOpsTables(); const db = sql();
  return db`SELECT a.id::int,a.action,a.entity_type,a.entity_id,a.before_data,a.after_data,a.note,a.created_at,u.name actor_name FROM ops_audit_log a LEFT JOIN ops_employees u ON u.id=a.actor_employee_id ORDER BY a.created_at DESC LIMIT ${Math.max(1,Math.min(500,limit))}`;
}

export async function opsDashboard() {
  await ensureOpsTables(); const db = sql();
  const [summary, activity, shifts, sync] = await Promise.all([
    db`SELECT COUNT(*)::int passengers,
      COUNT(*) FILTER(WHERE payment_type='cash')::int cash,
      COUNT(*) FILTER(WHERE payment_type='electronic')::int electronic,
      COUNT(*) FILTER(WHERE payment_type='credit')::int credit,
      COUNT(*) FILTER(WHERE payment_type='complimentary')::int complimentary,
      COALESCE(SUM(amount_iqd),0)::bigint total_iqd,
      COALESCE(SUM(amount_iqd) FILTER(WHERE payment_type='cash'),0)::bigint cash_iqd
      FROM ops_entries WHERE created_at>=CURRENT_DATE`,
    db`SELECT e.id::int,e.reference,e.passenger_name,e.airline,e.flight_number,e.payment_type,e.billing_company,e.amount_iqd,e.lounge_name,e.sheet_sync_status,e.created_at,
      u.name employee_name,s.shift_name FROM ops_entries e JOIN ops_employees u ON u.id=e.employee_id JOIN ops_shifts s ON s.id=e.shift_id ORDER BY e.created_at DESC LIMIT 100`,
    db`SELECT s.id::int,s.shift_name,s.status,s.opened_at,s.closed_at,u.name employee_name,u.username,u.lounge_name FROM ops_shifts s JOIN ops_employees u ON u.id=s.employee_id ORDER BY s.opened_at DESC LIMIT 50`,
    getOpsSyncStatus()
  ]);
  const employees = await db`SELECT COUNT(*) FILTER(WHERE active)::int active FROM ops_employees`;
  return { summary: { ...(summary[0] || {}), activeEmployees: Number((employees[0] as any)?.active || 0) }, activity, shifts, sync };
}
