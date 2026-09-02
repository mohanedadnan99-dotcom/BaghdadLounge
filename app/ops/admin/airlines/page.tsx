"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, BadgePercent, Building2, CheckCircle2, Plane, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import styles from "./airlines.module.css";

type DiscountType = "none" | "amount" | "percent";
type AirlinePrice = {
  loungeName: string;
  basePriceIqd: number;
  discountType: DiscountType;
  discountValue: number;
  discountFrom: string | null;
  discountTo: string | null;
  paymentType: string;
  active: boolean;
  discountActive?: boolean;
  finalPriceIqd?: number;
  updatedAt?: string;
};
type Airline = {
  code: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
  notes: string;
  updatedAt?: string;
  prices: AirlinePrice[];
};

const lounges = ["لاونج بغداد", "عراق لاونج"];
const paymentLabels: Record<string, string> = { cash: "نقدي", electronic: "إلكتروني", credit: "آجل", complimentary: "مجاني", prepaid: "مدفوع مسبقاً", voucher: "قسيمة" };

function blankPrice(loungeName: string): AirlinePrice {
  return { loungeName, basePriceIqd: 40000, discountType: "none", discountValue: 0, discountFrom: null, discountTo: null, paymentType: "cash", active: true };
}

function blankAirline(): Airline {
  return { code: "", nameAr: "", nameEn: "", active: true, notes: "", prices: lounges.map(blankPrice) };
}

function finalPrice(price: AirlinePrice) {
  const base = Math.max(0, Number(price.basePriceIqd || 0));
  const value = Math.max(0, Number(price.discountValue || 0));
  if (price.discountType === "amount") return Math.max(0, base - value);
  if (price.discountType === "percent") return Math.max(0, Math.round(base * (100 - Math.min(100, value)) / 100));
  return base;
}

function formatMoney(value: unknown) {
  return `${Number(value || 0).toLocaleString("en-US")} د.ع`;
}

function toBaghdadInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function fromBaghdadInput(value: string) {
  return value ? new Date(`${value}:00+03:00`).toISOString() : null;
}

export default function AirlinesManagementPage() {
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [selected, setSelected] = useState<Airline | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ops/airlines", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تحميل شركات الطيران");
      setAirlines(Array.isArray(data.airlines) ? data.airlines : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل شركات الطيران");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return airlines;
    return airlines.filter((airline) => [airline.code, airline.nameAr, airline.nameEn].some((value) => value.toLowerCase().includes(needle)));
  }, [airlines, query]);

  const activeDiscounts = useMemo(() => airlines.reduce((count, airline) => count + airline.prices.filter((price) => price.discountActive).length, 0), [airlines]);

  function edit(airline: Airline) {
    setSelected({
      ...airline,
      prices: lounges.map((loungeName) => ({ ...blankPrice(loungeName), ...(airline.prices.find((price) => price.loungeName === loungeName) || {}) })),
    });
    setMessage("");
  }

  function patchPrice(loungeName: string, updates: Partial<AirlinePrice>) {
    setSelected((current) => current ? { ...current, prices: current.prices.map((price) => price.loungeName === loungeName ? { ...price, ...updates } : price) } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...selected,
        code: selected.code.trim().toUpperCase(),
        prices: selected.prices.map((price) => ({
          ...price,
          basePriceIqd: Number(price.basePriceIqd || 0),
          discountValue: Number(price.discountValue || 0),
          discountFrom: fromBaghdadInput(toBaghdadInput(price.discountFrom)),
          discountTo: fromBaghdadInput(toBaghdadInput(price.discountTo)),
        })),
      };
      const response = await fetch("/api/ops/airlines", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر حفظ شركة الطيران");
      setMessage(`تم حفظ ملف ${data.airline?.nameAr || selected.nameAr}`);
      setSelected(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ شركة الطيران");
    } finally { setSaving(false); }
  }

  return <main dir="rtl" className={styles.shell}>
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>AIRLINE PRICING DIRECTORY</div>
          <h1>شركات الطيران</h1>
          <p>كل شركة إلها ملف واحد، وسعر مستقل لكل صالة. النظام يتعرّف على رمز الشركة من البوردنغ ويطبّق السعر تلقائياً.</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/ops/admin" className={styles.secondaryButton}><ArrowRight size={18}/>الداشبورد</a>
          <button type="button" className={styles.primaryButton} onClick={() => setSelected(blankAirline())}><Plus size={18}/>إضافة شركة</button>
        </div>
      </header>

      <section className={styles.metrics}>
        <Metric icon={<Plane/>} label="الشركات المعرفة" value={airlines.length}/>
        <Metric icon={<CheckCircle2/>} label="الشركات الفعالة" value={airlines.filter((airline) => airline.active).length}/>
        <Metric icon={<BadgePercent/>} label="خصومات فعالة" value={activeDiscounts}/>
        <Metric icon={<Building2/>} label="الصالات المرتبطة" value={2}/>
      </section>

      <section className={styles.directory}>
        <div className={styles.directoryHeader}>
          <div className={styles.searchBox}><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الرمز، مثال TK"/></div>
          <button type="button" className={styles.iconButton} onClick={() => void load()} aria-label="تحديث"><RefreshCw size={18}/></button>
        </div>
        {message ? <div className={styles.message}>{message}</div> : null}
        {loading ? <div className={styles.empty}>جاري تحميل ملفات شركات الطيران...</div> : null}
        {!loading && !visible.length ? <div className={styles.empty}>ماكو شركة مطابقة للبحث.</div> : null}
        <div className={styles.airlineGrid}>
          {visible.map((airline) => <button type="button" key={airline.code} className={styles.airlineCard} onClick={() => edit(airline)}>
            <span className={styles.code}>{airline.code}</span>
            <span className={styles.airlineIdentity}><strong>{airline.nameAr}</strong><small>{airline.nameEn}</small></span>
            <span className={styles.priceColumns}>
              {lounges.map((loungeName) => { const price = airline.prices.find((item) => item.loungeName === loungeName); return <span key={loungeName}><small>{loungeName}</small><strong>{formatMoney(price?.finalPriceIqd ?? price?.basePriceIqd)}</strong>{price?.discountActive ? <em>خصم فعّال</em> : null}</span>; })}
            </span>
            <span className={airline.active ? styles.active : styles.inactive}>{airline.active ? "فعالة" : "موقوفة"}</span>
          </button>)}
        </div>
      </section>
    </div>

    {selected ? <div className={styles.backdrop} role="presentation">
      <form className={styles.editor} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="airline-profile-title">
        <div className={styles.editorHeader}><div><span className={styles.kicker}>AIRLINE PROFILE</span><h2 id="airline-profile-title">{selected.nameAr || "شركة طيران جديدة"}</h2></div><button type="button" className={styles.iconButton} onClick={() => setSelected(null)} aria-label="إغلاق"><X size={20}/></button></div>
        <div className={styles.profileGrid}>
          <Field label="رمز IATA"><input required disabled={airlines.some((airline) => airline.code === selected.code)} dir="ltr" maxLength={3} value={selected.code} onChange={(event) => setSelected({ ...selected, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="TK"/></Field>
          <Field label="الاسم بالعربي"><input required value={selected.nameAr} onChange={(event) => setSelected({ ...selected, nameAr: event.target.value })}/></Field>
          <Field label="الاسم بالإنكليزي"><input required dir="ltr" value={selected.nameEn} onChange={(event) => setSelected({ ...selected, nameEn: event.target.value })}/></Field>
          <label className={styles.switchRow}><input type="checkbox" checked={selected.active} onChange={(event) => setSelected({ ...selected, active: event.target.checked })}/><span>الشركة فعالة ويُعتمد سعرها بالباب</span></label>
        </div>

        <div className={styles.loungePrices}>
          {selected.prices.map((price) => <section key={price.loungeName} className={styles.priceEditor}>
            <div className={styles.priceHeader}><div><span>تسعيرة</span><h3>{price.loungeName}</h3></div><div><small>السعر الذي سيظهر بالباب</small><strong>{formatMoney(finalPrice(price))}</strong></div></div>
            <div className={styles.formGrid}>
              <Field label="السعر الأساسي"><input inputMode="numeric" value={price.basePriceIqd} onChange={(event) => patchPrice(price.loungeName, { basePriceIqd: Number(event.target.value.replace(/\D/g, "")) })}/></Field>
              <Field label="نوع الخصم"><select value={price.discountType} onChange={(event) => patchPrice(price.loungeName, { discountType: event.target.value as DiscountType, discountValue: 0 })}><option value="none">بدون خصم</option><option value="amount">مبلغ ثابت</option><option value="percent">نسبة مئوية</option></select></Field>
              {price.discountType !== "none" ? <Field label={price.discountType === "percent" ? "نسبة الخصم %" : "مبلغ الخصم"}><input inputMode="numeric" value={price.discountValue} onChange={(event) => patchPrice(price.loungeName, { discountValue: Number(event.target.value.replace(/\D/g, "")) })}/></Field> : null}
              <Field label="طريقة الحساب"><select value={price.paymentType} onChange={(event) => patchPrice(price.loungeName, { paymentType: event.target.value })}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              {price.discountType !== "none" ? <><Field label="بداية الخصم — توقيت بغداد"><input type="datetime-local" value={toBaghdadInput(price.discountFrom)} onChange={(event) => patchPrice(price.loungeName, { discountFrom: fromBaghdadInput(event.target.value) })}/></Field><Field label="نهاية الخصم — توقيت بغداد"><input type="datetime-local" value={toBaghdadInput(price.discountTo)} onChange={(event) => patchPrice(price.loungeName, { discountTo: fromBaghdadInput(event.target.value) })}/></Field></> : null}
            </div>
            <label className={styles.switchRow}><input type="checkbox" checked={price.active} onChange={(event) => patchPrice(price.loungeName, { active: event.target.checked })}/><span>تفعيل هذه التسعيرة</span></label>
          </section>)}
        </div>
        <Field label="ملاحظات داخلية"><textarea rows={3} value={selected.notes} onChange={(event) => setSelected({ ...selected, notes: event.target.value })} placeholder="أي اتفاق أو ملاحظة تخص الشركة"/></Field>
        {message ? <div className={styles.message}>{message}</div> : null}
        <div className={styles.editorActions}><button type="button" className={styles.secondaryButton} onClick={() => setSelected(null)}>إلغاء</button><button disabled={saving} className={styles.primaryButton}><Save size={18}/>{saving ? "جاري الحفظ..." : "حفظ ملف الشركة"}</button></div>
      </form>
    </div> : null}
  </main>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className={styles.metric}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
