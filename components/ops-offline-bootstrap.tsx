"use client";

import { useEffect } from "react";

export default function OpsOfflineBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.register("/ops-sw.js", { scope: "/ops" }).then(async (registration) => {
      await navigator.serviceWorker.ready;
      if (cancelled) return;
      void registration.update();

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
    return () => { cancelled = true; };
  }, []);
  return null;
}
