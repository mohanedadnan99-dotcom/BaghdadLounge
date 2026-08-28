import { adminTokenFromRequest, verifyAdminSession } from "@/lib/admin-auth";
import { createPromo, deletePromo, listPromos, updatePromo } from "@/lib/promo-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  return verifyAdminSession(adminTokenFromRequest(request));
}

function parseDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    return Response.json({ promos: await listPromos() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Promo list failed", error);
    return Response.json({ message: "تعذر تحميل رموز الخصم" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const companyName = String(body.companyName || "").trim();
    const code = String(body.code || "").trim();
    const discountPercent = Number(body.discountPercent);
    const maxUses = body.maxUses === "" || body.maxUses == null ? null : Number(body.maxUses);
    if (companyName.length < 2) return Response.json({ message: "اكتب اسم الشركة" }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(code)) return Response.json({ message: "رمز الخصم لازم يكون 3 أحرف أو أكثر وبدون مسافات" }, { status: 400 });
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) return Response.json({ message: "نسبة الخصم غير صحيحة" }, { status: 400 });
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return Response.json({ message: "الحد الأقصى للاستخدام غير صحيح" }, { status: 400 });
    const startsAt = parseDate(body.startsAt);
    const expiresAt = parseDate(body.expiresAt);
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) return Response.json({ message: "تاريخ الانتهاء لازم يكون بعد تاريخ البداية" }, { status: 400 });
    const promo = await createPromo({ companyName, code, discountPercent, startsAt, expiresAt, maxUses });
    return Response.json({ promo }, { status: 201 });
  } catch (error) {
    console.error("Promo creation failed", error);
    const message = error instanceof Error && /unique|duplicate/i.test(error.message) ? "رمز الخصم مستخدم مسبقاً" : "تعذر إنشاء رمز الخصم";
    return Response.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return Response.json({ message: "غير مصرح" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const companyName = String(body.companyName || "").trim();
    const code = String(body.code || "").trim();
    const discountPercent = Number(body.discountPercent);
    const active = Boolean(body.active);
    const maxUses = body.maxUses === "" || body.maxUses == null ? null : Number(body.maxUses);
    if (!Number.isInteger(id) || id < 1) return Response.json({ message: "معرف غير صحيح" }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(code) || companyName.length < 2 || !Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) return Response.json({ message: "تأكد من معلومات الرمز" }, { status: 400 });
    const startsAt = parseDate(body.startsAt);
    const expiresAt = parseDate(body.expiresAt);
    const promo = await updatePromo({ id, companyName, code, discountPercent, startsAt, expiresAt, maxUses, active });
    if (!promo) return Response.json({ message: "الرمز غير موجود" }, { status: 404 });
    return Response.json({ promo });
  } catch (error) {
    console.error("Promo update failed", error);
    return Response.json({ message: "تعذر حفظ التعديل" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return Response.json({ message: "غير مصرح" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return Response.json({ message: "معرف غير صحيح" }, { status: 400 });
  try {
    await deletePromo(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Promo delete failed", error);
    return Response.json({ message: "تعذر حذف الرمز" }, { status: 500 });
  }
}
