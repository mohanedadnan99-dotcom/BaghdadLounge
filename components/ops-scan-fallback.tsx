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

function fieldByLabel(labelText: string) {
  const label = Array.from(document.querySelectorAll("label")).find((item) => item.textContent?.includes(labelText));
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

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null | undefined, value: string) {
  if (!element || !value) return;
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillTicketFields(details: TicketDetails) {
  const airlineCode = String(details.airlineCode || "").trim().toUpperCase();
  const airlineName = String(details.airlineName || "").trim();
  const airline = airlineName && airlineCode ? `${airlineName} (${airlineCode})` : airlineName || airlineCode;
  const date = String(details.date || "").trim();
  const time = String(details.time || "").trim();
  const departureAt = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : "";

  setNativeValue(fieldByLabel("اسم المسافر"), String(details.passengerName || "").trim());
  setNativeValue(fieldByLabel("شركة الطيران"), airline);
  setNativeValue(fieldByLabel("رقم الرحلة"), String(details.flightNumber || "").trim().toUpperCase());
  setNativeValue(fieldByLabel("وقت الإقلاع"), departureAt);
  setNativeValue(fieldByLabel("من"), String(details.origin || "").trim().toUpperCase());
  setNativeValue(fieldByLabel("إلى"), String(details.destination || "").trim().toUpperCase());
  setNativeValue(fieldByLabel("المقعد"), String(details.seat || "").trim());

  const notes = fieldByLabel("ملاحظات");
  if (notes && !String(notes.value || "").trim()) {
    const metadata = [
      details.pnr ? `PNR: ${details.pnr}` : "",
      details.ticketNumber ? `Ticket: ${details.ticketNumber}` : "",
      details.note ? String(details.note) : "",
    ].filter(Boolean).join(" · ");
    if (metadata) setNativeValue(notes, metadata);
  }

  return Boolean(details.passengerName || details.flightNumber || (details.origin && details.destination));
}

async function extractFullTicket(file: File, onProgress?: (message: string) => void) {
  onProgress?.("جاري قراءة محتوى التذكرة بالكامل واستخراج بيانات الرحلة...");
  const form = new FormData();
  form.append("ticket", file);
  const response = await fetch("/api/ops/ticket-extract", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({})) as { details?: TicketDetails; error?: string };
  if (!response.ok || !payload.details) throw new Error(payload.error || "full ticket extraction failed");
  const filled = fillTicketFields(payload.details);
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
  const scale = longestSide < 2400
    ? Math.min(2, 2400 / Math.max(1, longestSide))
    : Math.min(1, 3000 / longestSide);
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

    const readFullDocument = async (file: File, runId: number, barcodeAlreadyRead: boolean) => {
      try {
        const details = await extractFullTicket(file, (message) => runId === activeRun.current && showStatus(message));
        if (runId !== activeRun.current) return;
        const review = details.confidence === "low" ? " — راجع البيانات قبل التأكيد" : "";
        showStatus(`تمت قراءة التذكرة كاملة وتعبئة معلومات الرحلة تلقائياً${review}.`, true);
        try { navigator.vibrate?.(100); } catch {}
      } catch (error) {
        console.error("ops full ticket extraction", error);
        if (runId !== activeRun.current) return;
        showStatus(barcodeAlreadyRead
          ? "تمت قراءة الباركود، لكن تعذر إكمال باقي بيانات التذكرة تلقائياً. راجع وقت الإقلاع يدوياً."
          : "ما قدرت أستخرج معلومات واضحة من التذكرة. جرّب PDF الأصلي أو صورة أوضح.", true);
      }
    };

    const onChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.[0]) return;
      const file = input.files[0];
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
      const runId = ++activeRun.current;

      window.setTimeout(async () => {
        if (runId !== activeRun.current) return;
        const fieldBefore = rawField();
        const primaryRead = Boolean(fieldBefore && looksLikeBoardingPass(fieldBefore.value));
        if (primaryRead) {
          if (file.type === "application/pdf") {
            showStatus("تمت قراءة الباركود. جاري إكمال بيانات الرحلة من ملف PDF بالكامل...");
            await readFullDocument(file, runId, true);
          }
          return;
        }

        showStatus("جاري البحث عن باركود البوردنغ داخل الملف...");
        let result: { raw: string; format: string } | null = null;
        try {
          result = file.type.startsWith("image/")
            ? await scanImage(file, (message) => runId === activeRun.current && showStatus(message))
            : await scanPdf(file, (message) => runId === activeRun.current && showStatus(message));
        } catch (error) {
          console.error("ops robust barcode fallback", error);
        }
        if (runId !== activeRun.current) return;

        const field = rawField();
        if (!field) return;
        if (looksLikeBoardingPass(field.value)) {
          if (file.type === "application/pdf") await readFullDocument(file, runId, true);
          return;
        }

        if (result) {
          setNativeValue(field, result.raw);
          if (file.type === "application/pdf") {
            showStatus(`تمت قراءة ${result.format || "PDF417"}. جاري إكمال تفاصيل الرحلة من التذكرة...`);
            await readFullDocument(file, runId, true);
          } else {
            showStatus(`تمت قراءة البوردنغ وتعبئة المعلومات تلقائياً — ${result.format || "PDF417"}.`, true);
          }
          return;
        }

        showStatus("ماكو باركود بوردنغ مقروء؛ جاري قراءة نص التذكرة والرحلة بالكامل...");
        await readFullDocument(file, runId, false);
      }, 700);
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
