import { createHmac, timingSafeEqual } from "node:crypto";

export type CaptainSession = {
  username: string;
  name: string;
  company: string;
  phone: string;
  exp: number;
};

function secret() {
  const value = process.env.CAPTAIN_SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("Captain session secret is not configured");
  return value;
}

export function createCaptainSession(captain: Omit<CaptainSession, "exp">) {
  const payload = Buffer.from(
    JSON.stringify({ ...captain, exp: Date.now() + 12 * 60 * 60 * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCaptainSession(token: string) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) return null;
    const captain = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CaptainSession;
    if (!captain.exp || captain.exp < Date.now()) return null;
    return captain;
  } catch {
    return null;
  }
}
