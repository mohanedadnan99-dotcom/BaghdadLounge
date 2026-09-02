"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, CircleAlert, ScanLine, Usb, X } from "lucide-react";
import { HARDWARE_SCANNER_TEST_ATTR, HARDWARE_SCANNER_TEST_EVENT } from "@/lib/use-hardware-barcode-scanner";

type ParsedTest = {
  passengerName?: string;
  pnr?: string;
  origin?: string;
  destination?: string;
  carrier?: string;
  flightNumber?: string;
  flightDate?: string;
  seat?: string;
  checkInSequence?: string;
};

type TestResult = {
  raw: string;
  normalizedRaw: string;
  validIata: boolean;
  length: number;
  receivedAt: number;
  connectionMode: string;
  parsed: ParsedTest | null;
  error?: string;
};

type TestState = "idle" | "waiting" | "success" | "invalid" | "timeout";

function setTestMode(active: boolean) {
  if (active) document.documentElement.setAttribute(HARDWARE_SCANNER_TEST_ATTR, "1");
  else document.documentElement.removeAttribute(HARDWARE_SCANNER_TEST_ATTR);
}

function safeRaw(raw: string) {
  const cleaned = String(raw || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 180)}…` : cleaned;
}

export default function OpsHardwareScannerTest() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TestState>("idle");
  const [result, setResult] = useState<TestResult | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopTest = () => {
    setTestMode(false);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const startTest = () => {
    stopTest();
    setResult(null);
    setState("waiting");
    setTestMode(true);
    timeoutRef.current = window.setTimeout(() => {
      setTestMode(false);
      setState("timeout");
      timeoutRef.current = null;
    }, 30_000);
  };

  const close = () => {
    stopTest();
    setOpen(false);
    setState("idle");
    setResult(null);
  };

  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<TestResult>).detail;
      if (!detail) return;
      stopTest();
      setResult(detail);
      setState(detail.validIata ? "success" : "invalid");
    };
    window.addEventListener(HARDWARE_SCANNER_TEST_EVENT, onResult as EventListener);
    return () => {
      window.removeEventListener(HARDWARE_SCANNER_TEST_EVENT, onResult as EventListener);
      setTestMode(false);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (pathname !== "/ops") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setState("idle"); setResult(null); }}
        aria-label="اختبار قارئ البوردنغ"
        style={{
          position: "fixed",
          left: 14,
          bottom: 14,
          zIndex: 115,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(200,166,106,.65)",
          borderRadius: 14,
          background: "#0d1829",
          color: "#f8fafc",
          padding: "11px 13px",
          boxShadow: "0 12px 28px rgba(0,0,0,.35)",
          fontWeight: 850,
          fontSize: 14,
        }}
      >
        <Usb size={18} /> اختبار قارئ البوردنغ
      </button>

      {open ? (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="اختبار قارئ البوردنغ"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(2,8,18,.76)",
            backdropFilter: "blur(7px)",
          }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <div style={{ width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto", border: "1px solid rgba(200,166,106,.42)", borderRadius: 22, background: "#0b1626", color: "#f8fafc", boxShadow: "0 24px 70px rgba(0,0,0,.55)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#d9bc83", fontSize: 13, fontWeight: 900, marginBottom: 5 }}>تشخيص مباشر — بدون تسجيل مسافر</div>
                <h2 style={{ margin: 0, fontSize: 23, lineHeight: 1.35 }}>اختبار قارئ USB / Bluetooth</h2>
              </div>
              <button type="button" onClick={close} aria-label="إغلاق" style={{ border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#f8fafc", borderRadius: 11, width: 38, height: 38, display: "grid", placeItems: "center" }}><X size={19} /></button>
            </div>

            <p style={{ margin: "12px 0 16px", color: "#aab8cc", lineHeight: 1.8, fontSize: 14 }}>
              اربط الجهاز بوضع <b style={{ color: "#f8fafc" }}>Keyboard / HID</b>، اضغط بدء الاختبار، وبعدها امسح Boarding Pass واحد. أثناء الاختبار لن تنزل أي عملية دخول ولن تتغير بيانات المسافر.
            </p>

            {state === "idle" ? (
              <button type="button" onClick={startTest} style={{ width: "100%", minHeight: 52, border: "1px solid rgba(200,166,106,.8)", borderRadius: 14, background: "rgba(200,166,106,.12)", color: "#f6dfad", fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}><ScanLine size={20} /> بدء اختبار القارئ</button>
            ) : null}

            {state === "waiting" ? (
              <div style={{ border: "1px solid rgba(59,130,246,.38)", background: "rgba(59,130,246,.08)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900, fontSize: 17 }}><ScanLine size={21} /> بانتظار المسح الآن...</div>
                <div style={{ marginTop: 8, color: "#aab8cc", lineHeight: 1.7, fontSize: 14 }}>مرّر البوردنغ على الجهاز خلال 30 ثانية. لا تضغط داخل أي خانة.</div>
                <button type="button" onClick={() => { stopTest(); setState("idle"); }} style={{ marginTop: 12, border: "1px solid rgba(255,255,255,.16)", borderRadius: 11, background: "transparent", color: "#e6edf7", padding: "9px 13px", fontWeight: 800 }}>إلغاء الاختبار</button>
              </div>
            ) : null}

            {state === "success" && result?.parsed ? (
              <div style={{ border: "1px solid rgba(34,197,94,.42)", background: "rgba(34,197,94,.08)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 18, fontWeight: 950 }}><CheckCircle2 size={22} /> الجهاز شغال والنظام استلم البوردنغ بنجاح</div>
                <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 14 }}>
                  <div><b>الاتصال:</b> {result.connectionMode}</div>
                  <div><b>صيغة البيانات:</b> IATA BCBP صالح</div>
                  <div><b>اسم المسافر:</b> {result.parsed.passengerName || "—"}</div>
                  <div><b>الرحلة:</b> {result.parsed.flightNumber || "—"}</div>
                  <div><b>المسار:</b> {result.parsed.origin || "—"} → {result.parsed.destination || "—"}</div>
                  <div><b>التاريخ:</b> {result.parsed.flightDate || "—"}</div>
                  <div><b>المقعد:</b> {result.parsed.seat || "غير موجود بالباركود"}</div>
                  <div><b>PNR:</b> {result.parsed.pnr || "—"}</div>
                  <div><b>طول القراءة:</b> {result.length} حرف</div>
                </div>
                <p style={{ margin: "12px 0 0", color: "#b7c5d8", fontSize: 13, lineHeight: 1.7 }}>ملاحظة: وضع Keyboard/HID ينقل البيانات المفكوكة فقط؛ لذلك المتصفح يثبت أن البيانات IATA صحيحة، لكنه لا يستطيع دائماً معرفة هل الرمز المطبوع نفسه PDF417 أو Aztec إلا إذا الجهاز يرسل Symbology ID.</p>
              </div>
            ) : null}

            {state === "invalid" && result ? (
              <div style={{ border: "1px solid rgba(245,158,11,.5)", background: "rgba(245,158,11,.08)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 18, fontWeight: 950 }}><CircleAlert size={22} /> الجهاز أرسل بيانات، لكن مو Boarding Pass IATA صالح</div>
                <div style={{ marginTop: 10, color: "#d7dfeb", lineHeight: 1.75, fontSize: 14 }}>
                  هذا يعني أن الاتصال بالجهاز شغال، لكن غالباً الجهاز قرأ QR قصير أو إعداد PDF417/2D غير مفعّل. فعّل <b>PDF417</b> وخلي وضع الإخراج <b>USB HID / Keyboard</b>.
                </div>
                <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 11, background: "rgba(0,0,0,.18)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", direction: "ltr", textAlign: "left", overflowWrap: "anywhere", fontSize: 12 }}>
                  {safeRaw(result.raw) || "(قراءة فارغة)"}
                </div>
                <div style={{ marginTop: 8, color: "#aab8cc", fontSize: 13 }}>طول القراءة: {result.length} حرف</div>
              </div>
            ) : null}

            {state === "timeout" ? (
              <div style={{ border: "1px solid rgba(239,68,68,.42)", background: "rgba(239,68,68,.07)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 18, fontWeight: 950 }}><CircleAlert size={22} /> ما وصلت أي إشارة من القارئ خلال 30 ثانية</div>
                <div style={{ marginTop: 9, color: "#c2cddd", lineHeight: 1.75, fontSize: 14 }}>تأكد أن الحاسبة تتعرف على الجهاز كـKeyboard/HID، وأن المؤشر يشتغل عند المسح. بعدها أعد الاختبار.</div>
              </div>
            ) : null}

            {state !== "waiting" && state !== "idle" ? (
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={startTest} style={{ flex: 1, minHeight: 46, border: "1px solid rgba(200,166,106,.7)", borderRadius: 12, background: "rgba(200,166,106,.11)", color: "#f6dfad", fontWeight: 900 }}>إعادة الاختبار</button>
                <button type="button" onClick={close} style={{ flex: 1, minHeight: 46, border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "transparent", color: "#f8fafc", fontWeight: 850 }}>إغلاق</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
