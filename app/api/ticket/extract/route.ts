import { AIRLINE_VALUES } from "@/lib/airlines";

export const runtime = "nodejs";
export const maxDuration = 45;

const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

type OpenAIResponse = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "خدمة قراءة التذكرة قيد التفعيل حالياً. يمكنك إكمال الحجز يدوياً." }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("ticket");
    if (!(file instanceof File)) return Response.json({ error: "يرجى اختيار صورة أو ملف PDF للتذكرة." }, { status: 400 });
    if (!ACCEPTED_TYPES.has(file.type)) return Response.json({ error: "الملف غير مدعوم. استخدم صورة JPG أو PNG أو ملف PDF." }, { status: 415 });
    if (file.size > MAX_BYTES) return Response.json({ error: "حجم الملف كبير. الحد الأقصى 10 ميغابايت." }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
    const attachment = file.type === "application/pdf"
      ? { type: "input_file", filename: file.name || "ticket.pdf", file_data: dataUrl, detail: "high" }
      : { type: "input_image", image_url: dataUrl, detail: "high" };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TICKET_MODEL || "gpt-5.6",
        store: false,
        input: [{ role: "user", content: [
          attachment,
          { type: "input_text", text: `Read this airline ticket or boarding pass. Extract only information clearly visible in the file. Convert the flight date to YYYY-MM-DD and local scheduled time to HH:MM (24-hour). Determine tripType relative to Baghdad International Airport BGW: departure if flying from BGW, arrival if flying to BGW, otherwise null. Match airline exactly to one of these values when possible: ${AIRLINE_VALUES.join(", ")}. Return null for uncertain or absent values.` },
        ] }],
        text: { format: { type: "json_schema", name: "ticket_details", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            name: { type: ["string", "null"] }, airline: { type: ["string", "null"] },
            flightNumber: { type: ["string", "null"] }, date: { type: ["string", "null"] },
            time: { type: ["string", "null"] }, tripType: { type: ["string", "null"], enum: ["departure", "arrival", null] },
          }, required: ["name", "airline", "flightNumber", "date", "time", "tripType"],
        } } },
      }),
    });

    if (!response.ok) {
      console.error("Ticket extraction failed", response.status);
      return Response.json({ error: "تعذرت قراءة التذكرة حالياً. يمكنك تعبئة المعلومات يدوياً." }, { status: 502 });
    }

    const payload = await response.json() as OpenAIResponse;
    const outputText = payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!outputText) return Response.json({ error: "لم نتمكن من قراءة معلومات واضحة من التذكرة." }, { status: 422 });

    const details = JSON.parse(outputText) as Record<string, string | null>;
    return Response.json({ details });
  } catch (error) {
    console.error("Ticket extraction error", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "تعذرت قراءة التذكرة. جرّب صورة أوضح أو أكمل الحجز يدوياً." }, { status: 500 });
  }
}
