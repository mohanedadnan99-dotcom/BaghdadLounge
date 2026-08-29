import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminTokenFromRequest, readAdminSession } from "@/lib/admin-auth";
import { isAdminDbSessionActive } from "@/lib/admin-security-db";

export async function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path==="/api/captain/admin/login"||path==="/api/prmos/login")return NextResponse.next();
  const token=adminTokenFromRequest(request);
  if(!token)return NextResponse.json({message:"غير مصرح"},{status:401});
  const session=readAdminSession(token);
  if(!session?.sessionId)return NextResponse.json({message:"انتهت الجلسة، سجل دخولك مرة ثانية"},{status:401});
  const active=await isAdminDbSessionActive(session.sessionId);
  if(!active)return NextResponse.json({message:"تم إنهاء هذه الجلسة"},{status:401});
  const response=NextResponse.next();
  if(!request.cookies.get(ADMIN_SESSION_COOKIE)?.value){
    response.cookies.set(ADMIN_SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:true,path:"/",maxAge:8*60*60});
  }
  return response;
}

export const config={matcher:["/api/admin/:path*","/api/captain/admin/captains","/api/prmos/promos"]};
