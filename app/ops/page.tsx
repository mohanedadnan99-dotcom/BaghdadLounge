"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Camera,
  CheckCircle2,
  Clock3,
  DoorOpen,
  LogOut,
  Plane,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { parseIataBcbp } from "@/lib/boarding-pass";
import styles from "./door.module.css";

type User = { employeeId?: number; id?: number; name: string; username: string; role: string; assignedShift: string };
type Shift = { id: number; shift_name: string; opened_at: string } | null;
type PassengerStatus = "inside" | "called" | "departed";
type LoungePassenger = {
  id: number;
  reference: string;
  passenger_name: string;
  airline: string;
  flight_number: string;
  destination: string;
  seat: string;
  departure_at: string | null;
  lounge_status: PassengerStatus;
  gate_called_at: string | null;
  gate_departed_at: string | null;
  created_at: string;
  employee_name: string;
};
type EntryState = {
  passengerName: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  seat: string;
  departureAt: string;
  paymentType: string;
  billingCompany: string;
  amountIqd: string;
  boardingRaw: string;
  notes: string;
};

const paymentLabels = [
  ["cash", "نقدي"],
  ["electronic", "دفع إلكتروني"],
  ["credit", "آجل / حساب شركة"],
  ["prepaid", "مدفوع مسبقاً"],
  ["voucher", "Voucher / قسيمة"],
  ["complimentary", "مجاني"],
];
const scanFormats = ["qr_code", "pdf417", "aztec", "data_matrix", "code_128"];
const blankEntry = (): EntryState => ({
  passengerName: "",
  airline: "",
  flightNumber: "",
  origin: "",
  destination: "",
  seat: "",
  departureAt: "",
  paymentType: "cash",
  billingCompany: "",
  amountIqd: "40000",
  boardingRaw: "",
  notes: "",
});

export default function OpsStaffPage() {
  const [user, setUser] = useState<User | null>(null);
  const [shift, setShift] = useState<Shift>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [entry, setEntry] = useState<EntryState>(blankEntry());
  const [passengers, setPassengers] = useState<LoungePassenger[]>([]);
  const [passengersLoading, setPassengersLoading] = useState(false);
  const [passengerQuery, setPassengerQuery] = useState("");
  const [pendingPassengerId, setPendingPassengerId] = useState<number | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cameraOn, setCameraOn] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);
  const alertedPassengerIds = useRef(new Set<number>());
  const alertsArmedRef = useRef(false);

  async function refreshSession() {
    const res = await fetch("/api/ops/session", { cache: "no-store" });
    if (!res.ok) {
      setUser(null);
      setShift(null);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
    await refreshShift();
  }

  async function refreshShift() {
    const res = await fetch("/api/ops/shift", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setShift(data.shift || null);
    }
  }

  async function refreshPassengers(silent = false) {
    if (!silent) setPassengersLoading(true);
    try {
      const res = await fetch("/api/ops/entries", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const rows = Array.isArray(data.passengers) ? data.passengers as LoungePassenger[] : [];
      setPassengers(rows);
      setNow(Date.now());
      notifyCriticalPassengers(rows);
    } catch (error) {
      console.error("refresh passengers", error);
      if (!silent) setMessage("تعذر تحديث قائمة مسافري الصالة");
    } finally {
      if (!silent) setPassengersLoading(false);
    }
  }

  useEffect(() => {
    refreshSession();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshPassengers();
    const passengerPoll = window.setInterval(() => refreshPassengers(true), 20_000);
    const clockTick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      window.clearInterval(passengerPoll);
      window.clearInterval(clockTick);
    };
  }, [user?.employeeId, user?.id]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      alertsArmedRef.current = true;
      setAlertsEnabled(true);
    }
  }, []);

  async function doLogin(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
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
    setLogin({ username: "", password: "" });
    setMessage("تم تسجيل الدخول");
    await refreshShift();
  }

  async function logout() {
    stopCamera();
    await fetch("/api/ops/session", { method: "DELETE" });
    setUser(null);
    setShift(null);
    setPassengers([]);
    setMessage("");
  }

  async function openShift() {
    setMessage("");
    const res = await fetch("/api/ops/shift", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "تعذر فتح الشفت");
      return;
    }
    setShift(data.shift);
    setMessage("تم فتح الشفت");
  }

  async function closeShift() {
    if (!confirm("تأكيد إغلاق الشفت وإظهار التقرير النهائي؟")) return;
    stopCamera();
    const cash = prompt("النقد الفعلي الموجود عند الإغلاق (اختياري). اتركه فارغ حتى يعتمد المتوقع تلقائياً:", "");
    const body: { note: string; closingCashIqd?: number } = { note: "" };
    if (cash?.trim()) body.closingCashIqd = Number(cash.replace(/\D/g, ""));
    const res = await fetch("/api/ops/shift", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "تعذر إغلاق الشفت");
      return;
    }
    setShift(null);
    const summary = data.shift?.summary || {};
    setMessage(`تم إغلاق الشفت — المسافرين: ${Number(summary.passengers || 0)} | المجموع: ${Number(summary.total_iqd || 0).toLocaleString("en-US")} د.ع | النقد المتوقع: ${Number(summary.expectedCashIqd || 0).toLocaleString("en-US")} د.ع | الفرق: ${Number(summary.cashDifferenceIqd || 0).toLocaleString("en-US")} د.ع`);
  }

  async function submitEntry(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const send = async (overrideDuplicate = false): Promise<void> => {
      const res = await fetch("/api/ops/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entry,
          amountIqd: Number(entry.amountIqd || 40000),
          entrySource: entry.boardingRaw.trim() ? "scan" : "manual",
          overrideDuplicate,
        }),
      });
      const data = await res.json();
      if (!res.ok && data.requiresDuplicateOverride) {
        if (confirm(`${data.message}\n\nهل تريد تسجيل الدخول مرة ثانية بعد التأكد؟`)) return send(true);
        setMessage("تم إلغاء التسجيل المكرر");
        return;
      }
      if (!res.ok) {
        setMessage(data.message || "تعذر تسجيل المسافر");
        return;
      }
      setMessage(`تم تأكيد دخول ${data.entry.passenger_name} — ${data.entry.reference}${data.sheetSync === "synced" ? " — تمت مزامنة Google Sheet" : data.sheetSync === "failed" ? " — محفوظ، ومزامنة الشيت تحتاج إعادة محاولة" : " — محفوظ ومزامنة الشيت معلقة"}`);
      setEntry(blankEntry());
      setFileName("");
      setScanStatus("");
      await refreshPassengers(true);
    };
    await send(false);
  }

  async function updatePassengerStatus(id: number, status: PassengerStatus) {
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
          body: `${passenger.passenger_name} · الرحلة ${passenger.flight_number || "غير محددة"} · حان وقت التوجه للبوابة`,
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

  function detectorAvailable() {
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  }

  async function makeDetector() {
    const Detector = (window as typeof window & { BarcodeDetector?: any }).BarcodeDetector;
    let formats = scanFormats;
    try {
      if (Detector.getSupportedFormats) {
        const supported = await Detector.getSupportedFormats();
        formats = scanFormats.filter((format) => supported.includes(format));
      }
    } catch {}
    return new Detector(formats.length ? { formats } : undefined);
  }

  function fillFromRaw(raw: string) {
    const parsed = parseIataBcbp(raw);
    setEntry((current) => ({
      ...current,
      boardingRaw: raw.trim(),
      amountIqd: current.amountIqd || "40000",
      ...(parsed ? {
        passengerName: parsed.passengerName || current.passengerName,
        airline: parsed.carrier || current.airline,
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
    setScanStatus("");
    if (!detectorAvailable()) {
      setScanStatus("هذا المتصفح لا يدعم قارئ الباركود المباشر. استخدم قارئ USB/Bluetooth أو ارفع صورة/PDF.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
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
          scanTimer.current = window.setTimeout(tick, 350);
        };
        tick();
      }, 50);
    } catch (error) {
      console.error(error);
      setScanStatus("تعذر فتح الكاميرا. استخدم رفع صورة/PDF أو قارئ خارجي.");
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

  async function scanSource(source: ImageBitmapSource) {
    if (!detectorAvailable()) return false;
    const detector = await makeDetector();
    const hits = await detector.detect(source);
    if (hits?.[0]?.rawValue) {
      acceptScan(String(hits[0].rawValue), String(hits[0].format || ""));
      return true;
    }
    return false;
  }

  async function scanImageFile(file: File) {
    if (!detectorAvailable()) {
      setScanStatus("هذا الجهاز ما يدعم القراءة التلقائية من الصورة. استخدم القارئ الخارجي أو الإدخال اليدوي.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const ok = await scanSource(bitmap);
      bitmap.close();
      if (!ok) setScanStatus("ما قدرت أقرأ الباركود من الصورة. جرّب صورة أوضح أو PDF الأصلي.");
    } catch {
      setScanStatus("تعذر تحليل الصورة.");
    }
  }

  async function scanPdfFile(file: File) {
    if (!detectorAvailable()) {
      setScanStatus("هذا الجهاز ما يدعم فحص الباركود تلقائياً من PDF. استخدم القارئ الخارجي أو صورة واضحة.");
      return;
    }
    setScanStatus("جاري قراءة ملف PDF...");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      const pages = Math.min(pdf.numPages, 3);
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        setScanStatus(`جاري فحص صفحة ${pageNumber} من ${pages}...`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2.2 });
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

  const visiblePassengers = useMemo(() => {
    const query = passengerQuery.trim().toLowerCase();
    return passengers
      .filter((passenger) => !query || [passenger.passenger_name, passenger.reference, passenger.flight_number, passenger.airline, passenger.destination].some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((first, second) => passengerPriority(first, now) - passengerPriority(second, now) || departureTimestamp(first) - departureTimestamp(second));
  }, [passengers, passengerQuery, now]);

  const criticalPassengers = useMemo(() => passengers.filter((passenger) => isGateAlertDue(passenger, now)), [passengers, now]);
  const insideCount = passengers.filter((passenger) => passenger.lounge_status === "inside").length;
  const calledCount = passengers.filter((passenger) => passenger.lounge_status === "called").length;

  if (loading) return <Shell><div className={styles.card}>جاري تحميل نظام الصالة...</div></Shell>;
  if (!user) {
    return <Shell>
      <div className={styles.loginWrap}>
        <form onSubmit={doLogin} className={`${styles.card} ${styles.loginCard}`}>
          <div className={styles.brand}>BAGHDAD LOUNGE</div>
          <h1>تسجيل دخول الموظف</h1>
          <p>كل موظف يدخل بيوزره الخاص قبل فتح الشفت.</p>
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
          <div className={styles.muted}>{user.name} · {user.assignedShift}</div>
        </div>
        <div className={styles.headerActions}>
          {user.role === "owner" || user.role === "manager" ? <a href="/ops/admin" className={`${styles.button} ${styles.secondaryButton}`}><Settings2 size={17} />لوحة الإدارة</a> : null}
          <button type="button" onClick={logout} className={`${styles.button} ${styles.secondaryButton}`}><LogOut size={17} />تسجيل خروج</button>
        </div>
      </header>

      {criticalPassengers.length ? <section className={styles.gateAlert} aria-live="assertive">
        <div className={styles.gateAlertIcon}><BellRing size={24} /></div>
        <div className={styles.gateAlertCopy}>
          <strong>حان وقت التوجه إلى البوابة</strong>
          <span>{criticalPassengers.map((passenger) => `${passenger.passenger_name}${passenger.flight_number ? ` — ${passenger.flight_number}` : ""}`).join("، ")}</span>
        </div>
      </section> : null}

      {message && <Notice text={message} />}

      <section className={`${styles.card} ${styles.shiftBar}`}>
        <div>
          <div className={styles.shiftTitle}>الشفت</div>
          {shift ? <div className={styles.shiftOpen}>مفتوح — {shift.shift_name} — منذ {new Date(shift.opened_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" })}</div> : <div className={styles.shiftClosed}>لا يوجد شفت مفتوح</div>}
        </div>
        {shift ? <button type="button" onClick={closeShift} className={`${styles.button} ${styles.secondaryButton}`}>إغلاق الشفت</button> : <button type="button" onClick={openShift} className={`${styles.button} ${styles.primaryButton}`}>فتح الشفت</button>}
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
            {visiblePassengers.map((passenger) => <PassengerCard key={passenger.id} passenger={passenger} now={now} pending={pendingPassengerId === passenger.id} onStatus={updatePassengerStatus} />)}
          </div>
        </aside>

        <form onSubmit={submitEntry} className={`${styles.card} ${styles.entryForm} ${!shift ? styles.disabledForm : ""}`}>
          <div className={styles.formHeader}>
            <div>
              <div className={styles.eyebrow}>بوابة الدخول</div>
              <h2>تسجيل وتأكيد دخول مسافر</h2>
              <p>امسح البوردنغ أو أدخل المعلومات، وحدد وقت الإقلاع حتى يعمل تنبيه الـ15 دقيقة.</p>
            </div>
            <div className={styles.scanReady}><ScanLine size={17} />SCAN READY</div>
          </div>

          <section className={styles.scanActions}>
            <button type="button" onClick={cameraOn ? stopCamera : startCamera} className={`${styles.button} ${cameraOn ? styles.primaryButton : styles.secondaryButton}`}><Camera size={18} />{cameraOn ? "إيقاف الكاميرا" : "فتح الكاميرا والمسح"}</button>
            <label className={`${styles.button} ${styles.secondaryButton}`}><Upload size={18} />رفع صورة أو PDF<input type="file" accept="image/*,application/pdf" onChange={(event) => onFile(event.target.files?.[0])} hidden /></label>
            <label className={`${styles.button} ${styles.secondaryButton}`}><Camera size={18} />التقاط صورة<input type="file" accept="image/*" capture="environment" onChange={(event) => onFile(event.target.files?.[0])} hidden /></label>
          </section>

          {cameraOn ? <div className={styles.cameraFrame}><video ref={videoRef} muted playsInline /></div> : null}
          {scanStatus || fileName ? <div className={styles.scanStatus}>{fileName ? <strong>الملف: {fileName}</strong> : null}<span>{scanStatus}</span></div> : null}

          <Field label="نص الباركود / Boarding Pass Raw Data">
            <textarea rows={3} className={styles.input} value={entry.boardingRaw} onChange={(event) => { const raw = event.target.value; setEntry((current) => ({ ...current, boardingRaw: raw })); if (raw.startsWith("M") && raw.length >= 58) fillFromRaw(raw); }} placeholder="ينملأ تلقائياً من الكاميرا أو القارئ أو الملف" />
          </Field>

          <div className={styles.fieldsGrid}>
            <Field label="اسم المسافر"><input required className={styles.input} value={entry.passengerName} onChange={(event) => setEntry({ ...entry, passengerName: event.target.value })} /></Field>
            <Field label="شركة الطيران"><input className={styles.input} value={entry.airline} onChange={(event) => setEntry({ ...entry, airline: event.target.value })} /></Field>
            <Field label="رقم الرحلة"><input className={styles.input} value={entry.flightNumber} onChange={(event) => setEntry({ ...entry, flightNumber: event.target.value })} /></Field>
            <Field label="وقت الإقلاع — بتوقيت بغداد"><input required type="datetime-local" className={`${styles.input} ${styles.departureInput}`} value={entry.departureAt} onChange={(event) => setEntry({ ...entry, departureAt: event.target.value })} /></Field>
            <Field label="من"><input className={styles.input} value={entry.origin} onChange={(event) => setEntry({ ...entry, origin: event.target.value })} /></Field>
            <Field label="إلى"><input className={styles.input} value={entry.destination} onChange={(event) => setEntry({ ...entry, destination: event.target.value })} /></Field>
            <Field label="المقعد"><input className={styles.input} value={entry.seat} onChange={(event) => setEntry({ ...entry, seat: event.target.value })} /></Field>
          </div>

          <div className={styles.fieldsGrid}>
            <Field label="طريقة الحساب"><select className={styles.input} value={entry.paymentType} onChange={(event) => setEntry({ ...entry, paymentType: event.target.value })}>{paymentLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            {entry.paymentType === "credit" ? <Field label="الجهة / الشركة المحاسبة"><input required className={styles.input} value={entry.billingCompany} onChange={(event) => setEntry({ ...entry, billingCompany: event.target.value })} /></Field> : null}
            <Field label="المبلغ (د.ع)"><input inputMode="numeric" className={styles.input} value={entry.amountIqd} onChange={(event) => setEntry({ ...entry, amountIqd: event.target.value.replace(/\D/g, "") })} /></Field>
          </div>

          <Field label="ملاحظات"><input className={styles.input} value={entry.notes} onChange={(event) => setEntry({ ...entry, notes: event.target.value })} /></Field>
          <button className={`${styles.button} ${styles.confirmButton}`}><CheckCircle2 size={20} />تأكيد دخول المسافر وإضافته للقائمة</button>
        </form>
      </div>
    </div>
  </Shell>;
}

function PassengerCard({ passenger, now, pending, onStatus }: { passenger: LoungePassenger; now: number; pending: boolean; onStatus: (id: number, status: PassengerStatus) => Promise<void> }) {
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
      <div><span>{passenger.departure_at ? formatBaghdadDeparture(passenger.departure_at) : "وقت الإقلاع غير محدد"}</span><strong>{countdownText(minutes)}</strong></div>
    </div>
    {due ? <div className={styles.dueLabel}><BellRing size={16} />يجب إبلاغ المسافر الآن</div> : null}
    {passenger.lounge_status === "inside" ? <button disabled={pending} type="button" onClick={() => onStatus(passenger.id, "called")} className={`${styles.button} ${due ? styles.urgentButton : styles.primaryButton}`}>{pending ? "جاري الحفظ..." : "تم إبلاغه بالتوجه للبوابة"}</button> : null}
    {passenger.lounge_status === "called" ? <button disabled={pending} type="button" onClick={() => onStatus(passenger.id, "departed")} className={`${styles.button} ${styles.departButton}`}>{pending ? "جاري الحفظ..." : "غادر إلى البوابة"}</button> : null}
    {passenger.lounge_status === "departed" ? <div className={styles.completedLine}><CheckCircle2 size={17} />تم إكمال إجراء المسافر</div> : null}
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

function Shell({ children }: { children: React.ReactNode }) {
  return <main dir="rtl" className={styles.shell}>{children}</main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

function Notice({ text }: { text: string }) {
  return <div className={styles.notice} role="status">{text}</div>;
}
