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
      recognize: (source: File | HTMLCanvasElement, lang?: string) => Promise<{ data: { text: string } }>;
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
  const result = await tesseract.recognize(file, "eng");
  return result.data.text || "";
}

async function readPdf(file: File) {
  const pdfjs = await ensurePdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const maxPages = Math.min(pdf.numPages || 1, 2);
  let text = "";
  for (let index = 1; index <= maxPages; index++) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    text += "\n" + content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
  }
  if (text.replace(/\s+/g, " ").trim().length >= 80) return text;

  const tesseract = await ensureTesseract();
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) return text;
  await page.render({ canvasContext: context, viewport }).promise;
  const result = await tesseract.recognize(canvas, "eng");
  return `${text}\n${result.data.text || ""}`;
}

function normalize(value: string) {
  return value.replace(/\r/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

function findFlight(text: string) {
  const upper = text.toUpperCase();
  const knownCodes = BAGHDAD_AIRLINES.map((a) => a.code.toUpperCase()).sort((a, b) => b.length - a.length);
  for (const code of knownCodes) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = upper.match(new RegExp(`\\b${escaped}\\s?[-]?\\s?(\\d{2,4})\\b`));
    if (match) return `${code}${match[1]}`;
  }
  const generic = upper.match(/\b([A-Z]{2,3})\s?[-]?\s?(\d{2,4})\b/);
  return generic ? `${generic[1]}${generic[2]}` : undefined;
}

function findAirline(text: string, flightNumber?: string) {
  const upper = text.toUpperCase();
  const flightCode = flightNumber?.match(/^([A-Z0-9]{2,3})/)?.[1];
  const found = BAGHDAD_AIRLINES.find((airline) =>
    airline.code.toUpperCase() === flightCode ||
    upper.includes(airline.en.toUpperCase()) ||
    text.includes(airline.ar)
  );
  return found ? `${found.en} (${found.code})` : undefined;
}

const MONTHS: Record<string, string> = {
  JAN:"01", JANUARY:"01", FEB:"02", FEBRUARY:"02", MAR:"03", MARCH:"03", APR:"04", APRIL:"04", MAY:"05", JUN:"06", JUNE:"06",
  JUL:"07", JULY:"07", AUG:"08", AUGUST:"08", SEP:"09", SEPT:"09", SEPTEMBER:"09", OCT:"10", OCTOBER:"10", NOV:"11", NOVEMBER:"11", DEC:"12", DECEMBER:"12",
};

function validDate(year: number, month: number, day: number) {
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function findDate(text: string) {
  const upper = text.toUpperCase();
  let match = upper.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = upper.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  const monthMatch = upper.match(/\b(\d{1,2})\s+(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(20\d{2})\b/);
  if (monthMatch) return validDate(Number(monthMatch[3]), Number(MONTHS[monthMatch[2]]), Number(monthMatch[1]));
  return undefined;
}

function findTime(text: string) {
  const upper = text.toUpperCase();
  const labels = ["DEPARTURE", "DEPART", "ARRIVAL", "ARRIVE", "BOARDING", "TIME"];
  for (const label of labels) {
    const index = upper.indexOf(label);
    if (index >= 0) {
      const nearby = upper.slice(index, index + 100);
      const match = nearby.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
      if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    }
  }
  const match = upper.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return match ? `${match[1].padStart(2,"0")}:${match[2]}` : undefined;
}

function findTripType(text: string): "departure" | "arrival" | undefined {
  const upper = text.toUpperCase();
  const bgw = upper.indexOf("BGW");
  if (bgw < 0) return undefined;
  const around = upper.slice(Math.max(0, bgw - 100), bgw + 120);
  if (/FROM\s+(?:BAGHDAD|BGW)|DEPART(?:URE|ING)?[^\n]{0,50}(?:BAGHDAD|BGW)/.test(around)) return "departure";
  if (/TO\s+(?:BAGHDAD|BGW)|ARRIV(?:AL|E|ING)[^\n]{0,50}(?:BAGHDAD|BGW)/.test(around)) return "arrival";
  const route = upper.match(/\b([A-Z]{3})\s*(?:→|->|-|TO)\s*([A-Z]{3})\b/);
  if (route?.[1] === "BGW") return "departure";
  if (route?.[2] === "BGW") return "arrival";
  return undefined;
}

function findName(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inline = line.match(/(?:PASSENGER(?:\s+NAME)?|TRAVELER|NAME)\s*[:\-]?\s*([A-Z][A-Z' -]{5,45})/i);
    if (inline?.[1]) return inline[1].replace(/\s{2,}/g," ").trim();
    if (/^(PASSENGER(?:\s+NAME)?|TRAVELER|NAME)\s*[:\-]?$/i.test(line) && lines[i+1]) {
      const candidate = lines[i+1].replace(/[^A-Za-z' -]/g, " ").replace(/\s{2,}/g," ").trim();
      if (candidate.split(" ").length >= 2) return candidate;
    }
  }
  return undefined;
}

function parseTicketText(raw: string): TicketDetails {
  const text = normalize(raw);
  const flightNumber = findFlight(text);
  return {
    name: findName(text),
    airline: findAirline(text, flightNumber),
    flightNumber,
    date: findDate(text),
    time: findTime(text),
    tripType: findTripType(text),
  };
}

export async function extractTicketLocally(file: File): Promise<TicketDetails> {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") throw new Error("Unsupported ticket file");
  const raw = file.type === "application/pdf" ? await readPdf(file) : await readImage(file);
  if (!raw.trim()) throw new Error("No readable text found");
  const details = parseTicketText(raw);
  if (!Object.values(details).some(Boolean)) throw new Error("No ticket details found");
  return details;
}
