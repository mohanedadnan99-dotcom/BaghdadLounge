import { randomUUID } from "node:crypto";
import { verifyCaptainSession } from "@/lib/captain-auth";
import { saveCaptainOrder } from "@/lib/captain-orders-db";
import { findWatchMatch, getLoungeById } from "@/lib/operations-db";
import { readMaintenanceState } from "@/lib/maintenance";
import { companyCreditDecision } from "@/lib/business-suite-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}
function timestamp() {return new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"}).format(new Date())}
function orderId() {const parts = new Intl.DateTimeFormat("en", {timeZone: "Asia/Baghdad", year: "2-digit", month: "2-digit", day: "2-digit"}).formatToParts(new Date());const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "00";return `CP-${part("year")}${part("month")}${part("day")}-${randomUUID().slice(0, 4).toUpperCase()}`}

export async function POST(request: Request) {
  try {
    const maintenance = await readMaintenanceState();
    if (maintenance.captain) return Response.json({ message: "بوابة الكباتن متوقفة مؤقتاً من الإدارة. يرجى المحاولة لاحقاً." }, { status: 503 });
    const body = await request.json() as {sessionToken?: string; loungeId?: string; passengers?: number; bags?: number; carts?: number; phone?: string};
    const captain = body.sessionToken ? verifyCaptainSession(body.sessionToken) : null;
    if (!captain) return Response.json({ message: "انتهت جلسة الدخول، سجل دخولك مرة ثانية" }, { status: 401 });
    const loungeSetting = body.loungeId ? await getLoungeById(body.loungeId) : undefined;
    const lounge = loungeSetting?.active ? loungeSetting.name : undefined;
    const phone = body.phone?.replace(/[\s-]/g, "") || "";
    const validCount = (value: unknown, min: number) => Number.isInteger(value) && Number(value) >= min && Number(value) <= 20;
    if (!lounge || !validCount(body.passengers, 1) || !validCount(body.bags, 0) || !validCount(body.carts, 0) || !/^(?:\+?964|0)?7\d{9}$/.test(phone)) return Response.json({ message: loungeSetting && !loungeSetting.active ? "هذه الصالة متوقفة حالياً" : "راجع معلومات الطلب وحاول مرة ثانية" }, { status: 400 });
    const watchMatch = await findWatchMatch({ phone, captain: captain.name, company: captain.company || "" });
    if (watchMatch) return Response.json({ message: "تعذر تأكيد الطلب. يرجى التواصل مع الإدارة" }, { status: 403 });
    if(captain.company){const credit=await companyCreditDecision(captain.company);if(!credit.allowed)return Response.json({message:credit.reason},{status:403})}
    const token = process.env.TELEGRAM_BOT_TOKEN;const chatId = process.env.CAPTAIN_TELEGRAM_CHAT_ID || "-5416078470";
    if (!token || token.startsWith("(")) return Response.json({ message: "خدمة تأكيد الطلب غير مفعلة حالياً" }, { status: 503 });
    const reference = orderId();
    const message = ["<b>طلب صالة</b>","━━━━━━━━━━━━━━",`<b>رقم الطلب:</b> <code>${reference}</code>`,`<b>اسم الكابتن:</b> ${escapeHtml(captain.name)}`,`<b>الشركة:</b> ${escapeHtml(captain.company || "غير مضافة")}`,`<b>رقم هاتف الكابتن:</b> <code>${escapeHtml(captain.phone || "غير مضاف")}</code>`,"──────────────",`<b>الصالة:</b> ${escapeHtml(lounge)}`,`<b>عدد المسافرين:</b> ${body.passengers}`,`<b>عدد الحقائب:</b> ${body.bags}`,`<b>عدد العربات:</b> ${body.carts}`,`<b>رقم المسافر:</b> <code>${escapeHtml(phone)}</code>`,`<b>وقت إرسال الطلب:</b> ${timestamp()}`,"━━━━━━━━━━━━━━"].join("\n");
    const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" })});
    if (!telegram.ok) return Response.json({ message: "تعذر تأكيد الطلب، حاول مرة ثانية" }, { status: 502 });
    await saveCaptainOrder({reference,captainName: captain.name,captainCompany: captain.company || "",captainPhone: captain.phone || "",loungeName: lounge,passengers: Number(body.passengers),bags: Number(body.bags),carts: Number(body.carts),passengerPhone: phone});
    return Response.json({ orderId: reference }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {console.error("Captain booking failed", error);return Response.json({ message: "صار خلل أثناء تأكيد الطلب" }, { status: 500 })}
}
