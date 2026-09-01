"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeBoardingPassRaw, parseIataBcbp } from "@/lib/boarding-pass";

export type HardwareScannerState = "ready" | "receiving" | "success" | "error";

type ScannerStatus = {
  state: HardwareScannerState;
  message: string;
  lastScanAt: number | null;
};

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;

const START_WINDOW_MS = 180;
const CHARACTER_TIMEOUT_MS = 750;
const AUTO_FINISH_MS = 500;
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

    const clearTimers = () => {
      if (candidateTimer !== null) window.clearTimeout(candidateTimer);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
      candidateTimer = null;
      finishTimer = null;
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
    };
  }, [options.enabled]);

  return status;
}
