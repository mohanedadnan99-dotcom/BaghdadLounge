import { neon } from "@neondatabase/serverless";

export type PromoRecord = {
  id: number;
  company_name: string;
  code: string;
  discount_percent: number;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  created_at: string;
};

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function sql() { return neon(connectionString()); }

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function ensurePromoTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS company_promo_codes (
      id BIGSERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
      starts_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      max_uses INTEGER,
      uses_count INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS company_promo_codes_code_idx ON company_promo_codes(code)`;
}

export async function listPromos() {
  await ensurePromoTable();
  const db = sql();
  const rows = await db`
    SELECT id, company_name, code, discount_percent, starts_at, expires_at, max_uses, uses_count, active, created_at
    FROM company_promo_codes ORDER BY created_at DESC
  `;
  return rows as PromoRecord[];
}

export async function createPromo(input: { companyName:string; code:string; discountPercent:number; startsAt?:string|null; expiresAt?:string|null; maxUses?:number|null }) {
  await ensurePromoTable();
  const db = sql();
  const code = normalizePromoCode(input.code);
  const rows = await db`
    INSERT INTO company_promo_codes (company_name, code, discount_percent, starts_at, expires_at, max_uses, active)
    VALUES (${input.companyName.trim()}, ${code}, ${input.discountPercent}, ${input.startsAt || null}, ${input.expiresAt || null}, ${input.maxUses || null}, TRUE)
    RETURNING id, company_name, code, discount_percent, starts_at, expires_at, max_uses, uses_count, active, created_at
  `;
  return rows[0] as PromoRecord;
}

export async function updatePromo(input: { id:number; companyName:string; code:string; discountPercent:number; startsAt?:string|null; expiresAt?:string|null; maxUses?:number|null; active:boolean }) {
  await ensurePromoTable();
  const db = sql();
  const rows = await db`
    UPDATE company_promo_codes SET
      company_name=${input.companyName.trim()}, code=${normalizePromoCode(input.code)}, discount_percent=${input.discountPercent},
      starts_at=${input.startsAt || null}, expires_at=${input.expiresAt || null}, max_uses=${input.maxUses || null}, active=${input.active}, updated_at=NOW()
    WHERE id=${input.id}
    RETURNING id, company_name, code, discount_percent, starts_at, expires_at, max_uses, uses_count, active, created_at
  `;
  return rows[0] as PromoRecord | undefined;
}

export async function deletePromo(id:number) {
  await ensurePromoTable();
  const db = sql();
  await db`DELETE FROM company_promo_codes WHERE id=${id}`;
}

export async function findValidPromoCode(value:string) {
  const code = normalizePromoCode(value);
  if (!code) return null;
  await ensurePromoTable();
  const db = sql();
  const rows = await db`
    SELECT id, company_name, code, discount_percent, starts_at, expires_at, max_uses, uses_count, active, created_at
    FROM company_promo_codes
    WHERE code=${code}
      AND active=TRUE
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (expires_at IS NULL OR expires_at >= NOW())
      AND (max_uses IS NULL OR uses_count < max_uses)
    LIMIT 1
  `;
  return (rows[0] as PromoRecord | undefined) || null;
}

export async function recordPromoUse(id:number) {
  await ensurePromoTable();
  const db = sql();
  await db`UPDATE company_promo_codes SET uses_count=uses_count+1, updated_at=NOW() WHERE id=${id}`;
}
