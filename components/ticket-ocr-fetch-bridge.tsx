"use client";

import { useEffect } from "react";
import { extractTicketLocally } from "@/lib/ticket-local-ocr";

export function TicketOcrFetchBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isTicketExtraction = url === "/api/ticket/extract" || url.endsWith("/api/ticket/extract");

      if (!isTicketExtraction || init?.method?.toUpperCase() !== "POST" || !(init.body instanceof FormData)) {
        return originalFetch(input, init);
      }

      try {
        const ticket = init.body.get("ticket");
        if (!(ticket instanceof File)) {
          return new Response(JSON.stringify({ error: "يرجى اختيار صورة أو ملف PDF للتذكرة." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const details = await extractTicketLocally(ticket);
        return new Response(JSON.stringify({ details }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Local ticket OCR failed", error instanceof Error ? error.message : "unknown");
        return new Response(JSON.stringify({ error: "تعذرت قراءة التذكرة. جرّب صورة أوضح أو أكمل الحجز يدوياً." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
