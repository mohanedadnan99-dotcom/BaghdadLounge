import { BAGHDAD_AIRLINES } from "@/lib/airlines";

type TicketDetails = {
  name?: string;
  airline?: string;
  flightNumber?: string;
  date?: string;
  time?: string;
  tripType?: "departure" | "arrival";
};

declare global {
  interface Window {
    Tesseract?: {
      recognize: (source: File | HTMLCanvasElement, lang?: string, options?: Record<string, unknown>) => Promise<{ data: { text: string } }>;
    };
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<any> };
    };
  }
}

const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const AIRLINE_ALIASES: Record<string, string[]> = {
  IA: ["IRAQI AIRWAYS", "IRAQ AIRWAYS", "IRAQIAIRWAYS", "الخطوط الجوية العراقية", "الخطوط العراقيه"],
  UD: ["UR AIRLINES", "UR AIRLINE", "UR AIR", "خطوط أور", "اور للطيران"],
  TK: ["TURKISH AIRLINES", "TURK HAVA YOLLARI", "THY", "الخطوط الجوية التركية"],
  PC: ["PEGASUS", "PEGASUS AIRLINES", "بيغاسوس"],
  VF: ["AJET", "A JET", "ANADOLUJET"],
  QR: ["QATAR AIRWAYS", "QATAR", "الخطوط الجوية القطرية", "القطرية"],
  RJ: ["ROYAL JORDANIAN", "ROYAL JORDAN", "الملكية الأردنية", "الملكيه الاردنيه"],
  ME: ["MIDDLE EAST AIRLINES", "MEA", "طيران الشرق الأوسط", "طيران الشرق الاوسط"],
  FZ: ["FLYDUBAI", "FLY DUBAI", "فلاي دبي"],
  EK: ["EMIRATES", "طيران الإمارات", "طيران الامارات"],
  G9: ["AIR ARABIA", "العربية للطيران"],
  OV: ["SALAMAIR", "SALAM AIR", "طيران السلام"],
  MS: ["EGYPTAIR", "EGYPT AIR", "مصر للطيران"],
  NP: ["NILE AIR", "النيل للطيران"],
  XY: ["FLYNAS", "FLY NAS", "طيران ناس"],
  IR: ["IRAN AIR", "IRANAIR", "الخطوط الجوية الإيرانية"],
  W5: ["MAHAN AIR", "MAHAN", "ماهان"],
  XH: ["FLY CHAM", "FLYCHAM", "فلاي شام"],
};

function loadScript(src: string, marker: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-ticket-lib="${marker}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.ticketLib = marker;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${marker}`));
    document.head.appendChild(script);
  });
}

async function ensureTesseract() {
  if (!window.Tesseract) await loadScript(TESSERACT_SRC, "tesseract");
  if (!window.Tesseract) throw new Error("OCR unavailable");
  return window.Tesseract;
}

async function ensurePdfJs() {
  if (!window.pdfjsLib) await loadScript(PDFJS_SRC, "pdfjs");
  if (!window.pdfjsLib) throw new Error("PDF reader unavailable");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return window.pdfjsLib;
}

async function readImage(file: File) {
  const tesseract = await ensureTesseract();
  // Airline tickets are mostly Latin text. eng+ara improves Arabic passenger/airline labels when present.
  try {
    const result = await tesseract.recognize(file, "eng+ara", { preserve_interword_spaces: "1" });
    return result.data.text || "";
  } catch {
    const fallback = await tesseract.recognize(file, "eng");
    return fallback.data.text || "";
  }
}

async function readPdf(file: File) {
  const pdfjs = await ensurePdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const maxPages = Math.min(pdf.numPages || 1, 3);
  let text = "";
  for (let index = 1; index <= maxPages; index++) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    text += `\n---PAGE ${index}---\n${pageText}`;
  }
  if (text.replace(/\s+/g, " ").trim().length >= 120) return text;

  const tesseract = await ensureTesseract();
  for (let index = 1; index <= maxPages; index++) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 2.6 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    try {
      const result = await tesseract.recognize(canvas, "eng+ara", { preserve_interword_spaces: "1" });
      text += `\n---OCR PAGE ${index}---\n${result.data.text || ""}`;
    } catch {
      const result = await tesseract.recognize(canvas, "eng");
      text += `\n---OCR PAGE ${index}---\n${result.data.text || ""}`;
    }
  }
  return text;
}

function normalize(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/B[6G]W/gi, "BGW")
    .trim();
}

function linesOf(text: string) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function baghdadRelevantText(text: string) {
  const lines = linesOf(text);
  const picks: string[] = [];
  lines.forEach((line, i) => {
    if (/\bBGW\b|BAGHDAD|بغداد/i.test(line)) {
      for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) picks.push(lines[j]);
    }
  });
  const unique = [...new Set(picks)];
  return unique.length ? unique.join("\n") : text;
}

function flightCandidates(text: string) {
  const upper = text.toUpperCase();
  const candidates: Array<{ flight: string; index: number; score: number }> = [];
  const knownCodes = BAGHDAD_AIRLINES.map((a) => a.code.toUpperCase()).sort((a, b) => b.length - a.length);

  for (const code of knownCodes) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\s*[- ]?\\s*(\\d{2,4})\\b`, "g");
    for (const match of upper.matchAll(regex)) {
      const index = match.index ?? 0;
      const around = upper.slice(Math.max(0, index - 180), index + 220);
      let score = 20;
      if (/\bBGW\b|BAGHDAD/.test(around)) score += 80;
      if (/FLIGHT|FLT|FL NO|FLIGHT NO|DEPART|ARRIV|FROM|TO/.test(around)) score += 25;
      candidates.push({ flight: `${code}${match[1]}`, index, score });
    }
  }

  const generic = /\b([A-Z]{2,3})\s*[- ]?\s*(\d{2,4})\b/g;
  for (const match of upper.matchAll(generic)) {
    const code = match[1];
    if (!BAGHDAD_AIRLINES.some((a) => a.code.toUpperCase() === code)) continue;
    const index = match.index ?? 0;
    const around = upper.slice(Math.max(0, index - 180), index + 220);
    let score = 10;
    if (/\bBGW\b|BAGHDAD/.test(around)) score += 70;
    if (/FLIGHT|FLT|DEPART|ARRIV|FROM|TO/.test(around)) score += 20;
    candidates.push({ flight: `${code}${match[2]}`, index, score });
  }

  return candidates.sort((a, b) => b.score - a.score || a.index - b.index);
}

function findFlight(text: string) {
  return flightCandidates(text)[0]?.flight;
}

function findAirline(text: string, flightNumber?: string) {
  const upper = text.toUpperCase();
  const flightCode = flightNumber?.match(/^([A-Z0-9]{2,3})/)?.[1];
  if (flightCode) {
    const byCode = BAGHDAD_AIRLINES.find((airline) => airline.code.toUpperCase() === flightCode);
    if (byCode) return `${byCode.en} (${byCode.code})`;
  }

  let best: { airline: (typeof BAGHDAD_AIRLINES)[number]; score: number } | undefined;
  for (const airline of BAGHDAD_AIRLINES) {
    let score = 0;
    const aliases = [airline.en.toUpperCase(), airline.ar, ...(AIRLINE_ALIASES[airline.code] || [])];
    for (const alias of aliases) if (alias && (upper.includes(alias.toUpperCase()) || text.includes(alias))) score += alias.length;
    if (score && (!best || score > best.score)) best = { airline, score };
  }
  return best ? `${best.airline.en} (${best.airline.code})` : undefined;
}

const MONTHS: Record<string, string> = {
  JAN:"01", JANUARY:"01", FEB:"02", FEBRUARY:"02", MAR:"03", MARCH:"03", APR:"04", APRIL:"04", MAY:"05", JUN:"06", JUNE:"06",
  JUL:"07", JULY:"07", AUG:"08", AUGUST:"08", SEP:"09", SEPT:"09", SEPTEMBER:"09", OCT:"10", OCTOBER:"10", NOV:"11", NOVEMBER:"11", DEC:"12", DECEMBER:"12",
};

function validDate(year: number, month: number, day: number) {
  if (year < 2024 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function dateCandidates(text: string) {
  const upper = text.toUpperCase();
  const found: Array<{ value: string; index: number }> = [];
  const add = (value: string | undefined, index: number) => { if (value) found.push({ value, index }); };
  let match: RegExpExecArray | null;

  const ymd = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
  while ((match = ymd.exec(upper))) add(validDate(Number(match[1]), Number(match[2]), Number(match[3])), match.index);

  const dmy = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g;
  while ((match = dmy.exec(upper))) add(validDate(Number(match[3]), Number(match[2]), Number(match[1])), match.index);

  const textual = /\b(\d{1,2})\s+(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s*,?\s*(20\d{2})\b/g;
  while ((match = textual.exec(upper))) add(validDate(Number(match[3]), Number(MONTHS[match[2]]), Number(match[1])), match.index);

  const textual2 = /\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(\d{1,2})\s*,?\s*(20\d{2})\b/g;
  while ((match = textual2.exec(upper))) add(validDate(Number(match[3]), Number(MONTHS[match[1]]), Number(match[2])), match.index);

  return found;
}

function timeCandidates(text: string) {
  const upper = text.toUpperCase();
  const found: Array<{ value: string; index: number; score: number }> = [];
  const regex = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(AM|PM)?\b/g;
  for (const match of upper.matchAll(regex)) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3];
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    const index = match.index ?? 0;
    const around = upper.slice(Math.max(0, index - 70), index + 70);
    let score = 0;
    if (/DEPARTURE|DEPART|ARRIVAL|ARRIVE|SCHEDULED|STD|STA|TIME/.test(around)) score += 40;
    if (/BOARDING|GATE CLOSE|CHECK.?IN/.test(around)) score -= 35;
    if (/\bBGW\b|BAGHDAD/.test(around)) score += 25;
    found.push({ value: `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`, index, score });
  }
  return found;
}

function segmentAroundFlight(text: string, flightNumber?: string) {
  const upper = text.toUpperCase();
  let index = flightNumber ? upper.indexOf(flightNumber.toUpperCase()) : -1;
  if (index < 0) index = upper.indexOf("BGW");
  if (index < 0) return baghdadRelevantText(text);
  return text.slice(Math.max(0, index - 450), Math.min(text.length, index + 650));
}

function findDate(text: string, flightNumber?: string) {
  const segment = segmentAroundFlight(text, flightNumber);
  const local = dateCandidates(segment);
  if (local.length) return local[0].value;
  return dateCandidates(baghdadRelevantText(text))[0]?.value;
}

function findTime(text: string, flightNumber?: string) {
  const segment = segmentAroundFlight(text, flightNumber);
  const local = timeCandidates(segment).sort((a, b) => b.score - a.score || a.index - b.index);
  if (local[0]) return local[0].value;
  const broader = timeCandidates(baghdadRelevantText(text)).sort((a, b) => b.score - a.score || a.index - b.index);
  return broader[0]?.value;
}

function findTripType(text: string): "departure" | "arrival" | undefined {
  const upper = text.toUpperCase().replace(/\s+/g, " ");
  const routePatterns = [
    /\bBGW\b\s*(?:→|->|>|-|TO)\s*([A-Z]{3})\b/,
    /\b([A-Z]{3})\s*(?:→|->|>|-|TO)\s*BGW\b/,
  ];
  if (routePatterns[0].test(upper)) return "departure";
  if (routePatterns[1].test(upper)) return "arrival";

  if (/(?:FROM|ORIGIN|DEPARTURE FROM)\s*[:\-]?\s*(?:BAGHDAD|BGW)|(?:BAGHDAD|BGW)[^\n]{0,80}(?:TO|DESTINATION)/i.test(text)) return "departure";
  if (/(?:TO|DESTINATION|ARRIVAL TO)\s*[:\-]?\s*(?:BAGHDAD|BGW)|(?:FROM|ORIGIN)[^\n]{0,80}(?:BAGHDAD|BGW)/i.test(text)) return "arrival";

  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    if (!/\bBGW\b|BAGHDAD|بغداد/i.test(lines[i])) continue;
    const block = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join(" ").toUpperCase();
    if (/DEPART|FROM|ORIGIN/.test(block) && !/ARRIV/.test(block)) return "departure";
    if (/ARRIV|DESTINATION|\bTO\b/.test(block) && !/DEPART/.test(block)) return "arrival";
  }
  return undefined;
}

function cleanPassengerName(value: string) {
  return value
    .replace(/\b(MR|MRS|MS|MISS|MSTR|MASTER|DR)\b\.?/gi, " ")
    .replace(/\b(PASSENGER|TRAVELER|TRAVELLER|NAME|SURNAME|GIVEN NAME)\b/gi, " ")
    .replace(/[^A-Za-z\u0600-\u06ff'\- /]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[/\s]+|[/\s]+$/g, "")
    .trim();
}

function findName(text: string) {
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inline = line.match(/(?:PASSENGER(?:\s+NAME)?|TRAVEL(?:L)?ER|PAX|NAME)\s*[:\-]?\s*(.{5,55})$/i);
    if (inline?.[1]) {
      const candidate = cleanPassengerName(inline[1]);
      if (candidate.split(/\s+|\//).filter(Boolean).length >= 2 && candidate.length <= 50) return candidate.replace(/\//g, " ");
    }
    if (/^(PASSENGER(?:\s+NAME)?|TRAVEL(?:L)?ER|PAX|NAME)\s*[:\-]?$/i.test(line) && lines[i + 1]) {
      const candidate = cleanPassengerName(lines[i + 1]);
      if (candidate.split(/\s+|\//).filter(Boolean).length >= 2 && candidate.length <= 50) return candidate.replace(/\//g, " ");
    }
  }

  // E-ticket convention: SURNAME/GIVENNAME MR. Only accept a strong slash pattern to avoid inventing names.
  const slash = text.match(/\b([A-Z]{2,20})\/([A-Z]{2,20}(?:\s+[A-Z]{2,20})?)\s*(?:MR|MRS|MS|MISS|MSTR)?\b/);
  if (slash) return `${slash[2]} ${slash[1]}`.replace(/\s{2,}/g, " ").trim();
  return undefined;
}

function parseTicketText(raw: string): TicketDetails {
  const text = normalize(raw);
  const relevant = baghdadRelevantText(text);
  const flightNumber = findFlight(relevant) || findFlight(text);
  const details: TicketDetails = {
    airline: findAirline(relevant, flightNumber) || findAirline(text, flightNumber),
    flightNumber,
    date: findDate(relevant, flightNumber),
    time: findTime(relevant, flightNumber),
    tripType: findTripType(text),
    name: findName(text),
  };
  return Object.fromEntries(Object.entries(details).filter(([, value]) => Boolean(value))) as TicketDetails;
}

export async function extractTicketLocally(file: File): Promise<TicketDetails> {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") throw new Error("Unsupported ticket file");
  const raw = file.type === "application/pdf" ? await readPdf(file) : await readImage(file);
  if (!raw.trim()) throw new Error("No readable text found");
  const details = parseTicketText(raw);
  if (!Object.values(details).some(Boolean)) throw new Error("No ticket details found");
  return details;
}
