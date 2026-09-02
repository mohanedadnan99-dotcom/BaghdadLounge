export const BAGHDAD_AIRLINES = [
  { code: "IA", ar: "الخطوط الجوية العراقية", en: "Iraqi Airways" },
  { code: "UD", ar: "خطوط أور الجوية", en: "UR Airlines" },
  { code: "IF", ar: "فلاي بغداد", en: "Fly Baghdad" },
  { code: "IG", ar: "غلوبال إيرلاينز العراق", en: "Global Airlines Iraq" },
  { code: "B2H", ar: "طيران البصرة", en: "Basra Airlines" },
  { code: "TK", ar: "الخطوط الجوية التركية", en: "Turkish Airlines" },
  { code: "PC", ar: "بيغاسوس", en: "Pegasus Airlines" },
  { code: "VF", ar: "إيه جت", en: "AJet" },
  { code: "A3", ar: "الخطوط الجوية الإيجية", en: "Aegean Airlines" },
  { code: "QR", ar: "الخطوط الجوية القطرية", en: "Qatar Airways" },
  { code: "RJ", ar: "الملكية الأردنية", en: "Royal Jordanian" },
  { code: "ME", ar: "طيران الشرق الأوسط", en: "Middle East Airlines" },
  { code: "FZ", ar: "فلاي دبي", en: "flydubai" },
  { code: "EK", ar: "طيران الإمارات", en: "Emirates" },
  { code: "G9", ar: "العربية للطيران", en: "Air Arabia" },
  { code: "OV", ar: "طيران السلام", en: "SalamAir" },
  { code: "MS", ar: "مصر للطيران", en: "EgyptAir" },
  { code: "NP", ar: "النيل للطيران", en: "Nile Air" },
  { code: "XY", ar: "طيران ناس", en: "flynas" },
  { code: "IR", ar: "الخطوط الجوية الإيرانية", en: "Iran Air" },
  { code: "B9", ar: "إيران إير تور", en: "Iran Airtour" },
  { code: "W5", ar: "ماهان إير", en: "Mahan Air" },
  { code: "IV", ar: "قزوين للطيران", en: "Caspian Airlines" },
  { code: "IS", ar: "سبهران للطيران", en: "Sepehran Airlines" },
  { code: "XH", ar: "فلاي شام", en: "Fly Cham" },
  { code: "H7", ar: "هوك إير للطيران", en: "Hawkair Aviation" },
] as const;

export const OTHER_AIRLINE = { code: "OTHER", ar: "شركة طيران أخرى", en: "Other airline" } as const;

export const AIRLINE_VALUES = [
  ...BAGHDAD_AIRLINES.map((airline) => `${airline.en} (${airline.code})`),
  `${OTHER_AIRLINE.en} (${OTHER_AIRLINE.code})`,
];

export type BaghdadAirline = (typeof BAGHDAD_AIRLINES)[number];

const AIRLINE_BY_CODE = new Map(
  BAGHDAD_AIRLINES.map((airline) => [airline.code.toUpperCase(), airline] as const),
);

/**
 * Converts every airline representation used by the booking form, the door
 * form and IATA BCBP into one stable carrier code. Pricing must always key off
 * this value rather than a translated/display name.
 */
export function normalizeAirlineCode(value: unknown, flightNumber?: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  if (AIRLINE_BY_CODE.has(raw)) return raw;

  const parenthesized = raw.match(/\(([A-Z0-9]{2,3})\)\s*$/)?.[1];
  if (parenthesized && AIRLINE_BY_CODE.has(parenthesized)) return parenthesized;

  for (const airline of BAGHDAD_AIRLINES) {
    const code = airline.code.toUpperCase();
    if (raw === airline.en.toUpperCase() || raw === airline.ar.toUpperCase() || raw.endsWith(`(${code})`)) {
      return code;
    }
  }

  const flight = String(flightNumber || "").trim().toUpperCase().replace(/\s+/g, "");
  // IATA flight designators are two alphanumeric characters. Match exactly
  // two here so the first flight-number digit never becomes part of the code
  // (for example TK0843 must resolve to TK, not TK0).
  const flightPrefix = flight.match(/^([A-Z0-9]{2})(?=\d)/)?.[1];
  if (flightPrefix && AIRLINE_BY_CODE.has(flightPrefix)) return flightPrefix;

  // Unknown but structurally valid carriers are kept so the owner can add a
  // profile later without changing the scanner.
  if (/^[A-Z0-9]{2,3}$/.test(raw)) return raw;
  if (parenthesized && /^[A-Z0-9]{2,3}$/.test(parenthesized)) return parenthesized;
  return "";
}

export function getAirlineByCode(value: unknown) {
  return AIRLINE_BY_CODE.get(normalizeAirlineCode(value));
}

export function airlineDisplayName(value: unknown, flightNumber?: unknown) {
  const code = normalizeAirlineCode(value, flightNumber);
  const airline = AIRLINE_BY_CODE.get(code);
  return airline ? `${airline.en} (${airline.code})` : String(value || code).trim();
}
