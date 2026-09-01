export type BoardingPassData = {
  formatCode: "M";
  legs: number;
  passengerName: string;
  electronicTicketIndicator: string;
  pnr: string;
  origin: string;
  destination: string;
  carrier: string;
  flightNumber: string;
  flightNumberNumeric: string;
  julianDate: string;
  flightDate: string;
  compartment: string;
  seat: string;
  checkInSequence: string;
  passengerStatus: string;
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export function normalizeBoardingPassRaw(rawInput: string) {
  const singleLine = String(rawInput || "")
    .replace(/[\r\n]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trimEnd();
  const start = singleLine.search(/M[1-4]/i);
  return (start >= 0 ? singleLine.slice(start) : singleLine).trimEnd();
}

function julianDateToIso(julianDate: string, now = new Date()) {
  const day = Number(julianDate);
  if (!Number.isInteger(day) || day < 1 || day > 366) return "";
  const currentYear = now.getUTCFullYear();
  const candidates = [currentYear - 1, currentYear, currentYear + 1]
    .map((year) => {
      const date = new Date(Date.UTC(year, 0, day));
      return date.getUTCFullYear() === year ? date : null;
    })
    .filter((date): date is Date => Boolean(date));
  const closest = candidates.sort((first, second) => Math.abs(first.getTime() - now.getTime()) - Math.abs(second.getTime() - now.getTime()))[0];
  return closest ? closest.toISOString().slice(0, 10) : "";
}

export function parseIataBcbp(rawInput: string): BoardingPassData | null {
  const raw = normalizeBoardingPassRaw(rawInput);
  if (raw.length < 58 || raw[0].toUpperCase() !== "M") return null;

  const legs = Number(raw[1]);
  if (!Number.isInteger(legs) || legs < 1 || legs > 4) return null;

  const passengerName = clean(raw.slice(2, 22)).replace(/\//g, " ");
  const electronicTicketIndicator = clean(raw.slice(22, 23));
  const pnr = clean(raw.slice(23, 30));
  const origin = clean(raw.slice(30, 33)).toUpperCase();
  const destination = clean(raw.slice(33, 36)).toUpperCase();
  const carrier = clean(raw.slice(36, 39)).toUpperCase();
  const flightNumberNumeric = clean(raw.slice(39, 44)).replace(/^0+/, "") || "0";
  const flightNumber = `${carrier}${flightNumberNumeric}`.replace(/\s+/g, "");
  const julianDate = clean(raw.slice(44, 47));
  const compartment = clean(raw.slice(47, 48));
  const seat = clean(raw.slice(48, 52)).replace(/^0+/, "");
  const checkInSequence = clean(raw.slice(52, 57)).replace(/^0+/, "") || "0";
  const passengerStatus = clean(raw.slice(57, 58));

  const hasRoute = /^[A-Z]{3}$/.test(origin) && /^[A-Z]{3}$/.test(destination);
  const hasFlight = /^(?=.*[A-Z])[A-Z0-9]{2,3}$/.test(carrier) && /^\d{1,5}$/.test(flightNumberNumeric);
  if (!passengerName || !hasRoute || !hasFlight) return null;

  return {
    formatCode: "M",
    legs,
    passengerName,
    electronicTicketIndicator,
    pnr,
    origin,
    destination,
    carrier,
    flightNumber,
    flightNumberNumeric,
    julianDate,
    flightDate: julianDateToIso(julianDate),
    compartment,
    seat,
    checkInSequence,
    passengerStatus,
  };
}
