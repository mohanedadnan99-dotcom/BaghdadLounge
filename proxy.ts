import { NextRequest, NextResponse } from "next/server";
import { adminTokenFromRequest, readAdminSession } from "@/lib/admin-auth";
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
  return NextResponse.next();
}

export const config={matcher:["/api/admin/:path*","/api/captain/admin/captains","/api/prmos/promos"]};
