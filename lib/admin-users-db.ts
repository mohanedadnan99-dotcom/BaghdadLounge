import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AdminRole=
  |"owner"
  |"manager"
  |"reception"
  |"booking"
  |"captain_coordinator"
  |"lounge_supervisor"
  |"accountant"
  |"marketing"
  |"customer_service"
  |"viewer";

export type AdminPermission="orders"|"operations"|"captains"|"promos"|"finance"|"users"|"settings"|"reports"|"activity"|"companies"|"lounges";

export type AdminUser={
  id:number;
  username:string;
  name:string;
  phone:string;
  role:AdminRole;
  permissions:AdminPermission[];
  active:boolean;
  last_login_at:string|null;
  created_at:string;
};

function connectionString(){
  const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;
  if(!value)throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql(){return neon(connectionString())}
function hashPassword(password:string,salt=randomBytes(16).toString("hex")){return `${salt}:${scryptSync(password,salt,64).toString("hex")}`}
function verifyPassword(password:string,stored:string){try{const [salt,hex]=stored.split(":");if(!salt||!hex)return false;const a=scryptSync(password,salt,64);const b=Buffer.from(hex,"hex");return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}}

export const ROLE_DEFAULT_PERMISSIONS:Record<AdminRole,AdminPermission[]>={
  owner:["orders","operations","captains","promos","finance","users","settings","reports","activity","companies","lounges"],
  manager:["orders","operations","captains","promos","finance","reports","activity","companies","lounges"],
  reception:["orders"],
  booking:["orders"],
  captain_coordinator:["orders","operations","captains"],
  lounge_supervisor:["orders","operations","lounges"],
  accountant:["finance","reports"],
  marketing:["promos","reports","companies"],
  customer_service:["orders","activity"],
  viewer:["reports","activity"],
};

export async function ensureAdminUsersTable(){
  const db=sql();
  await db`CREATE TABLE IF NOT EXISTS admin_users(
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`;
  await db`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}'::text[]`;
  await db`ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check`;
  await db`ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK(role IN ('owner','manager','reception','booking','captain_coordinator','lounge_supervisor','accountant','marketing','customer_service','viewer'))`;
  await db`CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(role,active)`;
}

function normalizeRow(row:any):AdminUser{
  const role=row.role as AdminRole;
  const raw=Array.isArray(row.permissions)?row.permissions.map(String):[];
  return {
    id:Number(row.id),username:String(row.username),name:String(row.name),phone:String(row.phone||""),role,
    permissions:(raw.length?raw:ROLE_DEFAULT_PERMISSIONS[role]||[]) as AdminPermission[],
    active:Boolean(row.active),last_login_at:row.last_login_at?String(row.last_login_at):null,created_at:String(row.created_at)
  };
}

export async function authenticateAdminUser(username:string,password:string){
  await ensureAdminUsersTable();const db=sql();
  const rows=await db`SELECT id::int,username,password_hash,name,phone,role,permissions,active,last_login_at,created_at FROM admin_users WHERE LOWER(username)=LOWER(${username.trim()}) LIMIT 1`;
  const row=rows[0] as any;if(!row||!row.active||!verifyPassword(password,String(row.password_hash)))return null;
  await db`UPDATE admin_users SET last_login_at=NOW() WHERE id=${row.id}`;
  return normalizeRow({...row,last_login_at:new Date().toISOString()});
}

export async function listAdminUsers(){
  await ensureAdminUsersTable();const db=sql();
  const rows=await db`SELECT id::int,username,name,phone,role,permissions,active,last_login_at,created_at FROM admin_users ORDER BY active DESC,created_at ASC`;
  return rows.map(normalizeRow);
}
export async function createAdminUser(input:{username:string;password:string;name:string;phone?:string;role:AdminRole;permissions?:AdminPermission[]}){
  await ensureAdminUsersTable();const db=sql();
  const permissions=input.permissions?.length?input.permissions:ROLE_DEFAULT_PERMISSIONS[input.role];
  const rows=await db`INSERT INTO admin_users(username,password_hash,name,phone,role,permissions) VALUES(${input.username.trim().toLowerCase()},${hashPassword(input.password)},${input.name.trim()},${(input.phone||"").trim()},${input.role},${permissions}) RETURNING id::int,username,name,phone,role,permissions,active,last_login_at,created_at`;
  return normalizeRow(rows[0]);
}
export async function updateAdminUser(input:{id:number;name?:string;username?:string;phone?:string;role?:AdminRole;permissions?:AdminPermission[];active?:boolean;password?:string}){
  await ensureAdminUsersTable();const db=sql();
  if(input.name!==undefined)await db`UPDATE admin_users SET name=${input.name.trim()},updated_at=NOW() WHERE id=${input.id}`;
  if(input.username!==undefined)await db`UPDATE admin_users SET username=${input.username.trim().toLowerCase()},updated_at=NOW() WHERE id=${input.id}`;
  if(input.phone!==undefined)await db`UPDATE admin_users SET phone=${input.phone.trim()},updated_at=NOW() WHERE id=${input.id}`;
  if(input.role!==undefined)await db`UPDATE admin_users SET role=${input.role},updated_at=NOW() WHERE id=${input.id}`;
  if(input.permissions!==undefined)await db`UPDATE admin_users SET permissions=${input.permissions},updated_at=NOW() WHERE id=${input.id}`;
  if(input.active!==undefined)await db`UPDATE admin_users SET active=${input.active},updated_at=NOW() WHERE id=${input.id}`;
  if(input.password)await db`UPDATE admin_users SET password_hash=${hashPassword(input.password)},updated_at=NOW() WHERE id=${input.id}`;
  const rows=await db`SELECT id::int,username,name,phone,role,permissions,active,last_login_at,created_at FROM admin_users WHERE id=${input.id}`;return rows[0]?normalizeRow(rows[0]):undefined;
}
export async function deleteAdminUser(id:number){await ensureAdminUsersTable();const db=sql();await db`DELETE FROM admin_users WHERE id=${id}`}
