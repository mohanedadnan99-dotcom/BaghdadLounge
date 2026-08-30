import { adminSessionFromRequest, clearAdminSessionCookie } from "@/lib/admin-auth";
import { revokeAdminDbSession } from "@/lib/admin-security-db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  try{
    const session=adminSessionFromRequest(request);
    if(session?.sessionId)await revokeAdminDbSession(session.sessionId,session.name||session.username||"logout");
  }catch(error){console.error("admin logout revoke failed",error)}
  return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":clearAdminSessionCookie()}});
}
