"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeBoardingPassRaw, parseIataBcbp } from "@/lib/boarding-pass";

export type HardwareScannerState = "ready" | "receiving" | "success" | "error";

export const HARDWARE_SCANNER_TEST_EVENT = "baghdad-lounge:hardware-scanner-test";
export const HARDWARE_SCANNER_TEST_ATTR = "data-ops-scanner-test";

type ScannerStatus = {
  state: HardwareScannerState;
  message: string;
  lastScanAt: number | null;
};

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;

const START_WINDOW_MS = 180;
const CHARACTER_TIMEOUT_MS = 750;
const AUTO_FINISH_MS = 500;
const TEST_CHARACTER_TIMEOUT_MS = 450;
const TEST_AUTO_FINISH_MS = 320;
const MAX_SCAN_LENGTH = 2048;

function isEditableTarget(target: EventTarget | null): target is EditableTarget {
  return (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    && !target.readOnly
    && !target.disabled;
}

function insertText(target: EventTarget | null, text: string) {
  if (!text || !isEditableTarget(target)) return;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(target, nextValue);
  const cursor = start + text.length;
  target.setSelectionRange(cursor, cursor);
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function scannerTestActive() {
  return typeof document !== "undefined" && document.documentElement.getAttribute(HARDWARE_SCANNER_TEST_ATTR) === "1";
}

export function useHardwareBarcodeScanner(options: {
  enabled: boolean;
  onScan: (raw: string) => void;
}) {
  const onScanRef = useRef(options.onScan);
  const [status, setStatus] = useState<ScannerStatus>({
    state: "ready",
    message: "جاهز للمسح المباشر",
    lastScanAt: null,
  });

  useEffect(() => {
    onScanRef.current = options.onScan;
  }, [options.onScan]);

  useEffect(() => {
    if (!options.enabled) return;

    let buffer = "";
    let active = false;
    let candidateM = false;
    let target: EventTarget | null = null;
    let lastKeyAt = 0;
    let candidateTimer: number | null = null;
    let finishTimer: number | null = null;

    let testBuffer = "";
    let testLastKeyAt = 0;
    let testFinishTimer: number | null = null;

    const clearTimers = () => {
      if (candidateTimer !== null) window.clearTimeout(candidateTimer);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
      candidateTimer = null;
      finishTimer = null;
    };

    const clearTestTimer = () => {
      if (testFinishTimer !== null) window.clearTimeout(testFinishTimer);
      testFinishTimer = null;
    };

    const reset = () => {
      clearTimers();
      buffer = "";
      active = false;
      candidateM = false;
      target = null;
      lastKeyAt = 0;
    };

    const restoreAsTyping = () => {
      const value = buffer || (candidateM ? "M" : "");
      insertText(target, value);
      reset();
    };

    const emitTestResult = () => {
      clearTestTimer();
      const captured = String(testBuffer || "").replace(/[\r\n]/g, "").trimEnd();
      testBuffer = "";
      testLastKeyAt = 0;
      if (!captured) return;

      const normalized = normalizeBoardingPassRaw(captured);
      const parsed = parseIataBcbp(normalized);
      const detail = {
        raw: captured,
        normalizedRaw: normalized,
        validIata: Boolean(parsed),
        length: captured.length,
        receivedAt: Date.now(),
        connectionMode: "USB / Bluetooth Keyboard-HID",
        parsed: parsed ? {
          passengerName: parsed.passengerName,
          pnr: parsed.pnr,
          origin: parsed.origin,
          destination: parsed.destination,
          carrier: parsed.carrier,
          flightNumber: parsed.flightNumber,
          flightDate: parsed.flightDate,
          seat: parsed.seat,
          checkInSequence: parsed.checkInSequence,
        } : null,
      };

      window.dispatchEvent(new CustomEvent(HARDWARE_SCANNER_TEST_EVENT, { detail }));
      setStatus({
        state: parsed ? "success" : "error",
        message: parsed
          ? `اختبار ناجح: ${parsed.passengerName} · ${parsed.flightNumber}`
          : "وصلت بيانات من القارئ، لكنها ليست Boarding Pass IATA صالحاً",
        lastScanAt: Date.now(),
      });
    };

    const scheduleTestFinish = () => {
      clearTestTimer();
      testFinishTimer = window.setTimeout(emitTestResult, TEST_AUTO_FINISH_MS);
    };

    const finish = () => {
      const raw = normalizeBoardingPassRaw(buffer);
      const parsed = parseIataBcbp(raw);
      if (!parsed) {
        setStatus({
          state: "error",
          message: "وصلت قراءة، لكنها ليست باركود بوردنغ IATA صالحاً",
          lastScanAt: Date.now(),
        });
        restoreAsTyping();
        return;
      }
      reset();
      setStatus({
        state: "success",
        message: `تمت القراءة: ${parsed.passengerName} · ${parsed.flightNumber}`,
        lastScanAt: Date.now(),
      });
      onScanRef.current(raw);
    };

    const scheduleFinish = () => {
      if (finishTimer !== null) window.clearTimeout(finishTimer);
      finishTimer = window.setTimeout(finish, AUTO_FINISH_MS);
    };

    const beginCandidate = (event: KeyboardEvent, currentTime: number) => {
      event.preventDefault();
      candidateM = true;
      target = event.target;
      lastKeyAt = currentTime;
      candidateTimer = window.setTimeout(restoreAsTyping, START_WINDOW_MS);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const currentTime = performance.now();

      // Diagnostic mode captures any rapid keyboard/HID payload, including a
      // short QR value. It deliberately bypasses the normal passenger flow so
      // a test scan can never register or alter a passenger.
      if (scannerTestActive()) {
        if (testBuffer && currentTime - testLastKeyAt > TEST_CHARACTER_TIMEOUT_MS) {
          emitTestResult();
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (testBuffer) {
            event.preventDefault();
            emitTestResult();
          }
          return;
        }
        if (event.key.length !== 1) return;
        event.preventDefault();
        testBuffer += event.key;
        testLastKeyAt = currentTime;
        setStatus({ state: "receiving", message: "وضع الاختبار: جاري استقبال بيانات القارئ...", lastScanAt: null });
        if (testBuffer.length > MAX_SCAN_LENGTH) {
          window.dispatchEvent(new CustomEvent(HARDWARE_SCANNER_TEST_EVENT, {
            detail: {
              raw: testBuffer.slice(0, MAX_SCAN_LENGTH),
              normalizedRaw: "",
              validIata: false,
              length: testBuffer.length,
              receivedAt: Date.now(),
              connectionMode: "USB / Bluetooth Keyboard-HID",
              parsed: null,
              error: "payload_too_long",
            },
          }));
          setStatus({ state: "error", message: "بيانات الاختبار أطول من الحد المسموح؛ راجع إعداد القارئ", lastScanAt: Date.now() });
          testBuffer = "";
          testLastKeyAt = 0;
          clearTestTimer();
          return;
        }
        scheduleTestFinish();
        return;
      }

      if (active && currentTime - lastKeyAt > CHARACTER_TIMEOUT_MS) {
        restoreAsTyping();
      }

      if (active) {
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          finish();
          return;
        }
        if (event.key.length !== 1) return;
        event.preventDefault();
        buffer += event.key;
        lastKeyAt = currentTime;
        if (buffer.length > MAX_SCAN_LENGTH) {
          setStatus({ state: "error", message: "القراءة أطول من الحد المسموح؛ تحقق من إعداد القارئ", lastScanAt: Date.now() });
          reset();
          return;
        }
        scheduleFinish();
        return;
      }

      if (candidateM) {
        if (currentTime - lastKeyAt <= START_WINDOW_MS && /^[1-4]$/.test(event.key)) {
          event.preventDefault();
          if (candidateTimer !== null) window.clearTimeout(candidateTimer);
          candidateTimer = null;
          candidateM = false;
          active = true;
          buffer = `M${event.key}`;
          lastKeyAt = currentTime;
          setStatus({ state: "receiving", message: "جاري استقبال بيانات البوردنغ من القارئ...", lastScanAt: null });
          scheduleFinish();
          return;
        }
        restoreAsTyping();
      }

      if (event.key === "M" || event.key === "m") beginCandidate(event, currentTime);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      clearTimers();
      clearTestTimer();
    };
  }, [options.enabled]);

  return status;
}
