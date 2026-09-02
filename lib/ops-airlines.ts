import { neon } from "@neondatabase/serverless";
import { BAGHDAD_AIRLINES, normalizeAirlineCode } from "./airlines";
import { OPS_LOUNGES, type OpsLoungeName } from "./lounge-ops-lounges";

export type AirlineDiscountType = "none" | "amount" | "percent";
export type AirlinePaymentType = "cash" | "electronic" | "credit" | "complimentary" | "prepaid" | "voucher";

export type AirlineLoungePriceInput = {
  loungeName: OpsLoungeName;
  basePriceIqd: number;
  discountType?: AirlineDiscountType;
  discountValue?: number;
  discountFrom?: string | null;
  discountTo?: string | null;
  paymentType?: AirlinePaymentType;
  active?: boolean;
};

export type AirlineProfileInput = {
  code: string;
  nameAr: string;
  nameEn: string;
  active?: boolean;
  notes?: string;
  prices: AirlineLoungePriceInput[];
};

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function sql() { return neon(connectionString()); }

let ensurePromise: Promise<void> | null = null;

async function createAirlineTables() {
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS ops_airlines(
    code TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS ops_airline_prices(
    airline_code TEXT NOT NULL REFERENCES ops_airlines(code) ON DELETE CASCADE,
    lounge_name TEXT NOT NULL,
    base_price_iqd BIGINT NOT NULL DEFAULT 40000,
    discount_type TEXT NOT NULL DEFAULT 'none' CHECK(discount_type IN ('none','amount','percent')),
    discount_value BIGINT NOT NULL DEFAULT 0,
    discount_from TIMESTAMPTZ,
    discount_to TIMESTAMPTZ,
    payment_type TEXT NOT NULL DEFAULT 'cash' CHECK(payment_type IN ('cash','electronic','credit','complimentary','prepaid','voucher')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(airline_code,lounge_name)
  )`;
  await db`CREATE INDEX IF NOT EXISTS ops_airline_prices_lookup_idx
    ON ops_airline_prices(airline_code,lounge_name,active)`;
  await db`CREATE TABLE IF NOT EXISTS ops_airline_price_history(
    id BIGSERIAL PRIMARY KEY,
    airline_code TEXT NOT NULL,
    lounge_name TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    changed_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS ops_airline_price_history_idx
    ON ops_airline_price_history(airline_code,created_at DESC)`;

  const seed = BAGHDAD_AIRLINES.map((airline) => ({
    code: airline.code,
    name_ar: airline.ar,
    name_en: airline.en,
  }));
  await db`INSERT INTO ops_airlines(code,name_ar,name_en)
    SELECT x.code,x.name_ar,x.name_en
    FROM jsonb_to_recordset(${JSON.stringify(seed)}::jsonb) AS x(code TEXT,name_ar TEXT,name_en TEXT)
    ON CONFLICT(code) DO NOTHING`;
  await db`INSERT INTO ops_airline_prices(airline_code,lounge_name,base_price_iqd)
    SELECT a.code,l.lounge_name,40000
    FROM ops_airlines a
    CROSS JOIN (VALUES ('لاونج بغداد'),('عراق لاونج')) AS l(lounge_name)
    ON CONFLICT(airline_code,lounge_name) DO NOTHING`;
}

export function ensureOpsAirlines() {
  if (!ensurePromise) {
    ensurePromise = createAirlineTables().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function discountIsActive(row: any, now = Date.now()) {
  if (String(row.discount_type || "none") === "none" || Number(row.discount_value || 0) <= 0) return false;
  const from = row.discount_from ? new Date(row.discount_from).getTime() : null;
  const to = row.discount_to ? new Date(row.discount_to).getTime() : null;
  return (!from || from <= now) && (!to || to >= now);
}

export function calculateAirlineFinalPrice(row: any, now = Date.now()) {
  const base = Math.max(0, Number(row.base_price_iqd || 0));
  if (!row.active || !discountIsActive(row, now)) return base;
  const value = Math.max(0, Number(row.discount_value || 0));
  if (row.discount_type === "amount") return Math.max(0, base - value);
  if (row.discount_type === "percent") return Math.max(0, Math.round(base * (100 - Math.min(100, value)) / 100));
  return base;
}

function normalizePrice(row: any) {
  return {
    loungeName: String(row.lounge_name) as OpsLoungeName,
    basePriceIqd: Number(row.base_price_iqd || 0),
    discountType: String(row.discount_type || "none") as AirlineDiscountType,
    discountValue: Number(row.discount_value || 0),
    discountFrom: row.discount_from ? String(row.discount_from) : null,
    discountTo: row.discount_to ? String(row.discount_to) : null,
    paymentType: String(row.payment_type || "cash") as AirlinePaymentType,
    active: Boolean(row.price_active ?? row.active),
    discountActive: discountIsActive(row),
    finalPriceIqd: calculateAirlineFinalPrice({ ...row, active: row.price_active ?? row.active }),
    updatedAt: String(row.price_updated_at || row.updated_at || ""),
  };
}

function groupProfiles(rows: any[]) {
  const profiles = new Map<string, any>();
  for (const row of rows) {
    const code = String(row.code);
    if (!profiles.has(code)) {
      profiles.set(code, {
        code,
        nameAr: String(row.name_ar || ""),
        nameEn: String(row.name_en || ""),
        active: Boolean(row.airline_active),
        notes: String(row.notes || ""),
        updatedAt: String(row.airline_updated_at || ""),
        prices: [],
      });
    }
    if (row.lounge_name) profiles.get(code).prices.push(normalizePrice(row));
  }
  return [...profiles.values()];
}

export async function listOpsAirlineProfiles() {
  await ensureOpsAirlines();
  const db = sql();
  const rows = await db`SELECT a.code,a.name_ar,a.name_en,a.active airline_active,a.notes,a.updated_at airline_updated_at,
    p.lounge_name,p.base_price_iqd,p.discount_type,p.discount_value,p.discount_from,p.discount_to,
    p.payment_type,p.active price_active,p.updated_at price_updated_at
    FROM ops_airlines a
    LEFT JOIN ops_airline_prices p ON p.airline_code=a.code
    ORDER BY a.active DESC,a.name_ar,p.lounge_name`;
  return groupProfiles(rows as any[]);
}

export async function getOpsAirlineProfile(value: string) {
  await ensureOpsAirlines();
  const code = normalizeAirlineCode(value) || value.trim().toUpperCase();
  const db = sql();
  const rows = await db`SELECT a.code,a.name_ar,a.name_en,a.active airline_active,a.notes,a.updated_at airline_updated_at,
    p.lounge_name,p.base_price_iqd,p.discount_type,p.discount_value,p.discount_from,p.discount_to,
    p.payment_type,p.active price_active,p.updated_at price_updated_at
    FROM ops_airlines a
    LEFT JOIN ops_airline_prices p ON p.airline_code=a.code
    WHERE a.code=${code}
    ORDER BY p.lounge_name`;
  return groupProfiles(rows as any[])[0] || null;
}

export async function saveOpsAirlineProfile(input: AirlineProfileInput, changedBy: string) {
  await ensureOpsAirlines();
  const db = sql();
  const code = normalizeAirlineCode(input.code) || input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(code)) throw new Error("رمز شركة الطيران يجب أن يكون رمز IATA من حرفين أو ثلاثة");
  if (!input.nameAr.trim() || !input.nameEn.trim()) throw new Error("اسم شركة الطيران بالعربي والإنكليزي مطلوب");

  const queries: any[] = [
    db`INSERT INTO ops_airlines(code,name_ar,name_en,active,notes)
      VALUES(${code},${input.nameAr.trim()},${input.nameEn.trim()},${input.active !== false},${String(input.notes || "").trim()})
      ON CONFLICT(code) DO UPDATE SET name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,
        active=EXCLUDED.active,notes=EXCLUDED.notes,updated_at=NOW()`,
  ];

  for (const price of input.prices || []) {
    if (!OPS_LOUNGES.includes(price.loungeName)) throw new Error("اسم الصالة غير صحيح");
    const discountType: AirlineDiscountType = ["none", "amount", "percent"].includes(String(price.discountType))
      ? price.discountType as AirlineDiscountType
      : "none";
    const paymentType: AirlinePaymentType = ["cash", "electronic", "credit", "complimentary", "prepaid", "voucher"].includes(String(price.paymentType))
      ? price.paymentType as AirlinePaymentType
      : "cash";
    const basePriceIqd = boundedNumber(price.basePriceIqd, 0, 10_000_000);
    const discountValue = discountType === "percent"
      ? boundedNumber(price.discountValue, 0, 100)
      : boundedNumber(price.discountValue, 0, 10_000_000);
    const snapshot = {
      airlineCode: code,
      loungeName: price.loungeName,
      basePriceIqd,
      discountType,
      discountValue,
      discountFrom: price.discountFrom || null,
      discountTo: price.discountTo || null,
      paymentType,
      active: price.active !== false,
    };
    queries.push(db`INSERT INTO ops_airline_prices(airline_code,lounge_name,base_price_iqd,discount_type,discount_value,discount_from,discount_to,payment_type,active)
      VALUES(${code},${price.loungeName},${basePriceIqd},${discountType},${discountValue},${price.discountFrom || null},${price.discountTo || null},${paymentType},${price.active !== false})
      ON CONFLICT(airline_code,lounge_name) DO UPDATE SET base_price_iqd=EXCLUDED.base_price_iqd,
        discount_type=EXCLUDED.discount_type,discount_value=EXCLUDED.discount_value,
        discount_from=EXCLUDED.discount_from,discount_to=EXCLUDED.discount_to,
        payment_type=EXCLUDED.payment_type,active=EXCLUDED.active,updated_at=NOW()`);
    queries.push(db`INSERT INTO ops_airline_price_history(airline_code,lounge_name,snapshot,changed_by)
      VALUES(${code},${price.loungeName},${JSON.stringify(snapshot)}::jsonb,${changedBy})`);
  }
  await db.transaction(queries);
  return getOpsAirlineProfile(code);
}

export async function resolveOpsAirlinePrice(input: { airline: string; flightNumber?: string; loungeName: string }) {
  await ensureOpsAirlines();
  const code = normalizeAirlineCode(input.airline, input.flightNumber);
  if (!code) return null;
  const db = sql();
  const rows = await db`SELECT a.code,a.name_ar,a.name_en,p.lounge_name,p.base_price_iqd,p.discount_type,
    p.discount_value,p.discount_from,p.discount_to,p.payment_type,p.active price_active,p.updated_at price_updated_at
    FROM ops_airlines a
    JOIN ops_airline_prices p ON p.airline_code=a.code
    WHERE a.code=${code} AND a.active=TRUE AND p.active=TRUE AND p.lounge_name=${input.loungeName}
    LIMIT 1`;
  const row: any = rows[0];
  if (!row) return null;
  const price = normalizePrice(row);
  return {
    source: "airline_profile",
    ruleId: null,
    airlineCode: code,
    label: `${String(row.name_ar)} — ${code}`,
    basePriceIqd: price.basePriceIqd,
    discountType: price.discountType,
    discountValue: price.discountValue,
    discountActive: price.discountActive,
    priceIqd: price.finalPriceIqd,
    paymentType: price.paymentType,
    profileUpdatedAt: price.updatedAt,
  };
}

export async function getOpsAirlineOfflineConfig(loungeName: string) {
  await ensureOpsAirlines();
  const db = sql();
  const rows = await db`SELECT a.code,a.name_ar,a.name_en,p.lounge_name,p.base_price_iqd,p.discount_type,
    p.discount_value,p.discount_from,p.discount_to,p.payment_type,p.active price_active,p.updated_at price_updated_at
    FROM ops_airlines a JOIN ops_airline_prices p ON p.airline_code=a.code
    WHERE a.active=TRUE AND p.active=TRUE AND p.lounge_name=${loungeName}
    ORDER BY a.code`;
  return (rows as any[]).map((row) => ({
    code: String(row.code),
    nameAr: String(row.name_ar),
    nameEn: String(row.name_en),
    ...normalizePrice(row),
  }));
}

export async function listOpsAirlinePriceHistory(code: string, limit = 100) {
  await ensureOpsAirlines();
  const db = sql();
  return db`SELECT id::int,airline_code,lounge_name,snapshot,changed_by,created_at
    FROM ops_airline_price_history WHERE airline_code=${code.trim().toUpperCase()}
    ORDER BY id DESC LIMIT ${Math.max(1, Math.min(250, limit))}`;
}
