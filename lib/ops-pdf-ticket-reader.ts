export type LocalTicketDetails = {
  passengerName?: string | null;
  airlineName?: string | null;
  airlineCode?: string | null;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  date?: string | null;
  time?: string | null;
  seat?: string | null;
  pnr?: string | null;
  ticketNumber?: string | null;
  confidence?: "high" | "medium" | "low";
  note?: string | null;
};

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function normalizeText(value: string) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u00ad\u200b\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDate(text: string) {
  const monthNames = Object.keys(MONTHS).join("|");
  const direct = text.match(new RegExp(`Baghdad\\s*\\(BGW\\)\\s*-\\s*[^]{0,220}?\\([A-Z]{3}\\)\\s+(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`, "i"));
  const nearby = text.match(new RegExp(`\\(BGW\\)[^]{0,260}?(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`, "i"));
  const match = direct || nearby;
  if (!match) return null;
  const [, day, monthName, year] = match;
  return `${year}-${MONTHS[monthName.toLowerCase()]}-${day.padStart(2, "0")}`;
}

function extractPassenger(text: string) {
  return text.match(/Dear,\s*([A-Z][A-Z .'-]{2,60}?)(?=\s+As\s)/i)?.[1]?.trim()
    || text.match(/Passenger Name\s*\/\s*Surname[^]{0,100}?\b([A-Z][A-Z .'-]{2,60})\s+\d{13}\b/i)?.[1]?.trim()
    || null;
}

type Segment = {
  airlineName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  time: string;
};

function chooseBaghdadSegment(text: string): Segment | null {
  const segments: Segment[] = [];
  const flightPattern = /Airline\s*-\s*Flight no:\s*([A-Za-zÀ-ÿ &.'-]+?)\s*-\s*([A-Z0-9]{2,3}\s*0*\d{2,4})\b/gi;

  for (const match of text.matchAll(flightPattern)) {
    const index = match.index || 0;
    const before = text.slice(Math.max(0, index - 900), index);
    const after = text.slice(index + match[0].length, index + match[0].length + 520);
    const detailMarker = before.toLowerCase().lastIndexOf("flight details");
    const localBefore = detailMarker >= 0 ? before.slice(detailMarker) : before;

    const origins = [...localBefore.matchAll(/\(([A-Z]{3})\)/g)].map((item) => item[1]);
    const destinations = [...after.matchAll(/\(([A-Z]{3})\)/g)].map((item) => item[1]);
    const times = [...localBefore.matchAll(/([0-2]\d:[0-5]\d)/g)].map((item) => item[1]);

    const origin = origins.at(-1) || "";
    const destination = destinations[0] || "";
    const time = times.at(-1) || "";
    if (!origin || !destination) continue;

    segments.push({
      airlineName: match[1].trim(),
      flightNumber: match[2].replace(/\s+/g, "").toUpperCase(),
      origin,
      destination,
      time,
    });
  }

  return segments.find((segment) => segment.origin === "BGW")
    || segments.find((segment) => segment.destination === "BGW")
    || null;
}

export function parseSearchableTicketText(rawText: string): LocalTicketDetails | null {
  const text = normalizeText(rawText);
  if (text.length < 80) return null;

  const segment = chooseBaghdadSegment(text);
  if (!segment) return null;

  const passenger = extractPassenger(text);
  const date = extractDate(text);
  const pnr = text.match(/Reservation code\s+([A-Z0-9]{5,8})\b/i)?.[1]?.toUpperCase() || null;
  const ticketNumber = text.match(/\b(\d{13})\b/)?.[1] || null;
  const airlineCode = segment.flightNumber.match(/^([A-Z0-9]{2,3})/)?.[1] || null;
  const seat = text.match(/\bSeat(?: number)?\s*[:\-]?\s*([0-9]{1,3}[A-Z])\b/i)?.[1]?.toUpperCase() || null;
  const strong = Boolean(passenger && date && segment.time && segment.flightNumber && segment.origin && segment.destination);

  return {
    passengerName: passenger,
    airlineName: segment.airlineName,
    airlineCode,
    flightNumber: segment.flightNumber,
    origin: segment.origin,
    destination: segment.destination,
    date,
    time: segment.time || null,
    seat,
    pnr,
    ticketNumber,
    confidence: strong ? "high" : "medium",
    note: strong
      ? "تمت القراءة محلياً من نص ملف PDF بدون الاعتماد على خدمة خارجية."
      : "تمت قراءة بيانات التذكرة محلياً؛ راجع الحقول الناقصة قبل التأكيد.",
  };
}

export async function extractSearchablePdfTicket(file: File, onProgress?: (message: string) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, 8);
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    onProgress?.(`جاري قراءة نص صفحة ${pageNumber} من ${pages} محلياً...`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? String(item.str || "") : ""))
      .filter(Boolean)
      .join(" ");
    pageTexts.push(text);
  }

  return parseSearchableTicketText(pageTexts.join("\n"));
}
