"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Banknote,
  Camera,
  CheckCircle2,
  CloudUpload,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  LogOut,
  Pencil,
  Plane,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  Trash2,
  Upload,
  Usb,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { BAGHDAD_AIRLINES, normalizeAirlineCode } from "@/lib/airlines";
import { normalizeBoardingPassRaw, parseIataBcbp } from "@/lib/boarding-pass";
import {
  createClientMutationId,
  clearOpsCache,
  listOfflineEntries,
  loadOpsCache,
  queueOfflineEntry,
  removeOfflineEntry,
  saveOpsCache,
  updateOfflineEntry,
  type OfflineEntryMutation,
} from "@/lib/ops-offline";
import { useHardwareBarcodeScanner } from "@/lib/use-hardware-barcode-scanner";
import styles from "./door.module.css";

type User = { employeeId?: number; id?: number; name: string; username: string; role: string; assignedShift: string; loungeName?: string };
type Shift = { id: number; shift_name: string; lounge_name?: string; opened_at: string } | null;
type PassengerStatus = "inside" | "called" | "departed";
type ShiftRecipient = { id: number; name: string; username: string; assigned_shift: string; role: string };
type LoungePassenger = {
  id: number;
  reference: string;
  passenger_name: string;
  airline: string;
  flight_number: string;
  destination: string;
  seat: string;
  departure_at: string | null;
  gate_number: string;
  lounge_status: PassengerStatus;
  gate_called_at: string | null;
  gate_departed_at: string | null;
  created_at: string;
  employee_name: string;
};
type PendingHandover = {
  id: number;
  outgoing_employee_name: string;
  outgoing_shift_name: string;
  passengers_snapshot: LoungePassenger[];
  handover_note: string;
  expected_cash_iqd: number;
  closing_cash_iqd: number;
  cash_difference_iqd: number;
  created_at: string;
};
type EntryState = {
  passengerName: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  seat: string;
  departureAt: string;
  gateNumber: string;
  paymentType: string;
  billingCompany: string;
  amountIqd: string;
  boardingRaw: string;
  notes: string;
};
type AirlineOfflinePrice = { code:string;nameAr:string;nameEn:string;loungeName:string;basePriceIqd:number;discountType:string;discountValue:number;discountFrom:string|null;discountTo:string|null;paymentType:string;active:boolean;discountActive:boolean;finalPriceIqd:number;updatedAt:string };
type AirlineOfflineConfig = { loungeName:string;airlines:AirlineOfflinePrice[];defaultPriceIqd:number;childFreeUnder?:number;version:string;generatedAt:string };
type PricingInfo = { label:string;priceIqd:number;basePriceIqd?:number;paymentType:string;discountActive?:boolean;source:string;cached?:boolean;updatedAt?:string };

const paymentLabels = [
  ["cash", "نقدي"],
  ["electronic", "دفع إلكتروني"],
  ["credit", "آجل / حساب شركة"],
  ["prepaid", "مدفوع مسبقاً"],
  ["voucher", "Voucher / قسيمة"],
  ["complimentary", "مجاني"],
];
const scanFormats = ["qr_code", "pdf417", "aztec", "data_matrix"] as const;
const hardwareStateLabels = {
  ready: "جاهز",
  receiving: "يقرأ الآن",
  success: "قراءة ناجحة",
  error: "راجع القارئ",
};
const blankEntry = (): EntryState => ({
  passengerName: "",
  airline: "",
  flightNumber: "",
  origin: "",
  destination: "",
  seat: "",
  departureAt: "",
  gateNumber: "",
  paymentType: "cash",
  billingCompany: "",
  amountIqd: "40000",
  boardingRaw: "",
  notes: "",
});

export default function OpsStaffPage() {
  const [user, setUser] = useState<User | null>(null);
  const [shift, setShift] = useState<Shift>(null);
  const [shiftRecipients, setShiftRecipients] = useState<ShiftRecipient[]>([]);
  const [pendingHandover, setPendingHandover] = useState<PendingHandover | null>(null);
  const [showHandover, setShowHandover] = useState(false);
  const [handoverForm, setHandoverForm] = useState({ incomingEmployeeId: "", note: "", closingCashIqd: "" });
  const [handoverSaving, setHandoverSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [entry, setEntry] = useState<EntryState>(blankEntry());
  const [passengers, setPassengers] = useState<LoungePassenger[]>([]);
  const [passengersLoading, setPassengersLoading] = useState(false);
  const [passengerQuery, setPassengerQuery] = useState("");
  const [pendingPassengerId, setPendingPassengerId] = useState<number | null>(null);
  const [editingPassenger, setEditingPassenger] = useState<LoungePassenger | null>(null);
  const [editFlight, setEditFlight] = useState({ departureAt: "", gateNumber: "", reason: "" });
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cameraOn, setCameraOn] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const [online, setOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineEntryMutation[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [airlineConfig, setAirlineConfig] = useState<AirlineOfflineConfig | null>(null);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [specialPricing, setSpecialPricing] = useState({ category: "adult", age: "", code: "" });
  const [showSpecialPricing, setShowSpecialPricing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);
  const detectorPromise = useRef<Promise<{
    detect: (source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) => Promise<Array<{ rawValue: string; format: string }>>;
  }> | null>(null);
  const alertedPassengerIds = useRef(new Set<number>());
  const alertsArmedRef = useRef(false);
  const offlineFlushRef = useRef(false);

  const employeeIdOf = (value: User | null) => Number(value?.employeeId || value?.id || 0);

  async function refreshOfflineQueue() {
    const rows = await listOfflineEntries();
    setOfflineQueue(rows);
    return rows;
  }

  async function refreshSession() {
    try {
      const res = await fetch("/api/ops/session", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        setShift(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      await saveOpsCache("session", data.user);
      setLoading(false);
      await Promise.all([refreshShift(employeeIdOf(data.user)), refreshOfflineQueue()]);
    } catch {
      const cached = await loadOpsCache<User>("session");
      const freshEnough = cached && Date.now() - new Date(cached.savedAt).getTime() < 12 * 60 * 60_000;
      if (freshEnough && cached) {
        setUser(cached.value);
        setMessage("الاتصال منقطع — تم فتح آخر شفت محفوظ على هذا الجهاز");
        await Promise.all([refreshShift(employeeIdOf(cached.value)), refreshOfflineQueue()]);
      } else {
        setUser(null);
        setShift(null);
      }
      setLoading(false);
    }
  }

  async function refreshShift(employeeId = employeeIdOf(user)) {
    try {
      const res = await fetch("/api/ops/shift", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setShift(data.shift || null);
      setShiftRecipients(Array.isArray(data.recipients) ? data.recipients : []);
      setPendingHandover(data.pendingHandover || null);
      if (employeeId) await saveOpsCache(`shift:${employeeId}`, data);
    } catch {
      if (!employeeId) return;
      const cached = await loadOpsCache<any>(`shift:${employeeId}`);
      if (!cached) return;
      setShift(cached.value.shift || null);
      setShiftRecipients(Array.isArray(cached.value.recipients) ? cached.value.recipients : []);
      setPendingHandover(cached.value.pendingHandover || null);
    }
  }

  async function refreshPassengers(silent = false) {
    if (!silent) setPassengersLoading(true);
    const loungeName = String(shift?.lounge_name || user?.loungeName || "لاونج بغداد");
    try {
      const res = await fetch("/api/ops/entries", { cache: "no-store" });
      if (!res.ok) throw new Error("passengers request failed");
      const data = await res.json();
      const rows = Array.isArray(data.passengers) ? data.passengers as LoungePassenger[] : [];
      setPassengers(rows);
      await saveOpsCache(`passengers:${loungeName}`, rows);
      setNow(Date.now());
      notifyCriticalPassengers(rows);
    } catch {
      const cached = await loadOpsCache<LoungePassenger[]>(`passengers:${loungeName}`);
      if (cached) setPassengers(cached.value);
      else if (!silent) setMessage("تعذر تحديث قائمة مسافري الصالة");
    } finally {
      if (!silent) setPassengersLoading(false);
    }
  }

  async function loadAirlinePricingConfig(loungeName: string) {
    const cacheKey = `airline-config:${loungeName}`;
    try {
      const response = await fetch(`/api/ops/airlines?action=offline-config&lounge=${encodeURIComponent(loungeName)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("pricing config failed");
      const config = await response.json() as AirlineOfflineConfig;
      setAirlineConfig(config);
      await saveOpsCache(cacheKey, config);
      return config;
    } catch {
      const cached = await loadOpsCache<AirlineOfflineConfig>(cacheKey);
      if (cached) {
        setAirlineConfig(cached.value);
        return cached.value;
      }
      setAirlineConfig(null);
      return null;
    }
  }

  function resolveCachedPrice(config: AirlineOfflineConfig | null) {
    const age = specialPricing.age ? Number(specialPricing.age) : undefined;
    if (age !== undefined && Number.isFinite(age) && Number(config?.childFreeUnder || 0) > 0 && age < Number(config?.childFreeUnder || 0)) {
      return { label: "مجاني حسب العمر", priceIqd: 0, paymentType: "complimentary", source: "category", cached: true } as PricingInfo;
    }
    const code = normalizeAirlineCode(entry.airline, entry.flightNumber);
    const airline = config?.airlines.find((item) => item.code === code);
    if (airline) return {
      label: `${airline.nameAr} — ${airline.code}`,
      priceIqd: Number(airline.finalPriceIqd || 0),
      basePriceIqd: Number(airline.basePriceIqd || 0),
      paymentType: airline.paymentType || "cash",
      discountActive: Boolean(airline.discountActive),
      source: "airline_profile",
      cached: true,
      updatedAt: airline.updatedAt,
    } as PricingInfo;
    return { label: "السعر العام المحفوظ", priceIqd: Number(config?.defaultPriceIqd || 40000), paymentType: "cash", source: "default", cached: true } as PricingInfo;
  }

  async function resolveEntryPrice() {
    if (!user || !shift) return;
    const loungeName = String(shift.lounge_name || user.loungeName || "لاونج بغداد");
    if (!online) {
      const cached = resolveCachedPrice(airlineConfig);
      setPricingInfo(cached);
      setEntry((current) => ({ ...current, amountIqd: String(cached.priceIqd), paymentType: cached.paymentType }));
      return;
    }
    const query = new URLSearchParams({
      action: "resolve",
      airline: normalizeAirlineCode(entry.airline, entry.flightNumber) || entry.airline,
      flight: entry.flightNumber,
      lounge: loungeName,
      shift: String(shift.shift_name || user.assignedShift || ""),
      category: specialPricing.category,
      company: entry.billingCompany,
      code: specialPricing.code,
    });
    if (specialPricing.age) query.set("age", specialPricing.age);
    try {
      const response = await fetch(`/api/ops/pricing?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("price resolve failed");
      const data = await response.json();
      const pricing = data.pricing;
      if (!pricing) throw new Error("missing pricing");
      const info: PricingInfo = {
        label: String(pricing.label || "السعر المعتمد"),
        priceIqd: Number(pricing.priceIqd || 0),
        basePriceIqd: pricing.basePriceIqd == null ? undefined : Number(pricing.basePriceIqd),
        paymentType: String(pricing.paymentType || "cash"),
        discountActive: Boolean(pricing.discountActive),
        source: String(pricing.source || "default"),
        updatedAt: pricing.profileUpdatedAt ? String(pricing.profileUpdatedAt) : undefined,
      };
      setPricingInfo(info);
      setEntry((current) => ({ ...current, amountIqd: String(info.priceIqd), paymentType: info.paymentType }));
    } catch {
      const cached = resolveCachedPrice(airlineConfig);
      setPricingInfo(cached);
      setEntry((current) => ({ ...current, amountIqd: String(cached.priceIqd), paymentType: cached.paymentType }));
    }
  }

  async function flushOfflineEntries() {
    if (!online || !user || !shift || offlineFlushRef.current) return;
    offlineFlushRef.current = true;
    setSyncingOffline(true);
    try {
      const rows = await listOfflineEntries();
      const employeeId = employeeIdOf(user);
      for (const row of rows) {
        if (row.status === "conflict" || Number(row.payload.employeeId || 0) !== employeeId) continue;
        if (Number(row.payload.shiftId || 0) !== Number(shift.id)) {
          await updateOfflineEntry(row.clientMutationId, { status: "conflict", lastError: "الشفت تغيّر قبل المزامنة؛ يحتاج مراجعة المدير" });
          continue;
        }
        await updateOfflineEntry(row.clientMutationId, { status: "syncing", attempts: row.attempts + 1, lastError: "" });
        try {
          const response = await fetch("/api/ops/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...row.payload, syncedFromOffline: true, entrySource: "offline" }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            await removeOfflineEntry(row.clientMutationId);
            continue;
          }
          const conflict = response.status === 409 || Boolean(data.requiresDuplicateOverride);
          await updateOfflineEntry(row.clientMutationId, { status: conflict ? "conflict" : "failed", lastError: String(data.message || "تعذرت المزامنة") });
          if (response.status === 401) break;
        } catch {
          await updateOfflineEntry(row.clientMutationId, { status: "pending", lastError: "الاتصال ما زال منقطعاً" });
          break;
        }
      }
      const remaining = await refreshOfflineQueue();
      if (!remaining.length) {
        setMessage("تمت مزامنة كل العمليات المحفوظة دون إنترنت");
        await refreshPassengers(true);
      }
    } finally {
      offlineFlushRef.current = false;
      setSyncingOffline(false);
    }
  }

  const sessionEmployeeId = employeeIdOf(user);
  const sessionShiftId = Number(shift?.id || 0);
  const sessionLoungeName = String(shift?.lounge_name || user?.loungeName || "لاونج بغداد");
  const hasUser = Boolean(user);
  const hasActiveShift = Boolean(user && shift);
  const refreshSessionEvent = useEffectEvent(() => { void refreshSession(); });
  const refreshPassengersEvent = useEffectEvent((silent = false) => refreshPassengers(silent));
  const loadAirlinePricingConfigEvent = useEffectEvent((loungeName: string) => loadAirlinePricingConfig(loungeName));
  const resolveEntryPriceEvent = useEffectEvent(() => resolveEntryPrice());
  const flushOfflineEntriesEvent = useEffectEvent(() => flushOfflineEntries());

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    refreshSessionEvent();
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); stopCamera(); };
  }, []);

  useEffect(() => {
    if (!hasUser) return;
    void refreshPassengersEvent();
    const passengerPoll = window.setInterval(() => { if (navigator.onLine) void refreshPassengersEvent(true); }, 20_000);
    const clockTick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      window.clearInterval(passengerPoll);
      window.clearInterval(clockTick);
    };
  }, [hasUser, sessionEmployeeId]);

  useEffect(() => {
    if (!hasActiveShift) return;
    void loadAirlinePricingConfigEvent(sessionLoungeName);
    if (!online) return;
    const timer = window.setInterval(() => { void loadAirlinePricingConfigEvent(sessionLoungeName); }, 60_000);
    return () => window.clearInterval(timer);
  }, [hasActiveShift, online, sessionEmployeeId, sessionLoungeName, sessionShiftId]);

  useEffect(() => {
    if (!hasActiveShift) return;
    const timer = window.setTimeout(() => { void resolveEntryPriceEvent(); }, 180);
    return () => window.clearTimeout(timer);
  }, [entry.airline, entry.flightNumber, entry.billingCompany, specialPricing.category, specialPricing.age, specialPricing.code, hasActiveShift, sessionShiftId, online, airlineConfig?.version]);

  useEffect(() => {
    if (online && hasActiveShift) void flushOfflineEntriesEvent();
  }, [hasActiveShift, online, sessionEmployeeId, sessionShiftId]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      alertsArmedRef.current = true;
      setAlertsEnabled(true);
    }
  }, []);

  async function doLogin(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const res = await fetch("/api/ops/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "فشل تسجيل الدخول");
        return;
      }
      setUser(data.user);
      await saveOpsCache("session", data.user);
      setLogin({ username: "", password: "" });
      setMessage("تم تسجيل الدخول");
      await Promise.all([refreshShift(employeeIdOf(data.user)), refreshOfflineQueue()]);
    } catch {
      setMessage("ماكو اتصال بالإنترنت. تسجيل الدخول لأول مرة يحتاج اتصال؛ إذا كان الشفت مفتوحاً أعد تحميل الصفحة.");
    }
  }

  async function logout() {
    const hasCurrentEmployeeQueue = offlineQueue.some((row) => Number(row.payload.employeeId || 0) === employeeIdOf(user));
    if (!online && hasCurrentEmployeeQueue) {
      setMessage("ما تگدر تسجل خروج قبل رجوع الإنترنت ومزامنة العمليات المحفوظة");
      return;
    }
    stopCamera();
    try { await fetch("/api/ops/session", { method: "DELETE" }); } catch {}
    await clearOpsCache();
    setUser(null);
    setShift(null);
    setShiftRecipients([]);
    setPendingHandover(null);
    setPassengers([]);
    setMessage("");
  }

  async function openShift() {
    if (!online) { setMessage("فتح شفت جديد يحتاج اتصال بالإنترنت. إذا كان شفتك مفتوحاً قبل الانقطاع أعد تحميل الصفحة."); return; }
    setMessage("");
    const res = await fetch("/api/ops/shift", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "تعذر فتح الشفت");
      return;
    }
    setShift(data.shift);
    setShiftRecipients(Array.isArray(data.recipients) ? data.recipients : []);
    setPendingHandover(data.pendingHandover || null);
    await saveOpsCache(`shift:${employeeIdOf(user)}`, data);
    setMessage("تم فتح الشفت");
  }

  function startCloseShift() {
    if (!online) { setMessage("إغلاق وتسليم الشفت ينتظر رجوع الإنترنت حتى تضمن مزامنة كل المسافرين."); return; }
    if (offlineQueue.some((row) => Number(row.payload.employeeId || 0) === employeeIdOf(user))) { setMessage("قبل إغلاق الشفت لازم تزامن أو تراجع العمليات المحفوظة دون إنترنت"); void flushOfflineEntries(); return; }
    setMessage("");
    setHandoverForm({ incomingEmployeeId: "", note: "", closingCashIqd: "" });
    setShowHandover(true);
  }

  async function closeShift(event: React.FormEvent) {
    event.preventDefault();
    const remaining = passengers.filter((passenger) => passenger.lounge_status === "inside" || passenger.lounge_status === "called");
    if (remaining.length && !handoverForm.incomingEmployeeId) {
      setMessage("حدد مسؤول الشفت المستلم لأن أكو مسافرين بعدهم داخل الصالة");
      return;
    }
    setHandoverSaving(true);
    setMessage("");
    const body: { action: string; note: string; incomingEmployeeId?: number; closingCashIqd?: number } = {
      action: "close",
      note: handoverForm.note.trim(),
    };
    if (handoverForm.incomingEmployeeId) body.incomingEmployeeId = Number(handoverForm.incomingEmployeeId);
    if (handoverForm.closingCashIqd.trim()) body.closingCashIqd = Number(handoverForm.closingCashIqd);
    const res = await fetch("/api/ops/shift", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "تعذر إغلاق الشفت");
      setHandoverSaving(false);
      return;
    }
    stopCamera();
    setShift(null);
    setShowHandover(false);
    setHandoverSaving(false);
    const summary = data.shift?.summary || {};
    const recipient = data.shift?.handover?.incomingEmployee?.name;
    setMessage(`تم إغلاق الشفت${recipient ? ` وتسليمه إلى ${recipient}` : ""} — المسافرين: ${Number(summary.passengers || 0)} | المجموع: ${Number(summary.total_iqd || 0).toLocaleString("en-US")} د.ع | فرق النقد: ${Number(summary.cashDifferenceIqd || 0).toLocaleString("en-US")} د.ع`);
    await refreshShift();
  }

  async function acceptHandover() {
    if (!pendingHandover) return;
    if (!online) { setMessage("تأكيد استلام الشفت يحتاج اتصال بالإنترنت"); return; }
    if (!shift) {
      setMessage("افتح شفتك أولاً وبعدها أكد استلام التسليم");
      return;
    }
    setHandoverSaving(true);
    const res = await fetch("/api/ops/shift", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept_handover", handoverId: pendingHandover.id }),
    });
    const data = await res.json();
    setHandoverSaving(false);
    if (!res.ok) {
      setMessage(data.message || "تعذر تأكيد استلام الشفت");
      return;
    }
    setPendingHandover(data.pendingHandover || null);
    setShiftRecipients(Array.isArray(data.recipients) ? data.recipients : shiftRecipients);
    setMessage("تم تأكيد استلام الشفت والمسافرين المتبقين بنجاح");
    await refreshPassengers(true);
  }

  async function submitEntry(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!user || !shift) { setMessage("افتح الشفت أولاً"); return; }
    const clientMutationId = createClientMutationId();
    const offlineOccurredAt = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ...entry,
      amountIqd: Number(entry.amountIqd || 0),
      entrySource: entry.boardingRaw.trim() ? "scan" : "manual",
      passengerCategory: specialPricing.category,
      passengerAge: specialPricing.age ? Number(specialPricing.age) : undefined,
      specialCode: specialPricing.code,
      clientMutationId,
      offlineOccurredAt,
      employeeId: employeeIdOf(user),
      shiftId: shift.id,
      loungeName: shift.lounge_name || user.loungeName || "لاونج بغداد",
      pricingSnapshot: pricingInfo,
    };

    const resetEntry = () => {
      setEntry(blankEntry());
      setFileName("");
      setScanStatus("");
      setSpecialPricing({ category: "adult", age: "", code: "" });
      setShowSpecialPricing(false);
    };

    const saveOffline = async (reason: string) => {
      const duplicate = offlineQueue.some((row) => {
        const raw = String(row.payload.boardingRaw || "").trim();
        return raw && raw === entry.boardingRaw.trim();
      });
      if (duplicate) { setMessage("هذا البوردنغ محفوظ مسبقاً ضمن العمليات المنتظرة للمزامنة"); return; }
      await queueOfflineEntry({ ...payload, syncedFromOffline: true, entrySource: "offline" });
      await refreshOfflineQueue();
      setMessage(`تم حفظ دخول ${entry.passengerName} داخل الجهاز بأمان — ${reason}. راح يتزامن تلقائياً عند رجوع الإنترنت.`);
      resetEntry();
    };

    if (!online || !navigator.onLine) {
      await saveOffline("الإنترنت منقطع");
      return;
    }
    const send = async (overrideDuplicate = false): Promise<void> => {
      let res: Response;
      try {
        res = await fetch("/api/ops/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, overrideDuplicate }),
        });
      } catch {
        setOnline(false);
        await saveOffline("تعذر الوصول إلى الخادم");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok && data.requiresDuplicateOverride) {
        if (confirm(`${data.message}\n\nهل تريد تسجيل الدخول مرة ثانية بعد التأكد؟`)) return send(true);
        setMessage("تم إلغاء التسجيل المكرر");
        return;
      }
      if (!res.ok) {
        if (res.status >= 500) { await saveOffline("الخادم غير متاح مؤقتاً"); return; }
        setMessage(data.message || "تعذر تسجيل المسافر");
        return;
      }
      setMessage(`تم تأكيد دخول ${data.entry.passenger_name} — ${data.entry.reference}${data.sheetSync === "synced" ? " — تمت مزامنة Google Sheet" : data.sheetSync === "failed" ? " — محفوظ، ومزامنة الشيت تحتاج إعادة محاولة" : " — محفوظ ومزامنة الشيت معلقة"}`);
      resetEntry();
      await refreshPassengers(true);
    };
    await send(false);
  }

  async function updatePassengerStatus(id: number, status: PassengerStatus) {
    if (!online) { setMessage("تحديث حالة المسافر ينتظر رجوع الإنترنت؛ تسجيل الدخول الجديد يبقى شغال محلياً"); return; }
    setPendingPassengerId(id);
    try {
      const res = await fetch("/api/ops/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "تعذر تحديث حالة المسافر");
        return;
      }
      const action = status === "called" ? "تم تثبيت إبلاغ المسافر بالتوجه للبوابة" : status === "departed" ? "تم تثبيت مغادرة المسافر إلى البوابة" : "تمت إعادة المسافر إلى داخل الصالة";
      setMessage(`${action} — ${data.passenger.passenger_name}`);
      await refreshPassengers(true);
    } finally {
      setPendingPassengerId(null);
    }
  }

  function startEditPassenger(passenger: LoungePassenger) {
    setEditingPassenger(passenger);
    setEditFlight({
      departureAt: passenger.departure_at ? toBaghdadDateTimeInput(passenger.departure_at) : "",
      gateNumber: passenger.gate_number || "",
      reason: "",
    });
  }

  async function submitFlightEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPassenger) return;
    if (!online) { setMessage("تعديل الرحلة يحتاج اتصال بالإنترنت حتى يتزامن بين الصالتين"); return; }
    setPendingPassengerId(editingPassenger.id);
    const res = await fetch("/api/ops/entries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_flight",
        id: editingPassenger.id,
        departureAt: editFlight.departureAt,
        gateNumber: editFlight.gateNumber,
        reason: editFlight.reason,
      }),
    });
    const data = await res.json();
    setPendingPassengerId(null);
    if (!res.ok) {
      setMessage(data.message || "تعذر تعديل معلومات الرحلة");
      return;
    }
    setEditingPassenger(null);
    setMessage(`تم تحديث وقت الإقلاع والبوابة للمسافر ${data.passenger.passenger_name}`);
    alertedPassengerIds.current.delete(data.passenger.id);
    await refreshPassengers(true);
  }

  async function voidPassenger(passenger: LoungePassenger) {
    if (!online) { setMessage("إلغاء الإدخال يحتاج اتصال بالإنترنت حتى ما يصير اختلاف بالحساب"); return; }
    const reason = prompt(`سبب إلغاء إدخال ${passenger.passenger_name} (إلزامي):`, "");
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setMessage("لازم تكتب سبب واضح لإلغاء الإدخال");
      return;
    }
    if (!confirm(`تأكيد إلغاء إدخال ${passenger.passenger_name}؟ راح ينشال من القائمة والحساب.`)) return;
    setPendingPassengerId(passenger.id);
    const res = await fetch("/api/ops/entries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void", id: passenger.id, reason: reason.trim() }),
    });
    const data = await res.json();
    setPendingPassengerId(null);
    if (!res.ok) {
      setMessage(data.message || "تعذر إلغاء الإدخال");
      return;
    }
    setMessage(`تم إلغاء إدخال ${passenger.passenger_name} وتسجيل السبب في سجل العمليات`);
    await refreshPassengers(true);
  }

  async function enableAlerts() {
    alertsArmedRef.current = true;
    let permission: NotificationPermission | "unsupported" = "unsupported";
    if (typeof window !== "undefined" && "Notification" in window) {
      permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    }
    setAlertsEnabled(true);
    playAlertTone();
    setMessage(permission === "granted" ? "تم تفعيل صوت وإشعارات تنبيه البوابة" : "تم تفعيل صوت التنبيه داخل شاشة النظام");
    await refreshPassengers(true);
  }

  function notifyCriticalPassengers(rows: LoungePassenger[]) {
    if (!alertsArmedRef.current || typeof window === "undefined") return;
    const currentTime = Date.now();
    for (const passenger of rows) {
      if (passenger.lounge_status !== "inside" || !passenger.departure_at) continue;
      const minutesAway = (new Date(passenger.departure_at).getTime() - currentTime) / 60000;
      if (minutesAway > 15 || minutesAway < -120 || alertedPassengerIds.current.has(passenger.id)) continue;
      alertedPassengerIds.current.add(passenger.id);
      playAlertTone();
      try { navigator.vibrate?.([160, 90, 160]); } catch {}
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("تنبيه بوابة — لاونج بغداد", {
          body: `${passenger.passenger_name} · الرحلة ${passenger.flight_number || "غير محددة"}${passenger.gate_number ? ` · البوابة ${passenger.gate_number}` : ""} · حان وقت التوجه للبوابة`,
          tag: `baghdad-lounge-gate-${passenger.id}`,
          requireInteraction: true,
        });
      }
    }
  }

  function playAlertTone() {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.42);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      oscillator.addEventListener("ended", () => context.close());
    } catch {}
  }

  async function makeDetector() {
    if (!detectorPromise.current) {
      detectorPromise.current = import("barcode-detector/ponyfill")
        .then(async ({ BarcodeDetector, prepareZXingModule }) => {
          await prepareZXingModule({
            overrides: {
              locateFile: (path: string, prefix: string) => path.endsWith(".wasm") ? "/zxing_reader.wasm" : `${prefix}${path}`,
            },
            fireImmediately: true,
          });
          return new BarcodeDetector({ formats: [...scanFormats] });
        })
        .catch((error) => {
          detectorPromise.current = null;
          throw error;
        });
    }
    return detectorPromise.current;
  }

  function fillFromRaw(raw: string) {
    const normalizedRaw = normalizeBoardingPassRaw(raw);
    const parsed = parseIataBcbp(normalizedRaw);
    const airline = parsed ? BAGHDAD_AIRLINES.find((item) => item.code === parsed.carrier) : undefined;
    setEntry((current) => ({
      ...current,
      boardingRaw: normalizedRaw,
      amountIqd: current.amountIqd || "40000",
      ...(parsed ? {
        passengerName: parsed.passengerName || current.passengerName,
        airline: airline ? `${airline.en} (${airline.code})` : parsed.carrier || current.airline,
        flightNumber: parsed.flightNumber || current.flightNumber,
        origin: parsed.origin || current.origin,
        destination: parsed.destination || current.destination,
        seat: parsed.seat || current.seat,
      } : {}),
    }));
    return parsed;
  }

  function acceptScan(raw: string, format = "") {
    if (!raw.trim()) return;
    const parsed = fillFromRaw(raw);
    setScanStatus(parsed ? `تمت القراءة وتعبئة معلومات المسافر${format ? ` — ${format}` : ""}` : `تمت قراءة الباركود${format ? ` — ${format}` : ""}، لكن يحتاج مراجعة يدوية`);
    try { navigator.vibrate?.(100); } catch {}
    stopCamera();
  }

  async function startCamera() {
    setScanStatus("جاري تشغيل قارئ PDF417...");
    try {
      await makeDetector();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      setScanStatus("وجّه الكاميرا على الباركود وثبّت البوردنغ داخل الإطار");
      window.setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = await makeDetector();
        const tick = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const hits = await detector.detect(videoRef.current);
            if (hits?.[0]?.rawValue) {
              acceptScan(String(hits[0].rawValue), String(hits[0].format || ""));
              return;
            }
          } catch {}
          scanTimer.current = window.setTimeout(tick, 420);
        };
        tick();
      }, 50);
    } catch (error) {
      console.error(error);
      setScanStatus("تعذر تشغيل قارئ الكاميرا. استخدم قارئ USB/Bluetooth أو ارفع صورة واضحة.");
    }
  }

  function stopCamera() {
    if (scanTimer.current) {
      window.clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function scanSource(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) {
    const detector = await makeDetector();
    const hits = await detector.detect(source);
    if (hits?.[0]?.rawValue) {
      acceptScan(String(hits[0].rawValue), String(hits[0].format || ""));
      return true;
    }
    return false;
  }

  async function scanImageFile(file: File) {
    setScanStatus("جاري فحص الباركود داخل الصورة...");
    try {
      const bitmap = await createImageBitmap(file);
      const ok = await scanSource(bitmap);
      bitmap.close();
      if (!ok) setScanStatus("ما قدرت أقرأ الباركود من الصورة. جرّب صورة أوضح أو PDF الأصلي.");
    } catch (error) {
      console.error(error);
      setScanStatus("تعذر تحليل الصورة. جرّب صورة أوضح أو امسح بالقارئ الخارجي.");
    }
  }

  async function scanPdfFile(file: File) {
    setScanStatus("جاري قراءة ملف PDF...");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      const pages = Math.min(pdf.numPages, 3);
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        setScanStatus(`جاري فحص صفحة ${pageNumber} من ${pages}...`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 3 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        if (await scanSource(canvas)) return;
      }
      setScanStatus("تم فتح الـPDF لكن ما لكيت باركود مقروء. جرّب صورة أوضح أو الإدخال اليدوي.");
    } catch (error) {
      console.error(error);
      setScanStatus("تعذر قراءة ملف PDF. جرّب صورة التذكرة أو الإدخال اليدوي.");
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setScanStatus("");
    if (file.type.startsWith("image/")) return scanImageFile(file);
    if (file.type === "application/pdf") return scanPdfFile(file);
    setScanStatus("نوع الملف غير مدعوم.");
  }

  const hardwareScanner = useHardwareBarcodeScanner({
    enabled: Boolean(user),
    onScan: (raw) => acceptScan(raw, "قارئ USB / Bluetooth"),
  });

  const visiblePassengers = useMemo(() => {
    const query = passengerQuery.trim().toLowerCase();
    return passengers
      .filter((passenger) => !query || [passenger.passenger_name, passenger.reference, passenger.flight_number, passenger.airline, passenger.destination, passenger.gate_number].some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((first, second) => passengerPriority(first, now) - passengerPriority(second, now) || departureTimestamp(first) - departureTimestamp(second));
  }, [passengers, passengerQuery, now]);

  const criticalPassengers = useMemo(() => passengers.filter((passenger) => isGateAlertDue(passenger, now)), [passengers, now]);
  const remainingPassengers = passengers.filter((passenger) => passenger.lounge_status === "inside" || passenger.lounge_status === "called");
  const insideCount = passengers.filter((passenger) => passenger.lounge_status === "inside").length;
  const calledCount = passengers.filter((passenger) => passenger.lounge_status === "called").length;
  const currentEmployeeId = employeeIdOf(user);
  const currentOfflineQueue = offlineQueue.filter((row) => Number(row.payload.employeeId || 0) === currentEmployeeId);
  const offlineConflictCount = currentOfflineQueue.filter((row) => row.status === "conflict" || row.status === "failed").length;

  if (loading) return <Shell><div className={styles.card}>جاري تحميل نظام الصالة...</div></Shell>;
  if (!user) {
    return <Shell>
      <div className={styles.loginWrap}>
        <form onSubmit={doLogin} className={`${styles.card} ${styles.loginCard}`}>
          <div className={styles.brand}>BAGHDAD LOUNGE</div>
          <h1>تسجيل دخول الموظف</h1>
          <p>كل موظف يدخل بيوزره الخاص قبل فتح الشفت.</p>
          <div className={`${styles.loginNetwork} ${online ? styles.loginNetworkOnline : styles.loginNetworkOffline}`}>{online ? <Wifi size={16}/> : <WifiOff size={16}/>} {online ? "النظام متصل" : "الإنترنت منقطع"}</div>
          {message && <Notice text={message} />}
          <Field label="اسم المستخدم"><input required autoCapitalize="none" className={styles.input} value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></Field>
          <Field label="كلمة المرور"><input required type="password" className={styles.input} value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></Field>
          <button className={`${styles.button} ${styles.primaryButton}`}>دخول</button>
        </form>
      </div>
    </Shell>;
  }

  return <Shell>
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.brand}>BAGHDAD LOUNGE OPERATIONS</div>
          <h1>واجهة باب الصالة</h1>
          <div className={styles.muted}>{user.name} · {shift?.lounge_name || user.loungeName || "الصالة"} · {user.assignedShift}</div>
        </div>
        <div className={styles.headerActions}>
          {user.role === "owner" || user.role === "manager" ? <a href="/ops/admin" className={`${styles.button} ${styles.secondaryButton}`}><Settings2 size={17} />لوحة الإدارة</a> : null}
          <button type="button" onClick={logout} className={`${styles.button} ${styles.secondaryButton}`}><LogOut size={17} />تسجيل خروج</button>
        </div>
      </header>

      <section className={`${styles.connectivityBar} ${online ? styles.connectivityOnline : styles.connectivityOffline}`} aria-live="polite">
        <div className={styles.connectivityIcon}>{online ? <Wifi size={20}/> : <WifiOff size={20}/>}</div>
        <div className={styles.connectivityCopy}>
          <strong>{online ? "النظام متصل ويزامن مباشرة" : "وضع العمل دون إنترنت فعّال"}</strong>
          <span>{online
            ? currentOfflineQueue.length ? `${currentOfflineQueue.length} عملية محفوظة بانتظار المزامنة${offlineConflictCount ? `، منها ${offlineConflictCount} تحتاج مراجعة` : ""}` : "كل العمليات متزامنة"
            : "استمر بمسح البوردنغ؛ كل دخول ينحفظ داخل هذا الجهاز ويُرسل تلقائياً عند رجوع الشبكة"}</span>
          {currentOfflineQueue.length ? <details><summary>عرض العمليات المحفوظة</summary><div className={styles.offlineQueueList}>{currentOfflineQueue.map((row) => <span key={row.clientMutationId}><b>{String(row.payload.passengerName || "مسافر")}</b> · {String(row.payload.flightNumber || "بلا رحلة")} · {row.status === "conflict" ? "تحتاج مراجعة" : row.status === "failed" ? "تعذرت" : row.status === "syncing" ? "تتزامن" : "محفوظة"}{row.lastError ? <small>{row.lastError}</small> : null}</span>)}</div></details> : null}
        </div>
        {online && currentOfflineQueue.length ? <button type="button" disabled={syncingOffline} onClick={() => void flushOfflineEntries()} className={`${styles.button} ${styles.secondaryButton}`}><CloudUpload size={17}/>{syncingOffline ? "جاري المزامنة" : "مزامنة الآن"}</button> : null}
      </section>

      {criticalPassengers.length ? <section className={styles.gateAlert} aria-live="assertive">
        <div className={styles.gateAlertIcon}><BellRing size={24} /></div>
        <div className={styles.gateAlertCopy}>
          <strong>حان وقت التوجه إلى البوابة</strong>
          <span>{criticalPassengers.map((passenger) => `${passenger.passenger_name}${passenger.flight_number ? ` — ${passenger.flight_number}` : ""}`).join("، ")}</span>
        </div>
      </section> : null}

      {message && <Notice text={message} />}

      {pendingHandover ? <section className={styles.handoverBanner}>
        <div className={styles.handoverIcon}><ClipboardCheck size={24} /></div>
        <div className={styles.handoverCopy}>
          <div className={styles.eyebrow}>تسليم شفت بانتظارك</div>
          <strong>{pendingHandover.outgoing_employee_name} سلّم لك شفت {pendingHandover.outgoing_shift_name}</strong>
          <span>
            {(pendingHandover.passengers_snapshot || []).length
              ? `${pendingHandover.passengers_snapshot.length} مسافر متبقّي: ${pendingHandover.passengers_snapshot.map((passenger) => passenger.passenger_name).join("، ")}`
              : "لا يوجد مسافر متبقّي في التسليم"}
          </span>
          {pendingHandover.handover_note ? <span>الملاحظة: {pendingHandover.handover_note}</span> : null}
          <span>النقد المسلّم: {Number(pendingHandover.closing_cash_iqd || 0).toLocaleString("en-US")} د.ع · الفرق: {Number(pendingHandover.cash_difference_iqd || 0).toLocaleString("en-US")} د.ع</span>
        </div>
        <button disabled={!shift || handoverSaving} type="button" onClick={acceptHandover} className={`${styles.button} ${styles.primaryButton}`}>
          <UserCheck size={18} />{!shift ? "افتح شفتك أولاً" : handoverSaving ? "جاري الاستلام..." : "تأكيد الاستلام"}
        </button>
      </section> : null}

      <section className={`${styles.card} ${styles.shiftBar}`}>
        <div>
          <div className={styles.shiftTitle}>الشفت</div>
          {shift ? <div className={styles.shiftOpen}>مفتوح — {shift.lounge_name || user.loungeName} — {shift.shift_name} — منذ {new Date(shift.opened_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" })}</div> : <div className={styles.shiftClosed}>لا يوجد شفت مفتوح</div>}
        </div>
        {shift ? <button type="button" onClick={startCloseShift} className={`${styles.button} ${styles.secondaryButton}`}>تسليم وإغلاق الشفت</button> : <button type="button" onClick={openShift} className={`${styles.button} ${styles.primaryButton}`}>فتح الشفت</button>}
      </section>

      <div className={styles.workGrid}>
        <aside className={`${styles.card} ${styles.passengerPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.eyebrow}>متابعة مباشرة</div>
              <h2>مسافرو الصالة</h2>
            </div>
            <button type="button" onClick={() => refreshPassengers()} className={styles.iconButton} aria-label="تحديث القائمة"><RefreshCw size={18} className={passengersLoading ? styles.spinning : ""} /></button>
          </div>

          <div className={styles.statRow}>
            <div><Users size={17} /><span>داخل الصالة</span><strong>{insideCount}</strong></div>
            <div><UserCheck size={17} /><span>تم إبلاغهم</span><strong>{calledCount}</strong></div>
          </div>

          <button type="button" onClick={enableAlerts} className={`${styles.alertToggle} ${alertsEnabled ? styles.alertToggleOn : ""}`}>
            <BellRing size={18} />
            {alertsEnabled ? "تنبيهات البوابة مفعّلة" : "تفعيل صوت وإشعارات البوابة"}
          </button>

          <label className={styles.searchBox}>
            <Search size={17} />
            <input value={passengerQuery} onChange={(event) => setPassengerQuery(event.target.value)} placeholder="ابحث بالاسم أو الرحلة" />
          </label>

          <div className={styles.passengerList}>
            {passengersLoading && !passengers.length ? <div className={styles.emptyState}>جاري تحميل المسافرين...</div> : null}
            {!passengersLoading && !visiblePassengers.length ? <div className={styles.emptyState}><DoorOpen size={28} /><strong>ماكو مسافرين حالياً</strong><span>أي مسافر يتم تأكيد دخوله راح يظهر هنا مباشرة.</span></div> : null}
            {visiblePassengers.map((passenger) => <PassengerCard key={passenger.id} passenger={passenger} now={now} pending={pendingPassengerId === passenger.id} onStatus={updatePassengerStatus} onEdit={startEditPassenger} onVoid={voidPassenger} />)}
          </div>
        </aside>

        <form onSubmit={submitEntry} className={`${styles.card} ${styles.entryForm} ${!shift ? styles.disabledForm : ""}`}>
          <div className={styles.formHeader}>
            <div>
              <div className={styles.eyebrow}>بوابة الدخول</div>
              <h2>تسجيل وتأكيد دخول مسافر</h2>
              <p>امسح البوردنغ أو أدخل المعلومات، وحدد وقت الإقلاع حتى يعمل تنبيه الـ15 دقيقة.</p>
            </div>
            <div className={styles.scanReady}>{online ? <ScanLine size={17}/> : <WifiOff size={17}/>} {online ? "SCAN READY" : "OFFLINE READY"}</div>
          </div>

          <section className={styles.hardwareScanner} data-state={hardwareScanner.state} aria-live="polite">
            <div className={styles.hardwareIcon}><Usb size={24} /></div>
            <div className={styles.hardwareCopy}>
              <strong>قارئ USB / Bluetooth مباشر</strong>
              <span>{hardwareScanner.message}</span>
              <small>شبّك الجهاز بوضع Keyboard / HID وامسح البوردنغ مباشرة، بدون ضغط أي زر.</small>
            </div>
            <span className={styles.hardwareBadge}>{hardwareStateLabels[hardwareScanner.state]}</span>
          </section>

          <section className={styles.scanActions}>
            <button type="button" onClick={cameraOn ? stopCamera : startCamera} className={`${styles.button} ${cameraOn ? styles.primaryButton : styles.secondaryButton}`}><Camera size={18} />{cameraOn ? "إيقاف الكاميرا" : "فتح الكاميرا والمسح"}</button>
            <label className={`${styles.button} ${styles.secondaryButton}`}><Upload size={18} />رفع صورة أو PDF<input type="file" accept="image/*,application/pdf" onChange={(event) => onFile(event.target.files?.[0])} hidden /></label>
            <label className={`${styles.button} ${styles.secondaryButton}`}><Camera size={18} />التقاط صورة<input type="file" accept="image/*" capture="environment" onChange={(event) => onFile(event.target.files?.[0])} hidden /></label>
          </section>

          {cameraOn ? <div className={styles.cameraFrame}><video ref={videoRef} muted playsInline /></div> : null}
          {scanStatus || fileName ? <div className={styles.scanStatus}>{fileName ? <strong>الملف: {fileName}</strong> : null}<span>{scanStatus}</span></div> : null}

          <details className={styles.rawDetails}>
            <summary>بيانات الباركود الخام — للدعم والمراجعة فقط</summary>
            <Field label="Boarding Pass Raw Data">
              <textarea rows={3} className={styles.input} value={entry.boardingRaw} onChange={(event) => { const raw = event.target.value; setEntry((current) => ({ ...current, boardingRaw: raw })); if (normalizeBoardingPassRaw(raw).startsWith("M") && normalizeBoardingPassRaw(raw).length >= 58) fillFromRaw(raw); }} placeholder="تنملأ تلقائياً من الكاميرا أو القارئ أو الملف" />
            </Field>
          </details>

          <div className={styles.fieldsGrid}>
            <Field label="اسم المسافر"><input required className={styles.input} value={entry.passengerName} onChange={(event) => setEntry({ ...entry, passengerName: event.target.value })} /></Field>
            <Field label="شركة الطيران"><input list="ops-airline-list" className={styles.input} value={entry.airline} onChange={(event) => setEntry({ ...entry, airline: event.target.value })} placeholder="تنملأ تلقائياً من البوردنغ"/><datalist id="ops-airline-list">{BAGHDAD_AIRLINES.map((airline) => <option key={airline.code} value={`${airline.en} (${airline.code})`}>{airline.ar}</option>)}</datalist></Field>
            <Field label="رقم الرحلة"><input className={styles.input} value={entry.flightNumber} onChange={(event) => setEntry({ ...entry, flightNumber: event.target.value })} /></Field>
            <Field label="وقت الإقلاع — بتوقيت بغداد"><input required type="datetime-local" className={`${styles.input} ${styles.departureInput}`} value={entry.departureAt} onChange={(event) => setEntry({ ...entry, departureAt: event.target.value })} /></Field>
            <Field label="رقم البوابة (إن وجد)"><input className={styles.input} maxLength={20} value={entry.gateNumber} onChange={(event) => setEntry({ ...entry, gateNumber: event.target.value })} placeholder="مثال: B4" /></Field>
            <Field label="من"><input className={styles.input} value={entry.origin} onChange={(event) => setEntry({ ...entry, origin: event.target.value })} /></Field>
            <Field label="إلى"><input className={styles.input} value={entry.destination} onChange={(event) => setEntry({ ...entry, destination: event.target.value })} /></Field>
            <Field label="المقعد"><input className={styles.input} value={entry.seat} onChange={(event) => setEntry({ ...entry, seat: event.target.value })} /></Field>
          </div>

          <div className={styles.fieldsGrid}>
            <Field label="طريقة الحساب"><select className={styles.input} value={entry.paymentType} onChange={(event) => setEntry({ ...entry, paymentType: event.target.value })}>{paymentLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            {entry.paymentType === "credit" ? <Field label="الجهة / الشركة المحاسبة"><input required className={styles.input} value={entry.billingCompany} onChange={(event) => setEntry({ ...entry, billingCompany: event.target.value })} /></Field> : null}
            <Field label="المبلغ المعتمد من الإدارة (د.ع)"><input readOnly={user.role === "reception"} inputMode="numeric" className={styles.input} value={entry.amountIqd} onChange={(event) => setEntry({ ...entry, amountIqd: event.target.value.replace(/\D/g, "") })} /></Field>
          </div>

          <section className={styles.pricingResult}>
            <div className={styles.pricingResultIcon}><Banknote size={22}/></div>
            <div className={styles.pricingResultCopy}>
              <span>التسعيرة التي ستُسجل</span>
              <strong>{pricingInfo?.label || "السعر العام"}</strong>
              <small>{pricingInfo?.cached ? "محسوبة من آخر إعداد محفوظ على الجهاز" : "مرتبطة مباشرة بإعدادات الإدارة"}{pricingInfo?.discountActive ? " · الخصم فعّال" : ""}</small>
            </div>
            <div className={styles.pricingAmount}>{pricingInfo?.basePriceIqd && pricingInfo.basePriceIqd !== pricingInfo.priceIqd ? <del>{Number(pricingInfo.basePriceIqd).toLocaleString("en-US")}</del> : null}<strong>{Number(entry.amountIqd || 0).toLocaleString("en-US")} د.ع</strong></div>
            <button type="button" className={styles.specialPriceButton} onClick={() => setShowSpecialPricing((value) => !value)}>{showSpecialPricing ? "إخفاء الحالة الخاصة" : "طفل أو VIP؟"}</button>
          </section>

          {showSpecialPricing ? <section className={styles.specialPricingBox}>
            <div className={styles.fieldsGrid}>
              <Field label="فئة المسافر"><select className={styles.input} value={specialPricing.category} onChange={(event) => setSpecialPricing({ ...specialPricing, category: event.target.value })}><option value="adult">بالغ</option><option value="child">طفل</option><option value="infant">رضيع</option><option value="vip">VIP</option></select></Field>
              <Field label="العمر"><input inputMode="numeric" className={styles.input} value={specialPricing.age} onChange={(event) => setSpecialPricing({ ...specialPricing, age: event.target.value.replace(/\D/g, "") })} placeholder="يُستخدم لتطبيق سياسة الأطفال"/></Field>
              <Field label="كود خاص (إن وجد)"><input className={styles.input} value={specialPricing.code} onChange={(event) => setSpecialPricing({ ...specialPricing, code: event.target.value.trim().toUpperCase() })} placeholder="مثال VIP-001"/></Field>
            </div>
          </section> : null}

          <Field label="ملاحظات"><input className={styles.input} value={entry.notes} onChange={(event) => setEntry({ ...entry, notes: event.target.value })} /></Field>
          <button className={`${styles.button} ${styles.confirmButton}`}><CheckCircle2 size={20} />تأكيد دخول المسافر وإضافته للقائمة</button>
        </form>
      </div>

      {showHandover ? <div className={styles.modalBackdrop} role="presentation">
        <form className={styles.modalCard} onSubmit={closeShift} role="dialog" aria-modal="true" aria-label="تسليم وإغلاق الشفت">
          <div className={styles.modalHeader}>
            <div><div className={styles.eyebrow}>إجراء نهاية الشفت</div><h2>تسليم وإغلاق الشفت</h2></div>
            <button type="button" className={styles.iconButton} onClick={() => setShowHandover(false)} aria-label="إغلاق"><X size={19} /></button>
          </div>

          <div className={styles.remainingBox}>
            <strong><Users size={18} />المسافرون المتبقّون ({remainingPassengers.length})</strong>
            {remainingPassengers.length
              ? <div className={styles.remainingList}>{remainingPassengers.map((passenger) => <span key={passenger.id}>{passenger.passenger_name} · {passenger.flight_number || "بلا رقم رحلة"}{passenger.gate_number ? ` · بوابة ${passenger.gate_number}` : ""}</span>)}</div>
              : <span>ماكو مسافر باقٍ داخل الصالة؛ تقدر تغلق الشفت بدون تحديد مستلم.</span>}
          </div>

          <Field label={`مسؤول الشفت المستلم${remainingPassengers.length ? " — إلزامي" : " — اختياري"}`}>
            <select required={remainingPassengers.length > 0} className={styles.input} value={handoverForm.incomingEmployeeId} onChange={(event) => setHandoverForm({ ...handoverForm, incomingEmployeeId: event.target.value })}>
              <option value="">{remainingPassengers.length ? "اختر المسؤول المستلم" : "إغلاق بدون تسليم لشخص"}</option>
              {shiftRecipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.assigned_shift}</option>)}
            </select>
          </Field>
          {remainingPassengers.length > 0 && !shiftRecipients.length ? <div className={styles.inlineWarning}>لا يوجد مسؤول آخر مفعّل لنفس الصالة. أضفه من لوحة الإدارة قبل إغلاق الشفت.</div> : null}

          <div className={styles.handoverGrid}>
            <Field label="النقد الفعلي عند التسليم (اختياري)">
              <div className={styles.moneyInput}><Banknote size={18} /><input inputMode="numeric" className={styles.input} value={handoverForm.closingCashIqd} onChange={(event) => setHandoverForm({ ...handoverForm, closingCashIqd: event.target.value.replace(/\D/g, "") })} placeholder="يعتمد المتوقع إذا تركته فارغ" /></div>
            </Field>
            <Field label="ملاحظات للمسؤول المستلم">
              <textarea rows={3} className={styles.input} value={handoverForm.note} onChange={(event) => setHandoverForm({ ...handoverForm, note: event.target.value })} placeholder="أي حالة خاصة أو متابعة مطلوبة" />
            </Field>
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={() => setShowHandover(false)} className={`${styles.button} ${styles.secondaryButton}`}>رجوع</button>
            <button disabled={handoverSaving || (remainingPassengers.length > 0 && !shiftRecipients.length)} className={`${styles.button} ${styles.confirmButton}`}><ClipboardCheck size={19} />{handoverSaving ? "جاري التسليم..." : "تأكيد التسليم وإغلاق الشفت"}</button>
          </div>
        </form>
      </div> : null}

      {editingPassenger ? <div className={styles.modalBackdrop} role="presentation">
        <form className={`${styles.modalCard} ${styles.smallModal}`} onSubmit={submitFlightEdit} role="dialog" aria-modal="true" aria-label="تعديل معلومات الرحلة">
          <div className={styles.modalHeader}>
            <div><div className={styles.eyebrow}>تعديل رحلة</div><h2>{editingPassenger.passenger_name}</h2></div>
            <button type="button" className={styles.iconButton} onClick={() => setEditingPassenger(null)} aria-label="إغلاق"><X size={19} /></button>
          </div>
          <div className={styles.fieldsGrid}>
            <Field label="وقت الإقلاع — بتوقيت بغداد"><input required type="datetime-local" className={`${styles.input} ${styles.departureInput}`} value={editFlight.departureAt} onChange={(event) => setEditFlight({ ...editFlight, departureAt: event.target.value })} /></Field>
            <Field label="رقم البوابة"><input maxLength={20} className={styles.input} value={editFlight.gateNumber} onChange={(event) => setEditFlight({ ...editFlight, gateNumber: event.target.value })} placeholder="مثال: B4" /></Field>
          </div>
          <Field label="سبب التعديل / ملاحظة"><input className={styles.input} value={editFlight.reason} onChange={(event) => setEditFlight({ ...editFlight, reason: event.target.value })} placeholder="مثال: تغيير وقت الرحلة" /></Field>
          <div className={styles.modalActions}>
            <button type="button" onClick={() => setEditingPassenger(null)} className={`${styles.button} ${styles.secondaryButton}`}>إلغاء</button>
            <button disabled={pendingPassengerId === editingPassenger.id} className={`${styles.button} ${styles.primaryButton}`}><CheckCircle2 size={18} />حفظ التعديل</button>
          </div>
        </form>
      </div> : null}
    </div>
  </Shell>;
}

function PassengerCard({ passenger, now, pending, onStatus, onEdit, onVoid }: {
  passenger: LoungePassenger;
  now: number;
  pending: boolean;
  onStatus: (id: number, status: PassengerStatus) => Promise<void>;
  onEdit: (passenger: LoungePassenger) => void;
  onVoid: (passenger: LoungePassenger) => Promise<void>;
}) {
  const due = isGateAlertDue(passenger, now);
  const minutes = passenger.departure_at ? Math.ceil((new Date(passenger.departure_at).getTime() - now) / 60000) : null;
  const statusText = passenger.lounge_status === "inside" ? "داخل الصالة" : passenger.lounge_status === "called" ? "تم إبلاغه" : "غادر للبوابة";
  return <article className={`${styles.passengerCard} ${due ? styles.criticalCard : ""} ${passenger.lounge_status === "called" ? styles.calledCard : ""} ${passenger.lounge_status === "departed" ? styles.departedCard : ""}`}>
    <div className={styles.passengerCardTop}>
      <div>
        <strong className={styles.passengerName}>{passenger.passenger_name}</strong>
        <span className={styles.reference}>{passenger.reference}</span>
      </div>
      <span className={styles.statusBadge}>{statusText}</span>
    </div>
    <div className={styles.flightLine}><Plane size={16} /><span>{passenger.airline || "شركة غير محددة"} {passenger.flight_number ? `· ${passenger.flight_number}` : ""}</span>{passenger.destination ? <small>إلى {passenger.destination}</small> : null}</div>
    <div className={styles.timeBox}>
      <Clock3 size={17} />
      <div><span>{passenger.departure_at ? formatBaghdadDeparture(passenger.departure_at) : "وقت الإقلاع غير محدد"}{passenger.gate_number ? ` · البوابة ${passenger.gate_number}` : ""}</span><strong>{countdownText(minutes)}</strong></div>
    </div>
    {due ? <div className={styles.dueLabel}><BellRing size={16} />يجب إبلاغ المسافر الآن</div> : null}
    {passenger.lounge_status === "inside" ? <button disabled={pending} type="button" onClick={() => onStatus(passenger.id, "called")} className={`${styles.button} ${due ? styles.urgentButton : styles.primaryButton}`}>{pending ? "جاري الحفظ..." : "تم إبلاغه بالتوجه للبوابة"}</button> : null}
    {passenger.lounge_status === "called" ? <button disabled={pending} type="button" onClick={() => onStatus(passenger.id, "departed")} className={`${styles.button} ${styles.departButton}`}>{pending ? "جاري الحفظ..." : "غادر إلى البوابة"}</button> : null}
    {passenger.lounge_status === "departed" ? <div className={styles.completedLine}><CheckCircle2 size={17} />تم إكمال إجراء المسافر</div> : null}
    <div className={styles.cardActions}>
      <button disabled={pending} type="button" onClick={() => onEdit(passenger)} className={styles.smallButton}><Pencil size={14} />تعديل الرحلة</button>
      <button disabled={pending} type="button" onClick={() => onVoid(passenger)} className={`${styles.smallButton} ${styles.dangerButton}`}><Trash2 size={14} />إلغاء الإدخال</button>
    </div>
  </article>;
}

function isGateAlertDue(passenger: LoungePassenger, now: number) {
  if (passenger.lounge_status !== "inside" || !passenger.departure_at) return false;
  const minutes = (new Date(passenger.departure_at).getTime() - now) / 60000;
  return minutes <= 15 && minutes >= -120;
}

function passengerPriority(passenger: LoungePassenger, now: number) {
  if (isGateAlertDue(passenger, now)) return 0;
  if (passenger.lounge_status === "called") return 1;
  if (passenger.lounge_status === "inside") return 2;
  return 3;
}

function departureTimestamp(passenger: LoungePassenger) {
  return passenger.departure_at ? new Date(passenger.departure_at).getTime() : Number.MAX_SAFE_INTEGER;
}

function countdownText(minutes: number | null) {
  if (minutes === null) return "أدخل الوقت من بيانات المسافر";
  if (minutes < 0) return `متأخر ${Math.abs(minutes)} دقيقة عن الإقلاع`;
  if (minutes === 0) return "موعد الإقلاع الآن";
  if (minutes <= 15) return `التوجه للبوابة خلال ${minutes} دقيقة`;
  if (minutes < 60) return `متبقي ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `متبقي ${hours} ساعة${rest ? ` و${rest} دقيقة` : ""}`;
}

function formatBaghdadDeparture(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString("ar-IQ", { timeZone: "Asia/Baghdad", day: "numeric", month: "short" })} · ${date.toLocaleTimeString("ar-IQ", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit" })}`;
}

function toBaghdadDateTimeInput(value: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main dir="rtl" className={styles.shell}>{children}</main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

function Notice({ text }: { text: string }) {
  return <div className={styles.notice} role="status">{text}</div>;
}
