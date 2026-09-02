"use client";

import { useEffect } from "react";

const REFRESH_KEY = "baghdad-ops-sw-refresh";

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
    resetTimer = window.setTimeout(() => sessionStorage.removeItem(REFRESH_KEY), 8_000);

    void navigator.serviceWorker.register("/ops-sw.js", { scope: "/ops", updateViaCache: "none" }).then(async (registration) => {
      await navigator.serviceWorker.ready;
      if (cancelled) return;
      await registration.update();

      // Warm the scanner's lazy chunks after the worker controls the page.
      // This keeps the door fast now and makes camera/image/PDF reading
      // available during the first network outage, not only after first use.
      const warmScanner = () => {
        if (cancelled) return;
        void Promise.allSettled([
          import("barcode-detector/ponyfill"),
          import("pdfjs-dist"),
        ]);
      };
      const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
      if (idle) idle(warmScanner);
      else window.setTimeout(warmScanner, 1_000);
    }).catch((error) => console.warn("ops service worker", error));

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, []);

  return null;
}
