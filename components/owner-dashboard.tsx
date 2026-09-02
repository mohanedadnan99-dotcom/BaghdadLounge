"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./owner-dashboard.module.css";

type Lounge = {
  loungeName: string;
  currentSupervisor: string;
  role: string;
  shiftName: string;
  openedAt: string;
  passengers: number;
  cash: number;
  electronic: number;
  credit: number;
  complimentary: number;
  totalIqd: number | string;
  activeEmployees: number;
};

type Activity = {
  reference: string;
  passenger_name: string;
  airline: string;
  flight_number: string;
  payment_type: string;
  amount_iqd: number | string;
  employee_name: string;
  lounge_name?: string;
  sheet_sync_status?: string;
  created_at: string;
};

type InsightData = {
  generatedAt?: string;
  summary?: {
    passengersToday?: number;
    revenueToday?: string;
    passengersYesterday?: number;
    revenueYesterday?: string;
  };
  lounges?: Array<{
    loungeName: string;
    passengers: number;
    totalIqd: string;
    cash: number;
    electronic: number;
    credit: number;
    complimentary: number;
  }>;
  airlinesToday?: Array<{ code: string; name: string; passengers: number; totalIqd: string }>;
  payments?: Array<{ type: string; passengers: number; amountIqd: string }>;
  hourly?: Array<{ hour: string; passengers: number; totalIqd: string }>;
  offline?: { recoveredToday?: number; lastOfflineAt?: string | null };
  lastByLounge?: Array<{ loungeName: string; reference: string; passengerName: string; createdAt: string }>;
  airlineConfig?: { total?: number; active?: number; discountsActive?: number };
};

type DashboardData = {
  lounges?: Lounge[];
  activity?: Activity[];
  sync?: { pending?: number; failed?: number; synced?: number; last_synced_at?: string | null };
  session?: { name?: string; role?: string };
};

const paymentNames: Record<string, string> = {
  cash: "نقدي",
  electronic: "إلكتروني",
  credit: "آجل / شركة",
  complimentary: "مجاني",
  prepaid: "مدفوع مسبقاً",
  voucher: "Voucher",
};

const roleNames: Record<string, string> = { owner: "مالك", manager: "مدير", supervisor: "مسؤول شفت", reception: "استقبال", accountant: "محاسب" };
const loungeNames = ["لاونج بغداد", "عراق لاونج"];

export default function OwnerDashboard({ data }: { data: DashboardData }) {
  const [insights, setInsights] = useState<InsightData>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);

  const loadInsights = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch("/api/ops/admin/insights", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر تحميل نظرة المالك");
      setInsights(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل نظرة المالك");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    loadInsights();
    const timer = window.setInterval(loadInsights, 15000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadInsights]);

  const lounges = useMemo(() => {
    const live = data.lounges || [];
    const metrics = insights.lounges || [];
    return loungeNames.map((name) => {
      const status = live.find((item) => item.loungeName === name);
      const metric = metrics.find((item) => item.loungeName === name);
      return {
        loungeName: name,
        currentSupervisor: status?.currentSupervisor || "لا يوجد شفت مفتوح",
        role: status?.role || "",
        shiftName: status?.shiftName || "",
        openedAt: status?.openedAt || "",
        activeEmployees: status?.activeEmployees || 0,
        passengers: metric?.passengers ?? status?.passengers ?? 0,
        totalIqd: metric?.totalIqd ?? status?.totalIqd ?? 0,
        cash: metric?.cash ?? status?.cash ?? 0,
        electronic: metric?.electronic ?? status?.electronic ?? 0,
        credit: metric?.credit ?? status?.credit ?? 0,
        complimentary: metric?.complimentary ?? status?.complimentary ?? 0,
      };
    });
  }, [data.lounges, insights.lounges]);

  const summary = insights.summary || {};
  const passengersToday = Number(summary.passengersToday || 0);
  const revenueToday = Number(summary.revenueToday || 0);
  const passengersYesterday = Number(summary.passengersYesterday || 0);
  const revenueYesterday = Number(summary.revenueYesterday || 0);
  const averageTicket = passengersToday ? Math.round(revenueToday / passengersToday) : 0;
  const sync = data.sync || {};
  const pendingSync = Number(sync.pending || 0);
  const failedSync = Number(sync.failed || 0);
  const recoveredOffline = Number(insights.offline?.recoveredToday || 0);
  const airlineConfig = insights.airlineConfig || {};
  const activity = (data.activity || []).slice(0, 8);
  const airlines = insights.airlinesToday || [];
  const maxAirline = Math.max(1, ...airlines.map((item) => item.passengers));
  const hourly = insights.hourly || [];
  const maxHour = Math.max(1, ...hourly.map((item) => item.passengers));
  const paymentTotal = (insights.payments || []).reduce((sum, item) => sum + Number(item.amountIqd || 0), 0);

  const alerts = useMemo(() => {
    const items: Array<{ level: "good" | "warn" | "bad"; title: string; text: string }> = [];
    for (const lounge of lounges) {
      if (!lounge.shiftName) items.push({ level: "bad", title: `${lounge.loungeName}: ماكو شفت مفتوح`, text: "لازم مسؤول الشفت يفتح الشفت قبل تسجيل عمليات جديدة." });
    }
    if (failedSync > 0) items.push({ level: "bad", title: `${failedSync} عملية فشلت بالمزامنة`, text: "العمليات محفوظة بقاعدة البيانات وتحتاج إعادة محاولة Google Sheet." });
    else if (pendingSync > 0) items.push({ level: "warn", title: `${pendingSync} عملية بانتظار المزامنة`, text: "النظام يحتفظ بها تلقائياً إلى أن تكتمل المزامنة." });
    if (recoveredOffline > 0) items.push({ level: "good", title: `${recoveredOffline} عملية استرجعت بعد انقطاع اليوم`, text: "تم حفظها محلياً ثم إرسالها للنظام بعد رجوع الاتصال." });
    if (!items.length) items.push({ level: "good", title: "الوضع التشغيلي مستقر", text: "ماكو تنبيهات حرجة حالياً، والمزامنة تعمل بصورة طبيعية." });
    return items;
  }, [lounges, failedSync, pendingSync, recoveredOffline]);

  const sessionName = data.session?.name || "الإدارة";
  const sessionRole = roleNames[data.session?.role || ""] || data.session?.role || "إدارة";

  return <div className={styles.dashboard}>
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <div>
          <div className={styles.heroLabel}>OWNER COMMAND CENTER</div>
          <div className={styles.heroTitle}>صباح الخير، {sessionName}</div>
          <div className={styles.heroSub}>هذه الصورة المختصرة لكل ما يصير بالصالتين الآن: الشفتات، المسافرين، الإيراد، شركات الطيران، والتنبيهات المهمة فقط.</div>
        </div>
        <div className={styles.heroBadge}><span className={styles.dot}/>{online ? "لوحة المالك متصلة" : "لوحة المالك دون إنترنت"}</div>
      </div>
      <aside className={styles.health}>
        <div className={styles.healthTitle}><span>حالة النظام</span><button className={styles.refresh} onClick={loadInsights} disabled={refreshing}>{refreshing ? "جاري التحديث" : "تحديث"}</button></div>
        <HealthRow label="قاعدة البيانات" value={error ? "تعذر التحديث" : "متصلة"} tone={error ? "bad" : "good"}/>
        <HealthRow label="Google Sheet" value={failedSync ? `${failedSync} فشل` : pendingSync ? `${pendingSync} معلّق` : "مستقرة"} tone={failedSync ? "bad" : pendingSync ? "warn" : "good"}/>
        <HealthRow label="عمليات Offline اليوم" value={String(recoveredOffline)} tone="good"/>
        <HealthRow label="آخر تحديث" value={insights.generatedAt ? shortTime(insights.generatedAt) : "—"} tone="neutral"/>
      </aside>
    </section>

    {error && <div className={styles.alert}><div className={`${styles.alertIcon} ${styles.bad}`}>!</div><div><div className={styles.alertTitle}>تعذر تحديث جزء من إحصائيات المالك</div><div className={styles.alertText}>{error} — بقية نظام التشغيل يبقى شغال.</div></div></div>}

    <section className={styles.summaryGrid}>
      <Stat label="مسافرين اليوم" value={passengersToday.toLocaleString("en-US")} foot={<Trend current={passengersToday} previous={passengersYesterday}/>} />
      <Stat label="إيراد اليوم" value={money(revenueToday)} foot={<Trend current={revenueToday} previous={revenueYesterday}/>} />
      <Stat label="متوسط المسافر" value={money(averageTicket)} foot={<span>من إجمالي عمليات اليوم</span>} />
      <Stat label="خصومات شركات فعالة" value={String(airlineConfig.discountsActive || 0)} foot={<span>{airlineConfig.active || 0} شركة فعالة من {airlineConfig.total || 0}</span>} />
    </section>

    <section className={styles.lounges}>
      {lounges.map((lounge) => {
        const last = (insights.lastByLounge || []).find((item) => item.loungeName === lounge.loungeName);
        const open = Boolean(lounge.shiftName);
        return <article className={styles.loungeCard} key={lounge.loungeName}>
          <div className={styles.loungeTop}><div><div className={styles.loungeName}>{lounge.loungeName}</div><div className={styles.panelSub}>الوضع الحالي للصالة</div></div><span className={`${styles.loungeState} ${open ? styles.open : styles.closed}`}>{open ? "الشفت مفتوح" : "الشفت مغلق"}</span></div>
          <div className={styles.supervisor}><div className={styles.supervisorLabel}>مسؤول الشفت الحالي</div><div className={styles.supervisorName}>{lounge.currentSupervisor}</div><div className={styles.supervisorMeta}>{open ? `${lounge.shiftName} · ${roleNames[lounge.role] || lounge.role || "موظف"}` : "يحتاج فتح شفت"}</div></div>
          <div className={styles.loungeMetrics}><Mini label="المسافرين" value={String(lounge.passengers)}/><Mini label="الإيراد" value={money(lounge.totalIqd)}/><Mini label="الموظفين" value={String(lounge.activeEmployees)}/></div>
          <div className={styles.lastActivity}><span>نقدي {lounge.cash} · إلكتروني {lounge.electronic} · آجل {lounge.credit} · مجاني {lounge.complimentary}</span><span>{last ? `آخر عملية ${shortTime(last.createdAt)}` : "لا توجد عمليات بعد"}</span></div>
        </article>;
      })}
    </section>

    <section className={styles.contentGrid}>
      <div className={styles.panel}>
        <PanelHeader title="مركز التنبيهات" sub="الأشياء التي تحتاج انتباه المدير فقط" />
        <div className={styles.alertList}>{alerts.map((alert, index) => <div className={styles.alert} key={`${alert.title}-${index}`}><div className={`${styles.alertIcon} ${styles[alert.level]}`}>{alert.level === "bad" ? "!" : alert.level === "warn" ? "•" : "✓"}</div><div><div className={styles.alertTitle}>{alert.title}</div><div className={styles.alertText}>{alert.text}</div></div></div>)}</div>
      </div>
      <div className={styles.panel}>
        <PanelHeader title="الأكثر استخداماً اليوم" sub="شركات الطيران حسب عدد المسافرين" />
        <div className={styles.airlineList}>{airlines.length ? airlines.map((airline) => <div className={styles.airlineRow} key={airline.code}><div className={styles.airlineCode}>{airline.code}</div><div><div className={styles.airlineName}>{airline.name}</div><div className={styles.airlineMeta}>{money(airline.totalIqd)}<div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.max(8, Math.round(airline.passengers / maxAirline * 100))}%` }}/></div></div></div><div className={styles.airlineCount}>{airline.passengers} مسافر</div></div>) : <div className={styles.empty}>ماكو عمليات شركات طيران مسجلة اليوم بعد.</div>}</div>
      </div>
    </section>

    <section className={styles.contentGrid}>
      <div className={styles.panel}>
        <PanelHeader title="حركة اليوم" sub="توزيع دخول المسافرين حسب الساعة بتوقيت بغداد" />
        {hourly.length ? <div className={styles.hourChart}>{hourly.map((item) => <div className={styles.hourItem} key={item.hour}><div className={styles.hourValue}>{item.passengers}</div><div className={styles.hourBar} style={{ height: `${Math.max(4, Math.round(item.passengers / maxHour * 105))}px` }}/><div className={styles.hourLabel}>{item.hour}</div></div>)}</div> : <div className={styles.empty}>تظهر حركة الساعات بعد أول عملية اليوم.</div>}
      </div>
      <div className={styles.panel}>
        <PanelHeader title="توزيع الإيراد" sub="المبالغ حسب طريقة الحساب" />
        <div className={styles.paymentList}>{(insights.payments || []).length ? (insights.payments || []).sort((a,b) => Number(b.amountIqd)-Number(a.amountIqd)).map((item) => {const amount=Number(item.amountIqd||0);const percent=paymentTotal ? Math.round(amount/paymentTotal*100) : 0;return <div key={item.type}><div className={styles.paymentTop}><span className={styles.paymentName}>{paymentNames[item.type] || item.type}</span><span className={styles.paymentValue}>{money(amount)} · {percent}%</span></div><div className={styles.barTrack}><div className={styles.barFill} style={{width:`${percent}%`}}/></div></div>}) : <div className={styles.empty}>لا توجد مبالغ مسجلة اليوم.</div>}</div>
      </div>
    </section>

    <section className={styles.panel}>
      <PanelHeader title="اختصارات الإدارة" sub="أكثر الأدوات استخداماً بدون الدخول بتفاصيل كثيرة" />
      <div className={styles.quickActions}><a className={styles.quickAction} href="/ops/admin/airlines">شركات الطيران والأسعار</a><a className={styles.quickAction} href="/ops/admin/settings">إعدادات التسعير</a><a className={styles.quickAction} href="/ops">واجهة باب الصالة</a><a className={styles.quickAction} href="/api/ops/export">تصدير Excel</a></div>
    </section>

    <section className={styles.panel}>
      <PanelHeader title="آخر الحركات" sub="آخر 8 عمليات من الصالتين" />
      <div className={styles.activity}><table className={styles.activityTable}><thead><tr><th>الوقت</th><th>الصالة</th><th>المسافر</th><th>الطيران</th><th>الرحلة</th><th>الحساب</th><th>المبلغ</th><th>الموظف</th><th>المزامنة</th></tr></thead><tbody>{activity.length ? activity.map((row) => <tr key={row.reference}><td>{shortTime(row.created_at)}</td><td>{row.lounge_name || "—"}</td><td>{row.passenger_name}</td><td>{row.airline || "—"}</td><td>{row.flight_number || "—"}</td><td>{paymentNames[row.payment_type] || row.payment_type}</td><td>{money(row.amount_iqd)}</td><td>{row.employee_name}</td><td className={syncClass(row.sheet_sync_status)}>{syncText(row.sheet_sync_status)}</td></tr>) : <tr><td colSpan={9} className={styles.empty}>لا توجد عمليات بعد.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}

function PanelHeader({ title, sub }: { title: string; sub: string }) {
  return <div className={styles.panelHeader}><div><div className={styles.panelTitle}>{title}</div><div className={styles.panelSub}>{sub}</div></div></div>;
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  return <div className={styles.healthRow}><span>{label}</span><span className={`${styles.healthValue} ${tone === "neutral" ? "" : styles[tone]}`}>{value}</span></div>;
}

function Stat({ label, value, foot }: { label: string; value: string; foot: React.ReactNode }) {
  return <article className={styles.stat}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statFoot}>{foot}</div></article>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className={styles.mini}><span>{label}</span><b>{value}</b></div>;
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (!previous && !current) return <span className={styles.trendFlat}>نفس مستوى أمس</span>;
  if (!previous) return <span className={styles.trendUp}>بداية نشاط اليوم</span>;
  const percent = Math.round((current - previous) / previous * 100);
  if (!percent) return <span className={styles.trendFlat}>0% مقارنة بأمس</span>;
  return <span className={percent > 0 ? styles.trendUp : styles.trendDown}>{percent > 0 ? "+" : ""}{percent}% مقارنة بأمس</span>;
}

function money(value: number | string | undefined) {
  return `${Number(value || 0).toLocaleString("en-US")} د.ع`;
}

function shortTime(value?: string | null) {
  if (!value) return "—";
  try { return new Date(value).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" }); } catch { return "—"; }
}

function syncText(value?: string) {
  return value === "synced" ? "تم" : value === "failed" ? "فشل" : value === "pending" ? "معلّق" : "—";
}

function syncClass(value?: string) {
  return value === "synced" ? styles.syncOk : value === "failed" ? styles.syncBad : styles.syncPending;
}
