import { findValidPromoCode } from "@/lib/promo-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: string };
    const promo = await findValidPromoCode(body.code || "");
    if (!promo) return Response.json({ valid: false, message: "رمز الخصم غير صحيح أو غير فعّال" }, { status: 404 });
    return Response.json({
      valid: true,
      code: promo.code,
      companyName: promo.company_name,
      discountPercent: promo.discount_percent,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Promo validation failed", error);
    return Response.json({ valid: false, message: "تعذر التحقق من رمز الخصم" }, { status: 500 });
  }
}
