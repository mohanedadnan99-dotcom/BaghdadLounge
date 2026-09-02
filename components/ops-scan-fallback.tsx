"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type DetectedBarcode = { rawValue?: string; format?: string };
type Detector = { detect: (source: HTMLCanvasElement | ImageBitmap) => Promise<DetectedBarcode[]> };
type EnhanceMode = "normal" | "contrast" | "threshold";
type TicketDetails = {
  passengerName?: string | null;
  airlineName?: string | null;
  airlineCode?: string | null;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  date?: string | null;
  time?: string | null;
  seat?: string | null;
  pnr?: string | null;
  ticketNumber?: string | null;
  confidence?: "high" | "medium" | "low";
  note?: string | null;
};

const FORMATS = ["pdf417", "qr_code", "aztec", "data_matrix"] as const;
const ROTATIONS = [0, 90, 270, 180] as const;
const MODES: EnhanceMode[] = ["normal", "contrast", "threshold"];
let detectorPromise: Promise<Detector> | null = null;

function rawField() {
  return Array.from(document.querySelectorAll("textarea")).find((element) => {
    const label = element.closest("label");
    return label?.textContent?.includes("Boarding Pass Raw Data") || element.getAttribute("placeholder")?.includes("القارئ أو الملف");
  }) as HTMLTextAreaElement | undefined;
}

function fieldByExactLabel(labelText: string) {
  const normalizedTarget = labelText.replace(/\s+/g, " ").trim();
  const label = Array.from(document.querySelectorAll("label")).find((item) => {
    const ownLabel = item.querySelector(":scope > span")?.textContent || "";
    return ownLabel.replace(/\s+/g, " ").trim() === normalizedTarget;
  });
  return label?.querySelector("input, textarea, select") as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
}

function normalizeRaw(value: string) {
  const singleLine = String(value || "")
    .replace(/[\r\n]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trimEnd();
  const start = singleLine.search(/M[1-4]/i);
  return (start >= 0 ? singleLine.slice(start) : singleLine).trimEnd();
}

function looksLikeBoardingPass(value: string) {
  const raw = normalizeRaw(value);
  return /^M[1-4]/i.test(raw) && raw.length >= 58;
}

function nativeSetter(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(prototype, "value")?.set;
}

async function settleReact() {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function setReactValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null | undefined,
  value: string,
  allowEmpty = false,
) {
  if (!element || (!allowEmpty && !value)) return false;
  nativeSetter(element)?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  await settleReact();
  return true;
}

async function fillTicketFields(details: TicketDetails) {
  const airlineCode = String(details.airlineCode || "").trim().toUpperCase();
  const airlineName = String(details.airlineName || "").trim();
  const airline = airlineName && airlineCode ? `${airlineName} (${airlineCode})` : airlineName || airlineCode;
  const date = String(details.date || "").trim();
  const time = String(details.time || "").trim();
  const departureAt = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : "";

  // A full e-ticket often contains unrelated QR codes (booking/manage links).
  // Clear those short values so they are not mistaken for IATA boarding data.
  const raw = rawField();
  if (raw && raw.value && !looksLikeBoardingPass(raw.value)) await setReactValue(raw, "", true);

  // The Ops form uses controlled React inputs whose onChange handlers update the
  // whole entry object. Update one field per task so each React commit completes
  // before the next field, otherwise successive synthetic events overwrite one another.
  const values: Array<[string, string]> = [
    ["اسم المسافر", String(details.passengerName || "").trim()],
    ["شركة الطيران", airline],
    ["رقم الرحلة", String(details.flightNumber || "").trim().toUpperCase()],
    ["وقت الإقلاع — بتوقيت بغداد", departureAt],
    ["من", String(details.origin || "").trim().toUpperCase()],
    ["إلى", String(details.destination || "").trim().toUpperCase()],
    ["المقعد", String(details.seat || "").trim()],
  ];

  let populated = 0;
  for (const [label, value] of values) {
    if (!value) continue;
    if (await setReactValue(fieldByExactLabel(label), value)) populated += 1;
  }

  const metadata = [
    details.pnr ? `PNR: ${String(details.pnr).trim()}` : "",
    details.ticketNumber ? `Ticket: ${String(details.ticketNumber).trim()}` : "",
    details.note ? String(details.note).trim() : "",
  ].filter(Boolean).join(" · ");
  const notes = fieldByExactLabel("ملاحظات");
  if (metadata && notes && !String(notes.value || "").trim()) await setReactValue(notes, metadata);

  return populated > 0;
}

async function extractFullTicket(file: File, onProgress?: (message: string) => void) {
  onProgress?.("جاري قراءة محتوى التذكرة بالكامل واستخراج بيانات الرحلة...");
  const form = new FormData();
  form.append("ticket", file);
  const response = await fetch("/api/ops/ticket-extract", { method: "POST", body: form, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { details?: TicketDetails; error?: string };
  if (!response.ok || !payload.details) throw new Error(payload.error || "full ticket extraction failed");
  const filled = await fillTicketFields(payload.details);
  if (!filled) throw new Error("no useful ticket details");
  return payload.details;
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = import("barcode-detector/ponyfill")
      .then(async ({ BarcodeDetector, prepareZXingModule }) => {
        await prepareZXingModule({
          overrides: {
            locateFile: (path: string, prefix: string) => path.endsWith(".wasm") ? "/zxing_reader.wasm" : `${prefix}${path}`,
          },
          fireImmediately: true,
        });
        return new BarcodeDetector({ formats: [...FORMATS] }) as Detector;
      })
      .catch((error) => {
        detectorPromise = null;
        throw error;
      });
  }
  return detectorPromise;
}

function canvasFromBitmap(bitmap: ImageBitmap, rotation: number, mode: EnhanceMode) {
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const longestSide = Math.max(sourceWidth, sourceHeight);
  const scale = longestSide < 2400 ? Math.min(2, 2400 / Math.max(1, longestSide)) : Math.min(1, 3000 / longestSide);
  const rotated = rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((rotated ? sourceHeight : sourceWidth) * scale));
  canvas.height = Math.max(1, Math.round((rotated ? sourceWidth : sourceHeight) * scale));
  const context = canvas.getContext("2d", { willReadFrequently: mode !== "normal" });
  if (!context) return canvas;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(bitmap, -(sourceWidth * scale) / 2, -(sourceHeight * scale) / 2, sourceWidth * scale, sourceHeight * scale);
  context.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === "normal") return canvas;

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = Math.round((pixels[index] * 0.299) + (pixels[index + 1] * 0.587) + (pixels[index + 2] * 0.114));
    let value = gray;
    if (mode === "contrast") value = Math.max(0, Math.min(255, Math.round(((gray - 128) * 1.7) + 128)));
    if (mode === "threshold") value = gray < 182 ? 0 : 255;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

async function detectBoardingPass(bitmap: ImageBitmap, onProgress?: (message: string) => void) {
  const detector = await getDetector();
  let attempt = 0;
  const total = ROTATIONS.length * MODES.length;
  for (const rotation of ROTATIONS) {
    for (const mode of MODES) {
      attempt += 1;
      onProgress?.(`جاري تحسين وقراءة الباركود (${attempt}/${total})...`);
      const canvas = canvasFromBitmap(bitmap, rotation, mode);
      try {
        const results = await detector.detect(canvas);
        for (const result of results || []) {
          const raw = normalizeRaw(String(result.rawValue || ""));
          if (looksLikeBoardingPass(raw)) return { raw, format: String(result.format || "PDF417") };
        }
      } catch {}
    }
  }
  return null;
}

async function scanImage(file: File, onProgress?: (message: string) => void) {
  const bitmap = await createImageBitmap(file);
  try {
    return await detectBoardingPass(bitmap, onProgress);
  } finally {
    bitmap.close();
  }
}

async function scanPdf(file: File, onProgress?: (message: string) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, 3);
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    onProgress?.(`جاري تجهيز صفحة ${pageNumber} من ${pages}...`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const bitmap = await createImageBitmap(canvas);
    try {
      const result = await detectBoardingPass(bitmap, (message) => onProgress?.(`صفحة ${pageNumber}: ${message}`));
      if (result) return result;
    } finally {
      bitmap.close();
    }
  }
  return null;
}

export default function OpsScanFallback() {
  const pathname = usePathname();
  const [status, setStatus] = useState("");
  const activeRun = useRef(0);
  const clearTimer = useRef<number | null>(null);

  useEffect(() => {
    if (pathname !== "/ops") return;

    const showStatus = (message: string, autoClear = false) => {
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
      setStatus(message);
      if (autoClear) clearTimer.current = window.setTimeout(() => setStatus(""), 5200);
    };

    const readFullDocument = async (file: File, runId: number) => {
      const details = await extractFullTicket(file, (message) => runId === activeRun.current && showStatus(message));
      if (runId !== activeRun.current) return null;
      const review = details.confidence === "low" ? " — راجع البيانات قبل التأكيد" : "";
      showStatus(`تمت قراءة التذكرة كاملة ونزلت المعلومات داخل الحقول تلقائياً${review}.`, true);
      try { navigator.vibrate?.(100); } catch {}
      return details;
    };

    const onChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.[0]) return;
      const file = input.files[0];
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
      const runId = ++activeRun.current;

      window.setTimeout(async () => {
        if (runId !== activeRun.current) return;
        const field = rawField();
        const validPrimaryBoarding = Boolean(field && looksLikeBoardingPass(field.value));

        if (file.type === "application/pdf") {
          // Full ticket PDFs are documents first, not barcodes. Read the whole
          // itinerary immediately so unrelated booking QR codes cannot block it.
          try {
            showStatus(validPrimaryBoarding
              ? "تمت قراءة البوردنغ؛ جاري إكمال وقت الرحلة وباقي البيانات من ملف PDF..."
              : "جاري قراءة ملف PDF كتذكرة كاملة واستخراج بيانات رحلة بغداد...");
            await readFullDocument(file, runId);
            return;
          } catch (error) {
            console.error("ops full PDF extraction", error);
            if (runId !== activeRun.current) return;
            showStatus("تعذرت القراءة الذكية؛ جاري تجربة قارئ الباركود المحلي داخل الـPDF...");
            try {
              const result = await scanPdf(file, (message) => runId === activeRun.current && showStatus(message));
              if (runId !== activeRun.current) return;
              if (result) {
                await setReactValue(rawField(), result.raw);
                showStatus(`تمت قراءة البوردنغ محلياً — ${result.format || "PDF417"}.`, true);
                return;
              }
            } catch (scanError) {
              console.error("ops PDF barcode fallback", scanError);
            }
            showStatus("ما قدرت أقرأ بيانات الرحلة من هذا الـPDF. راجع الاتصال أو جرّب الملف الأصلي مرة ثانية.", true);
            return;
          }
        }

        if (validPrimaryBoarding) return;

        showStatus("جاري فحص الباركود داخل الصورة وتحسينها...");
        try {
          const result = await scanImage(file, (message) => runId === activeRun.current && showStatus(message));
          if (runId !== activeRun.current) return;
          if (result) {
            await setReactValue(rawField(), result.raw);
            showStatus(`تمت قراءة البوردنغ وتعبئة المعلومات تلقائياً — ${result.format || "PDF417"}.`, true);
            return;
          }
        } catch (error) {
          console.error("ops robust image barcode fallback", error);
        }

        try {
          showStatus("ماكو Boarding Pass barcode مقروء؛ جاري قراءة محتوى الصورة كتذكرة...");
          await readFullDocument(file, runId);
        } catch (error) {
          console.error("ops image ticket extraction", error);
          if (runId === activeRun.current) showStatus("ما قدرت أستخرج معلومات واضحة من الصورة. جرّب صورة أوضح أو القارئ الخارجي.", true);
        }
      }, 650);
    };

    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("change", onChange, true);
      activeRun.current += 1;
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    };
  }, [pathname]);

  if (pathname !== "/ops" || !status) return null;
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 120,
        maxWidth: 440,
        background: "#0d1829",
        color: "#f8fafc",
        border: "1px solid #c8a66a",
        borderRadius: 14,
        padding: "11px 13px",
        boxShadow: "0 12px 30px rgba(0,0,0,.4)",
        fontWeight: 800,
      }}
    >
      {status}
    </div>
  );
}
