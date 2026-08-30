import { createHmac, timingSafeEqual } from "node:crypto";
import type { OpsRole, OpsShiftName } from "./lounge-ops-db";

export const OPS_SESSION_COOKIE = "baghdad_ops_session";
export type OpsSession = { employeeId:number; name:string; username:string; role:OpsRole; assignedShift:OpsShiftName; permissions:string[]; exp:number };

function secret() {
  const value = process.env.CAPTAIN_SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("Ops session secret is not configured");
  return value;
}
export function createOpsSession(input: Omit<OpsSession,"exp">) {
  const data: OpsSession = { ...input, exp: Date.now() + 12 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function readOpsSession(token: string): OpsSession | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    const a = Buffer.from(signature), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a,b)) return null;
    const data = JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as OpsSession;
    if (!data.employeeId || data.exp <= Date.now()) return null;
    return data;
  } catch { return null; }
}
function cookieToken(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key,...rest] = part.trim().split("=");
    if (key === OPS_SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return "";
}
export function opsSessionFromRequest(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : cookieToken(request);
  return readOpsSession(token);
}
export function opsSessionCookie(token: string) { return `${OPS_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${12*60*60}`; }
export function clearOpsSessionCookie() { return `${OPS_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`; }
