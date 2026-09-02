import { getVercelOidcToken } from "@vercel/oidc";
import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";

export const runtime = "nodejs";
export const maxDuration = 45;

const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

type OpenAIResponse = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };

export async function POST(request: Request) {
  const session = opsSessionFromRequest(request);
  if (!session) return Response.json({ error: "انتهت جلسة الموظف. سجل الدخول مرة ثانية." }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("ticket");
    if (!(file instanceof File)) return Response.json({ error: "اختر ملف PDF أو صورة للتذكرة." }, { status: 400 });
    if (!ACCEPTED_TYPES.has(file.type)) return Response.json({ error: "الملف غير مدعوم. استخدم PDF أو JPG أو PNG أو WEBP." }, { status: 415 });
    if (file.size > MAX_BYTES) return Response.json({ error: "حجم الملف كبير. الحد الأقصى 12 ميغابايت." }, { status: 413 });

    const openAiKey = process.env.OPENAI_API_KEY;
    let gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!openAiKey && !gatewayToken) gatewayToken = await getVercelOidcToken();
    if (!openAiKey && !gatewayToken) {
      return Response.json({ error: "خدمة القراءة الذكية غير مفعلة حالياً." }, { status: 503 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
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
              text: `You are reading an airline travel document for a Baghdad airport lounge operations desk. The file can be a full e-ticket, itinerary receipt, booking confirmation, boarding pass, or a multi-page PDF. Today is ${today}.

Extract the travel segment relevant to Baghdad International Airport (BGW). If there are several segments, choose the segment that departs BGW or arrives BGW and is the operationally relevant flight for the passenger; prefer the nearest upcoming/active segment when dates make that clear. Never use ticket issue date, booking creation date, payment date, or document print date as the flight date. Prefer scheduled departure time over boarding time. If only boarding time is visible, you may return it but explain that in note. Do not invent missing values.

Return passenger name, airline name and code, flight number, origin airport IATA code, destination airport IATA code, flight date YYYY-MM-DD, local scheduled time HH:MM in 24-hour format, seat, PNR/booking reference, ticket number, confidence, and a short note only when something needs review. Flight number should include airline code when clearly shown (example TK303). Airport codes should be three-letter IATA codes when visible or unambiguous.`,
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
      return Response.json({ error: "تعذرت القراءة الذكية للتذكرة حالياً." }, { status: 502 });
    }

    const payload = await response.json() as OpenAIResponse;
    const outputText = payload.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) return Response.json({ error: "لم أجد معلومات رحلة واضحة داخل الملف." }, { status: 422 });

    const details = JSON.parse(outputText) as Record<string, string | null>;
    return Response.json({ details });
  } catch (error) {
    console.error("Ops ticket extraction error", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "تعذرت قراءة التذكرة. جرّب PDF الأصلي أو صورة أوضح." }, { status: 500 });
  }
}
