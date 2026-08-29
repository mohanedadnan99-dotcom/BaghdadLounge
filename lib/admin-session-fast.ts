import { neon } from "@neondatabase/serverless";

function connectionString(){
  const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;
  if(!value)throw new Error("DATABASE_URL is not configured");
  return value;
}

export async function isAdminSessionActiveFast(id:string){
  if(!id)return false;
  const db=neon(connectionString());
  try{
    const rows=await db`UPDATE admin_sessions SET last_seen_at=NOW() WHERE id=${id} AND revoked_at IS NULL AND expires_at>NOW() RETURNING id`;
    return Boolean(rows[0]);
  }catch(error:any){
    if(error?.code==='42P01')return false;
    throw error;
  }
}
