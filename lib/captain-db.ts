import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Supports the standard connection variable names used by Vercel + Neon.
export type CaptainRecord = {
  id: number;
  username: string;
  name: string;
  company: string;
  phone: string;
  active: boolean;
  created_at: string;
};

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function sql() {
  return neon(connectionString());
}

export function hashCaptainPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyCaptainPassword(password: string, stored: string) {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function ensureCaptainTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS captain_accounts (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const defaults = [
    { username: "mohaned", name: "مهند", company: "", phone: "07745551999" },
    { username: "ashaq", name: "إسحاق", company: "لاونج بغداد", phone: "" },
    { username: "m", name: "مهند عدنان محمد", company: "تكسي المميز", phone: "07745551999" },
  ];

  for (const item of defaults) {
    const passwordHash = hashCaptainPassword("123456");
    await db`
      INSERT INTO captain_accounts (username, password_hash, name, company, phone, active)
      VALUES (${item.username}, ${passwordHash}, ${item.name}, ${item.company}, ${item.phone}, TRUE)
      ON CONFLICT (username) DO NOTHING
    `;
  }
}

export async function findCaptainByUsername(username: string) {
  await ensureCaptainTable();
  const db = sql();
  const rows = await db`
    SELECT id, username, password_hash, name, company, phone, active
    FROM captain_accounts
    WHERE username = ${username}
    LIMIT 1
  `;
  return rows[0] as (CaptainRecord & { password_hash: string }) | undefined;
}

export async function listCaptains() {
  await ensureCaptainTable();
  const db = sql();
  const rows = await db`
    SELECT id, username, name, company, phone, active, created_at
    FROM captain_accounts
    ORDER BY created_at DESC
  `;
  return rows as CaptainRecord[];
}

export async function createCaptain(input: { username: string; password: string; name: string; company: string; phone: string }) {
  await ensureCaptainTable();
  const db = sql();
  const passwordHash = hashCaptainPassword(input.password);
  const rows = await db`
    INSERT INTO captain_accounts (username, password_hash, name, company, phone, active)
    VALUES (${input.username}, ${passwordHash}, ${input.name}, ${input.company}, ${input.phone}, TRUE)
    RETURNING id, username, name, company, phone, active, created_at
  `;
  return rows[0] as CaptainRecord;
}

export async function updateCaptain(id: number, input: { username: string; password?: string; name: string; company: string; phone: string; active: boolean }) {
  await ensureCaptainTable();
  const db = sql();
  if (input.password) {
    const passwordHash = hashCaptainPassword(input.password);
    const rows = await db`
      UPDATE captain_accounts
      SET username=${input.username}, password_hash=${passwordHash}, name=${input.name}, company=${input.company}, phone=${input.phone}, active=${input.active}, updated_at=NOW()
      WHERE id=${id}
      RETURNING id, username, name, company, phone, active, created_at
    `;
    return rows[0] as CaptainRecord | undefined;
  }
  const rows = await db`
    UPDATE captain_accounts
    SET username=${input.username}, name=${input.name}, company=${input.company}, phone=${input.phone}, active=${input.active}, updated_at=NOW()
    WHERE id=${id}
    RETURNING id, username, name, company, phone, active, created_at
  `;
  return rows[0] as CaptainRecord | undefined;
}

export async function deleteCaptain(id: number) {
  await ensureCaptainTable();
  const db = sql();
  await db`DELETE FROM captain_accounts WHERE id=${id}`;
}
