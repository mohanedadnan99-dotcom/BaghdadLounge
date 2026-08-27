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
