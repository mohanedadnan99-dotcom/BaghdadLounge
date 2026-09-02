import { getVercelOidcToken } from "@vercel/oidc";
import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";
import { parseSearchableTicketText } from "@/lib/ops-pdf-ticket-reader";

export const runtime = "nodejs";
export const maxDuration = 45;

const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

type OpenAIResponse = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };

async function readSearchablePdf(bytes: Buffer) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: Uint8Array.from(bytes) }).promise;
    const pages = Math.min(pdf.numPages, 8);
    const parts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      parts.push(content.items
        .map((item) => ("str" in item ? String(item.str || "") : ""))
        .filter(Boolean)
        .join(" "));
    }
    const details = parseSearchableTicketText(parts.join("\n"));
    if (details?.flightNumber && (details.origin === "BGW" || details.destination === "BGW")) return details;
  } catch (error) {
    console.warn("Local searchable PDF ticket read failed", error instanceof Error ? error.message : "unknown");
  }
  return null;
}

export async function POST(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ error: "انتهت جلسة الموظف. سجل الدخول مرة ثانية." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("ticket");
    if (!(file instanceof File)) return Response.json({ error: "اختر ملف PDF أو صورة للتذكرة." }, { status: 400 });
    if (!ACCEPTED_TYPES.has(file.type)) return Response.json({ error: "الملف غير مدعوم. استخدم PDF أو JPG أو PNG أو WEBP." }, { status: 415 });
    if (file.size > MAX_BYTES) return Response.json({ error: "حجم الملف كبير. الحد الأقصى 12 ميغابايت." }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());

    // Searchable e-ticket PDFs are parsed locally first. This is faster, works
    // without AI credits, and avoids treating booking/manage QR codes as BCBP.
    if (file.type === "application/pdf") {
      const localDetails = await readSearchablePdf(bytes);
      if (localDetails) {
        return Response.json({ details: localDetails, source: "local_pdf_text" }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    let gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!openAiKey && !gatewayToken) gatewayToken = await getVercelOidcToken();
    if (!openAiKey && !gatewayToken) {
      return Response.json({ error: "ما لقيت نص رحلة قابل للقراءة داخل الملف، وخدمة قراءة الصور غير مفعلة حالياً." }, { status: 503 });
    }

    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
    const attachment = file.type === "application/pdf"
      ? { type: "input_file", filename: file.name || "ticket.pdf", file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl, detail: "high" };

    const useGateway = !openAiKey;
    const apiUrl = useGateway ? "https://ai-gateway.vercel.sh/v1/responses" : "https://api.openai.com/v1/responses";
    const apiKey = openAiKey || gatewayToken;
    const model = process.env.OPENAI_TICKET_MODEL || (useGateway ? "openai/gpt-5.6-sol" : "gpt-5.6");
    const today = new Date().toISOString().slice(0, 10);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        input: [{
          type: "message",
          role: "user",
          content: [
            attachment,
            {
              type: "input_text",
              text: `You are reading an airline travel document for a Baghdad International Airport lounge operations desk. The file can be a full e-ticket, itinerary receipt, booking confirmation, boarding pass, or multi-page PDF. Today is ${today}.

Your job is to extract the ACTUAL FLIGHT LEG that directly touches Baghdad International Airport (BGW), because lounge staff need the flight that physically departs from or arrives at Baghdad — not merely the passenger's final itinerary destination.

Rules:
1. If the itinerary contains multiple legs, choose the individual leg whose origin is BGW or whose destination is BGW.
2. Do NOT collapse a connection into the overall itinerary. Example: if the document headline says BGW → OTP but the legs are BGW → IST on TK0303 and IST → OTP on TK1043, return the BGW → IST leg and TK0303.
3. A historical/past ticket is still valid input. Extract its actual flight date even when it is earlier than today. Never replace a past flight date with transaction date, ticket issue date, booking creation date, payment date, email date, print date, or today's date.
4. Prefer scheduled departure time for a departure from BGW. For an arrival to BGW, return the scheduled local arrival time when that is the operationally relevant time shown. If only boarding time is visible, return it only when no scheduled flight time exists and explain this in note.
5. Preserve the airline flight designator as printed when clear, including meaningful leading zeros (for example TK0303 rather than inventing another flight number).
6. Passenger name comes from the passenger/ticket holder field, not the greeting if a more formal passenger field is available.
7. Reservation code / PNR and ticket number may appear on later pages. Search the whole document.
8. Seat may legitimately be absent on an e-ticket before check-in; return null instead of inventing it.
9. Do not infer a boarding gate unless it is explicitly shown. Do not invent missing values.

Return passenger name, airline name and code, flight number, origin airport IATA code, destination airport IATA code, flight date YYYY-MM-DD, relevant local scheduled time HH:MM in 24-hour format, seat, PNR/booking reference, ticket number, confidence, and a short note only when something genuinely needs staff review. Airport codes should be three-letter IATA codes when visible or unambiguous.`,
            },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "ops_ticket_details",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                passengerName: { type: ["string", "null"] },
                airlineName: { type: ["string", "null"] },
                airlineCode: { type: ["string", "null"] },
                flightNumber: { type: ["string", "null"] },
                origin: { type: ["string", "null"] },
                destination: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                time: { type: ["string", "null"] },
                seat: { type: ["string", "null"] },
                pnr: { type: ["string", "null"] },
                ticketNumber: { type: ["string", "null"] },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                note: { type: ["string", "null"] }
              },
              required: ["passengerName", "airlineName", "airlineCode", "flightNumber", "origin", "destination", "date", "time", "seat", "pnr", "ticketNumber", "confidence", "note"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const providerError = await response.text();
      console.error("Ops ticket extraction failed", response.status, providerError.slice(0, 800));
      if (response.status === 429) {
        return Response.json({ error: "خدمة قراءة الصور وصلت حد الاستخدام. ملفات PDF النصية تبقى تنقري محلياً." }, { status: 503 });
      }
      return Response.json({ error: "تعذرت القراءة الذكية للتذكرة حالياً." }, { status: 502 });
    }

    const payload = await response.json() as OpenAIResponse;
    const outputText = payload.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) return Response.json({ error: "لم أجد معلومات رحلة واضحة داخل الملف." }, { status: 422 });

    const details = JSON.parse(outputText) as Record<string, string | null>;
    return Response.json({ details, source: "ai" });
  } catch (error) {
    console.error("Ops ticket extraction error", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "تعذرت قراءة التذكرة. جرّب PDF الأصلي أو صورة أوضح." }, { status: 500 });
  }
}
