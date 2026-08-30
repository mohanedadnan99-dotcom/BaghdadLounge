import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { AdminPermission, AdminRole } from "./admin-users-db";
import { ROLE_DEFAULT_PERMISSIONS } from "./admin-users-db";

const ADMIN_USERNAME = "admin";
const ADMIN_SALT = "baghdad-lounge-admin-v1";
const ADMIN_PASSWORD_HASH = "f5e801be047d934f108e5c26ed8c414a7fc90d000101a744604fbe55991fd3a9d304aaa8ae7bf7a3f0c84c4c3dbd4adfa14aaf1684f6800515a4b7b22e58f69e";
export const ADMIN_SESSION_COOKIE="baghdad_admin_session";

const ADMIN_ROLES:AdminRole[]=["owner","manager","reception","booking","captain_coordinator","lounge_supervisor","accountant","marketing","customer_service","viewer"];
export type AdminSession={role:AdminRole;permissions?:AdminPermission[];exp:number;userId?:number;name?:string;username?:string;legacy?:boolean;sessionId?:string};

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

export function createAdminSession(input?:Partial<AdminSession>) {
  const role=input?.role||"owner";
  const data:AdminSession={role,permissions:input?.permissions?.length?input.permissions:ROLE_DEFAULT_PERMISSIONS[role],exp:Date.now()+8*60*60*1000,userId:input?.userId,name:input?.name,username:input?.username,legacy:input?.legacy,sessionId:input?.sessionId};
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAdminSession(token:string):AdminSession|null{
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession|{role?:string;exp?:number};
    if(typeof data.exp!=="number"||data.exp<=Date.now())return null;
    if((data as any).role==="captain-admin")return {role:"owner",permissions:ROLE_DEFAULT_PERMISSIONS.owner,exp:data.exp,legacy:true};
    if(!ADMIN_ROLES.includes(String(data.role) as AdminRole))return null;
    const role=String(data.role) as AdminRole;
    return {...data,role,permissions:Array.isArray((data as any).permissions)?(data as any).permissions:ROLE_DEFAULT_PERMISSIONS[role]} as AdminSession;
  } catch { return null; }
}

export function verifyAdminSession(token: string) { return Boolean(readAdminSession(token)); }
function cookieToken(request:Request){
  const cookie=request.headers.get("cookie")||"";
  for(const part of cookie.split(";")){
    const [k,...rest]=part.trim().split("=");
    if(k===ADMIN_SESSION_COOKIE)return decodeURIComponent(rest.join("="));
  }
  return "";
}
export function adminTokenFromRequest(request: Request) {
  const value = request.headers.get("authorization") || "";
  if(value.startsWith("Bearer ")&&value.slice(7).trim())return value.slice(7).trim();
  return cookieToken(request);
}
export function adminSessionFromRequest(request:Request){return readAdminSession(adminTokenFromRequest(request))}
export function adminSessionCookie(token:string){return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${8*60*60}`}
export function clearAdminSessionCookie(){return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`}
export function roleCan(role:AdminRole,permission:AdminPermission,customPermissions?:AdminPermission[]){
  if(role==="owner")return true;
  const permissions=customPermissions?.length?customPermissions:ROLE_DEFAULT_PERMISSIONS[role]||[];
  return permissions.includes(permission);
}
export function sessionCan(session:AdminSession|null|undefined,permission:AdminPermission){return Boolean(session&&roleCan(session.role,permission,session.permissions))}
