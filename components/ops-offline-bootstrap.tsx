"use client";

import { useEffect } from "react";

const REFRESH_KEY = "baghdad-ops-sw-refresh-v4";
const OPS_SW_URL = "/ops-sw.js?v=4";

export default function OpsOfflineBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let resetTimer: number | null = null;

    const onControllerChange = () => {
      if (cancelled) return;
      if (sessionStorage.getItem(REFRESH_KEY) === "1") return;
      sessionStorage.setItem(REFRESH_KEY, "1");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    resetTimer = window.setTimeout(() => sessionStorage.removeItem(REFRESH_KEY), 12_000);

    void navigator.serviceWorker.register(OPS_SW_URL, { scope: "/ops", updateViaCache: "none" }).then(async (registration) => {
      await navigator.serviceWorker.ready;
      if (cancelled) return;
      await registration.update();

      // Warm the scanner/PDF chunks after the v4 worker controls the page.
      // The worker uses network-first for these assets so an old iPhone cache
      // cannot keep an earlier ticket reader after a deployment.
      const warmScanner = () => {
        if (cancelled) return;
        void Promise.allSettled([
          fetch("/ops-build-version.txt", { cache: "no-store" }),
          import("barcode-detector/ponyfill"),
          import("pdfjs-dist"),
        ]);
      };
      const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
      if (idle) idle(warmScanner);
      else window.setTimeout(warmScanner, 800);
    }).catch((error) => console.warn("ops service worker", error));

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, []);

  return null;
}
