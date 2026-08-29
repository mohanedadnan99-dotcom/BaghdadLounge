import { adminSessionFromRequest, roleCan } from "@/lib/admin-auth";
import { createCaptain, deleteCaptain, listCaptains, updateCaptain } from "@/lib/captain-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const s=adminSessionFromRequest(request);
  return s&&roleCan(s.role,"captains")?s:null;
}
function unauthorized() { return Response.json({ message: "غير مصرح لإدارة الكباتن" }, { status: 403 }); }
function validPhone(phone: string) { return !phone || /^(?:\+?964|0)?7\d{9}$/.test(phone.replace(/[\s-]/g, "")); }
function validUsername(username:string){return /^[a-z0-9._-]{2,32}$/.test(username)}

export async function GET(request: Request) {
  if (!authorized(request)) return unauthorized();
  try { return Response.json({ captains: await listCaptains() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error(error); return Response.json({ message: "تعذر تحميل الكباتن. تأكد من ربط قاعدة البيانات." }, { status: 500 }); }
}
export async function POST(request: Request) {
  if (!authorized(request)) return unauthorized();
  try {
    const body = await request.json() as { username?: string; password?: string; name?: string; company?: string; phone?: string };
    const username = body.username?.trim().toLowerCase() || ""; const password = body.password || ""; const name = body.name?.trim() || ""; const company = body.company?.trim() || ""; const phone = body.phone?.trim() || "";
    if (!name || !company || !username || password.length < 6) return Response.json({ message: "أكمل الاسم والشركة واليوزر، والباسورد لازم 6 خانات على الأقل" }, { status: 400 });
    if (!validUsername(username)) return Response.json({ message: "اليوزر يكون حروف إنكليزية أو أرقام فقط ومن 2 إلى 32 خانة" }, { status: 400 });
    if (!validPhone(phone)) return Response.json({ message: "رقم الهاتف غير صحيح" }, { status: 400 });
    return Response.json({ captain: await createCaptain({ username, password, name, company, phone }) }, { status: 201 });
  } catch (error: any) {
    if (String(error?.message || "").includes("unique")) return Response.json({ message: "اسم المستخدم مستخدم مسبقاً" }, { status: 409 });
    console.error(error); return Response.json({ message: "تعذر إنشاء الحساب" }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  if (!authorized(request)) return unauthorized();
  try {
    const body = await request.json() as { id?: number; username?: string; password?: string; name?: string; company?: string; phone?: string; active?: boolean };
    const id = Number(body.id); const username = body.username?.trim().toLowerCase() || ""; const name = body.name?.trim() || ""; const company = body.company?.trim() || ""; const phone = body.phone?.trim() || ""; const password = body.password || "";
    if (!Number.isFinite(id) || !name || !company || !username) return Response.json({ message: "بيانات التعديل ناقصة" }, { status: 400 });
    if (!validUsername(username)) return Response.json({ message: "اليوزر يكون حروف إنكليزية أو أرقام فقط ومن 2 إلى 32 خانة" }, { status: 400 });
    if (!validPhone(phone)) return Response.json({ message: "رقم الهاتف غير صحيح" }, { status: 400 });
    if (password && password.length < 6) return Response.json({ message: "الباسورد الجديد لازم 6 خانات على الأقل" }, { status: 400 });
    const captain = await updateCaptain(id, { username, password: password || undefined, name, company, phone, active: body.active !== false });
    if (!captain) return Response.json({ message: "الحساب غير موجود" }, { status: 404 });
    return Response.json({ captain });
  } catch (error: any) {
    if (String(error?.message || "").includes("unique")) return Response.json({ message: "اسم المستخدم مستخدم مسبقاً" }, { status: 409 });
    console.error(error); return Response.json({ message: "تعذر تعديل الحساب" }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  if (!authorized(request)) return unauthorized();
  try { const id = Number(new URL(request.url).searchParams.get("id")); if (!Number.isFinite(id)) return Response.json({ message: "معرف غير صحيح" }, { status: 400 }); await deleteCaptain(id); return Response.json({ ok: true }); }
  catch (error) { console.error(error); return Response.json({ message: "تعذر حذف الحساب" }, { status: 500 }); }
}
