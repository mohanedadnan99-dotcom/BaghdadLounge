import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

const ADMIN_USERNAME = "admin";
const ADMIN_SALT = "baghdad-lounge-admin-v1";
const ADMIN_PASSWORD_HASH = "f5e801be047d934f108e5c26ed8c414a7fc90d000101a744604fbe55991fd3a9d304aaa8ae7bf7a3f0c84c4c3dbd4adfa14aaf1684f6800515a4b7b22e58f69e";

function secret() {
  const value = process.env.CAPTAIN_SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("Admin session secret is not configured");
  return value;
}

export function verifyAdminCredentials(username: string, password: string) {
  if (username.trim().toLowerCase() !== ADMIN_USERNAME) return false;
  const actual = scryptSync(password, ADMIN_SALT, 64);
  const expected = Buffer.from(ADMIN_PASSWORD_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ role: "captain-admin", exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminSession(token: string) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; exp?: number };
    return data.role === "captain-admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function adminTokenFromRequest(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}
