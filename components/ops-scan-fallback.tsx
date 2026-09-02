"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type DetectedBarcode = { rawValue?: string; format?: string };
type Detector = { detect: (source: HTMLCanvasElement | ImageBitmap) => Promise<DetectedBarcode[]> };

type EnhanceMode = "normal" | "contrast" | "threshold";

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

function setNativeTextAreaValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
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
  context.drawImage(
    bitmap,
    -(sourceWidth * scale) / 2,
    -(sourceHeight * scale) / 2,
    sourceWidth * scale,
    sourceHeight * scale,
  );
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
      } catch {
        // Continue through the remaining rotation/contrast attempts.
      }
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
      if (autoClear) clearTimer.current = window.setTimeout(() => setStatus(""), 4500);
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
        if (fieldBefore && looksLikeBoardingPass(fieldBefore.value)) return;

        showStatus("القارئ الاحتياطي: جاري تدوير وتحسين الصورة لقراءة PDF417...");
        try {
          const result = file.type.startsWith("image/")
            ? await scanImage(file, (message) => runId === activeRun.current && showStatus(message))
            : await scanPdf(file, (message) => runId === activeRun.current && showStatus(message));
          if (runId !== activeRun.current) return;

          const field = rawField();
          if (!field) throw new Error("boarding raw field unavailable");
          if (looksLikeBoardingPass(field.value)) {
            showStatus("تمت القراءة من القارئ الأساسي بنجاح.", true);
            return;
          }
          if (!result) {
            showStatus("ما انقرأ الباركود حتى بعد التدوير وتحسين التباين. استخدم القارئ الخارجي أو صورة أوضح.", true);
            return;
          }

          setNativeTextAreaValue(field, result.raw);
          showStatus(`تمت قراءة البوردنغ وتعبئة المعلومات تلقائياً — ${result.format || "PDF417"}.`, true);
          try { navigator.vibrate?.(100); } catch {}
        } catch (error) {
          console.error("ops robust barcode fallback", error);
          if (runId === activeRun.current) showStatus("تعذر تشغيل القارئ الاحتياطي. جرّب القارئ USB/Bluetooth أو صورة أوضح.", true);
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
