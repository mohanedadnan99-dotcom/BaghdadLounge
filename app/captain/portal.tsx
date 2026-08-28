"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  LockKeyhole,
  LogOut,
  Luggage,
  Minus,
  Phone,
  Plane,
  Plus,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

type Step = "lounge" | "details" | "review" | "success";
type LoungeId = "samarra" | "babylon" | "nineveh";
type Captain = { name: string; company: string };

const lounges = [
  { id: "samarra" as const, name: "صالة سامراء", subtitle: "خدمة المسافرين", icon: Landmark, accent: "from-[#0e637c] to-[#0d435b]", badge: "S" },
  { id: "babylon" as const, name: "صالة بابل", subtitle: "خدمة المسافرين", icon: Building2, accent: "from-[#8f5d31] to-[#b57a3d]", badge: "B" },
  { id: "nineveh" as const, name: "صالة نينوى", subtitle: "خدمة المسافرين", icon: Sparkles, accent: "from-[#374685] to-[#5963a7]", badge: "N" },
];

function Progress({ step }: { step: Step }) {
  const c = step === "lounge"
    ? { n: 1, title: "اختيار الصالة", p: 33 }
    : step === "details"
      ? { n: 2, title: "بيانات المسافر", p: 66 }
      : { n: 3, title: "تأكيد الطلب", p: 100 };

  return (
    <div className="rounded-[22px] border border-[#e5ecef] bg-white px-4 py-4 shadow-[0_10px_26px_rgba(21,56,75,.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-right">
          <p className="text-[11px] font-medium text-[#98a8b1]">طلب صالة جديد</p>
          <h2 className="mt-1 text-[17px] font-semibold text-[#142f42]">{c.title}</h2>
        </div>
        <span className="rounded-full bg-[#eff4f6] px-3 py-1.5 text-[11px] font-semibold text-[#2b6e84]">{c.n} من 3</span>
      </div>
      <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-[#edf2f5]">
        <div className="h-full rounded-full bg-[#2c7389] transition-all" style={{ width: `${c.p}%` }} />
      </div>
    </div>
  );
}

function Counter({
  label,
  desc,
  value,
  min = 0,
  onChange,
  icon: Icon,
}: {
  label: string;
  desc: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
  icon: typeof UsersRound;
}) {
  return (
    <div className="rounded-[22px] border border-[#e2e8ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,50,68,.055)]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-[#edf4f6] text-[#2d7188]"><Icon className="size-5" /></span>
        <div className="text-right">
          <h3 className="text-[14px] font-semibold text-[#1a3446]">{label}</h3>
          <p className="mt-0.5 text-[11px] text-[#9aa8b0]">{desc}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[#edf2f5] bg-[#f8fafb] p-2">
        <button type="button" onClick={() => onChange(Math.min(20, value + 1))} className="grid size-11 place-items-center rounded-[14px] bg-[#123f58] text-white shadow-[0_7px_14px_rgba(18,63,88,.15)]"><Plus className="size-5" /></button>
        <span className="text-[28px] font-semibold leading-none text-[#153f58]">{value}</span>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid size-11 place-items-center rounded-[14px] border border-[#e6ecef] bg-white text-[#9ba8af] shadow-sm disabled:opacity-40"><Minus className="size-5" /></button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof UserRound }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#edf1f3] py-4 last:border-0">
      <div className="flex items-center gap-2 text-[#8d9faa]"><Icon className="size-4" /><span className="text-[13px] font-medium">{label}</span></div>
      <div className="text-left text-[14px] font-semibold text-[#172d3d]">{value}</div>
    </div>
  );
}

export default function CaptainPortal() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captain, setCaptain] = useState<Captain>({ name: "", company: "" });
  const [token, setToken] = useState("");
  const [step, setStep] = useState<Step>("lounge");
  const [loungeId, setLoungeId] = useState<LoungeId | "">("");
  const [passengers, setPassengers] = useState(1);
  const [bags, setBags] = useState(0);
  const [carts, setCarts] = useState(0);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState("");

  const lounge = useMemo(() => lounges.find((x) => x.id === loungeId), [loungeId]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/captain/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const x = await r.json() as { captain?: Captain; sessionToken?: string; message?: string };
      if (!r.ok || !x.captain || !x.sessionToken) {
        setError(x.message || "تعذر تسجيل الدخول");
        return;
      }
      setCaptain(x.captain);
      setToken(x.sessionToken);
      setLoggedIn(true);
    } catch {
      setError("صار خلل بالاتصال، حاول مرة ثانية");
    } finally {
      setLoading(false);
    }
  }

  function review(e: FormEvent) {
    e.preventDefault();
    if (!/^(?:\+?964|0)?7\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
      setError("اكتب رقم مسافر عراقي صحيح");
      return;
    }
    setError("");
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirm() {
    if (!lounge) return;
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/captain/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: token, loungeId, passengers, bags, carts, phone }),
      });
      const x = await r.json() as { orderId?: string; message?: string };
      if (!r.ok || !x.orderId) {
        setError(x.message || "تعذر تأكيد الطلب");
        return;
      }
      setOrderId(x.orderId);
      setStep("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("صار خلل بالاتصال، حاول مرة ثانية");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("lounge");
    setLoungeId("");
    setPassengers(1);
    setBags(0);
    setCarts(0);
    setPhone("");
    setError("");
    setOrderId("");
  }

  function logout() {
    setLoggedIn(false);
    setToken("");
    setCaptain({ name: "", company: "" });
    setUsername("");
    setPassword("");
    setShowPassword(false);
    reset();
  }

  if (!loggedIn) {
    return (
      <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_17%_15%,rgba(100,152,166,.15),transparent_23%),linear-gradient(180deg,#103447_0%,#0e3549_45%,#0b3a55_100%)] px-[18px] py-6 text-white">
        <div className="mx-auto max-w-[390px]">
          <div className="flex items-start justify-between">
            <span className="rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-[12px] font-medium text-white/90">نسخة تجريبية</span>
            <div className="flex items-start gap-3">
              <div className="text-right">
                <h2 className="text-[19px] font-semibold leading-none">بوابة الصالات</h2>
                <p className="mt-2 text-[10px] tracking-[.13em] text-white/55">CAPTAIN PORTAL</p>
              </div>
              <div className="grid size-[54px] place-items-center rounded-[19px] border border-white/15 bg-white/[.07]"><Plane className="size-7 -rotate-45" /></div>
            </div>
          </div>

          <div className="mt-[62px] flex justify-end">
            <div className="grid size-[72px] place-items-center rounded-[24px] bg-[#d9b36f] text-[#1a4054] shadow-[0_16px_32px_rgba(2,19,29,.18)]"><ShieldCheck className="size-9" /></div>
          </div>

          <div className="mt-6 text-right">
            <p className="text-[16px] font-semibold text-[#d8b06d]">أهلاً بالكابتن</p>
            <h1 className="mt-3 text-[34px] font-semibold leading-[1.34] tracking-[-.02em]">سجّل دخولك وخلي<br />طلب الصالة أسرع</h1>
            <p className="mt-4 text-[14px] leading-7 text-white/72">منصة مبسطة لكباتن الشركات لإدخال طلب المسافر خلال أقل من دقيقة.</p>
          </div>

          <form onSubmit={login} className="mt-6 rounded-[28px] bg-[#fbfbfc] p-5 text-slate-900 shadow-[0_22px_45px_rgba(3,23,34,.22)]">
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-[#edf2f4] text-[#7895a1]"><LockKeyhole className="size-5" /></div>
              <div className="text-right">
                <h2 className="text-[21px] font-semibold text-[#172f40]">تسجيل الدخول</h2>
                <p className="mt-1 text-[12px] text-[#a0a9af]">أدخل حساب الكابتن المخصص إلك</p>
              </div>
            </div>

            <label className="mb-2 mt-5 block text-[13px] font-medium text-[#203544]">اسم المستخدم</label>
            <div className="relative">
              <UserRound className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#98a4b7]" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" required autoComplete="username" className="h-[58px] w-full rounded-[19px] border border-[#e0e6ea] bg-[#f5f7f8] px-12 text-left text-[16px] text-slate-700 outline-none focus:border-[#2b6f86]" placeholder="Username" />
            </div>

            <label className="mb-2 mt-5 block text-[13px] font-medium text-[#203544]">كلمة المرور</label>
            <div className="relative">
              <LockKeyhole className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#98a4b7]" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98a4b7]">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} dir="ltr" required autoComplete="current-password" className="h-[58px] w-full rounded-[19px] border border-[#e0e6ea] bg-[#f5f7f8] px-12 text-left text-[16px] text-slate-700 outline-none focus:border-[#2b6f86]" placeholder="••••••" />
            </div>

            {error && <p className="mt-3 text-center text-[11px] font-semibold text-red-600">{error}</p>}
            <button disabled={loading} className="mt-6 flex h-[58px] w-full items-center justify-center gap-2 rounded-[19px] bg-[#153f57] text-[15px] font-semibold text-white disabled:opacity-60">{loading ? <Loader2 className="size-5 animate-spin" /> : <ArrowLeft className="size-5" />}<span>{loading ? "جاري التحقق" : "دخول إلى اللوحة"}</span></button>
          </form>

          <p className="pt-14 text-center text-[11px] text-white/42">الدخول مخصص لكباتن الشركات المعتمدين</p>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7f8] text-slate-900">
      <header className="sticky top-0 z-20 bg-[#133f58] text-white shadow-[0_8px_24px_rgba(11,38,52,.15)]">
        <div className="mx-auto flex max-w-[390px] items-center justify-between px-[18px] py-4">
          <button onClick={logout} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.06]"><LogOut className="size-4" /></button>
          <div className="flex items-center gap-3">
            <div className="relative grid size-[50px] place-items-center rounded-[17px] bg-white/[.08] text-[15px] font-semibold">{captain.name.trim().charAt(0) || "م"}<span className="absolute bottom-1 left-1 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_2px_#133f58]" /></div>
            <div className="text-right"><p className="text-[11px] text-white/55">{captain.company || "بوابة الكباتن"}</p><p className="mt-1 text-[15px] font-semibold">كابتن {captain.name}</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[390px] px-[18px] pb-10 pt-5">
        {step !== "success" && <Progress step={step} />}

        {step === "lounge" && (
          <section className="mt-7">
            <p className="text-[12px] font-semibold text-[#315f73]">الخطوة الأولى</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-.02em] text-[#16384b]">اختر إحدى الصالات</h1>
            <p className="mt-2 text-[14px] text-[#778791]">حدد الصالة التي يحتاجها المسافر.</p>

            <div className="mt-5 space-y-3">
              {lounges.map((item) => {
                const Icon = item.icon;
                const selected = loungeId === item.id;
                return (
                  <button key={item.id} onClick={() => setLoungeId(item.id)} className={`flex w-full items-center gap-3 rounded-[24px] border bg-white p-4 text-right shadow-[0_8px_22px_rgba(15,50,68,.05)] ${selected ? "border-[#7ea4b0] ring-2 ring-[#dcebef]" : "border-[#e3eaee]"}`}>
                    <span className="grid size-11 place-items-center rounded-full border border-[#e7ecef] bg-[#f8fafb] text-[#a8b5bd]">{selected ? <Check className="size-5 text-[#2d7288]" /> : <ChevronLeft className="size-5" />}</span>
                    <div className="flex-1 text-right"><h3 className="text-[17px] font-semibold text-[#162f40]">{item.name}</h3><p className="mt-1 text-[11px] text-[#99a6ae]">{item.subtitle}</p></div>
                    <span className={`grid size-[58px] place-items-center rounded-[19px] bg-gradient-to-br ${item.accent} text-white shadow-[0_8px_18px_rgba(18,55,74,.13)]`}><Icon className="size-7" /></span>
                  </button>
                );
              })}
            </div>

            <button disabled={!loungeId} onClick={() => { setStep("details"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-5 flex h-[58px] w-full items-center justify-center gap-2 rounded-[19px] bg-[#143f58] text-[15px] font-semibold text-white disabled:bg-[#9fb4bf]"><ArrowLeft className="size-5" />متابعة إلى بيانات المسافر</button>
          </section>
        )}

        {step === "details" && lounge && (
          <section className="mt-6">
            <button onClick={() => setStep("lounge")} className="flex items-center gap-2 text-[13px] font-medium text-[#6d7f89]"><ArrowLeft className="size-4" />تغيير الصالة</button>

            <div className={`mt-5 rounded-[24px] bg-gradient-to-r ${lounge.accent} p-4 text-white shadow-[0_12px_26px_rgba(76,53,32,.12)]`}>
              <div className="flex items-center justify-between"><div className="grid size-[54px] place-items-center rounded-[18px] bg-white/10 text-[18px] font-semibold">{lounge.badge}</div><div className="text-right"><p className="text-[12px] text-white/70">الصالة المختارة</p><p className="mt-1 text-[20px] font-semibold">{lounge.name}</p></div></div>
            </div>

            <form onSubmit={review} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Counter label="المسافرون" desc="عدد الأشخاص" value={passengers} min={1} onChange={setPassengers} icon={UsersRound} />
                <Counter label="الحقائب" desc="عدد الحقائب" value={bags} onChange={setBags} icon={Luggage} />
              </div>
              <Counter label="عربات الحقائب" desc="حدد العدد المطلوب حسب كمية الحقائب" value={carts} onChange={setCarts} icon={ShoppingCart} />

              <div className="rounded-[22px] border border-[#e2e8ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,50,68,.055)]">
                <div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-full bg-[#edf4f6] text-[#2d7188]"><Phone className="size-5" /></span><div className="text-right"><h3 className="text-[14px] font-semibold text-[#1a3446]">رقم المسافر</h3><p className="mt-0.5 text-[11px] text-[#9aa8b0]">للتواصل عند الحاجة</p></div></div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" dir="ltr" required className="mt-4 h-[56px] w-full rounded-[18px] border border-[#e1e7eb] bg-[#f8fafb] px-4 text-left text-[16px] outline-none focus:border-[#2b6f86]" placeholder="07XX XXX XXXX" />
                {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
              </div>

              <button className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[19px] bg-[#143f58] text-[15px] font-semibold text-white"><ArrowLeft className="size-5" />مراجعة الطلب</button>
            </form>
          </section>
        )}

        {step === "review" && lounge && (
          <section className="mt-6">
            <button onClick={() => setStep("details")} className="flex items-center gap-2 text-[13px] font-medium text-[#6d7f89]"><ArrowLeft className="size-4" />تعديل البيانات</button>
            <p className="mt-5 text-[12px] font-semibold text-[#315f73]">الخطوة الأخيرة</p>
            <h1 className="mt-2 text-[27px] font-semibold tracking-[-.02em] text-[#15384b]">تأكد من تفاصيل الطلب</h1>
            <p className="mt-2 text-[14px] text-[#778791]">راجع المعلومات جيداً قبل تأكيد الطلب.</p>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-[#e0e7eb] bg-white shadow-[0_10px_26px_rgba(15,50,68,.06)]">
              <div className={`bg-gradient-to-r ${lounge.accent} p-4 text-white`}>
                <div className="flex items-center justify-between"><div className="grid size-[54px] place-items-center rounded-[18px] bg-white/10 text-[18px] font-semibold">{lounge.badge}</div><div className="text-right"><p className="text-[12px] text-white/70">طلب دخول صالة</p><p className="mt-1 text-[20px] font-semibold">{lounge.name}</p></div></div>
              </div>
              <div className="px-4">
                <DetailRow label="الكابتن" value={captain.name} icon={UserRound} />
                <DetailRow label="الشركة" value={captain.company || "غير مضافة"} icon={Building2} />
                <DetailRow label="عدد المسافرين" value={passengers} icon={UsersRound} />
                <DetailRow label="عدد الحقائب" value={bags} icon={Luggage} />
                <DetailRow label="عدد عربات الحقائب" value={carts} icon={ShoppingCart} />
                <DetailRow label="رقم المسافر" value={phone} icon={Phone} />
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium leading-6 text-emerald-800"><div className="flex items-start justify-between gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p>بعد التأكيد، راح يستلم موظف الاستقبال تفاصيل الطلب ويتواصل وياك.</p></div></div>
            {error && <p className="mt-3 text-center text-[11px] font-semibold text-red-600">{error}</p>}
            <button onClick={confirm} disabled={loading} className="mt-4 flex h-[58px] w-full items-center justify-center gap-2 rounded-[19px] bg-[#143f58] text-[15px] font-semibold text-white disabled:opacity-60">{loading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}<span>{loading ? "جاري التأكيد" : "تأكيد الحجز"}</span></button>
          </section>
        )}

        {step === "success" && lounge && (
          <section className="pt-8">
            <div className="rounded-[24px] border border-[#e1e8ec] bg-white p-5 text-center shadow-sm">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-7" /></div>
              <h1 className="mt-4 text-[23px] font-semibold text-[#15384b]">تم تأكيد الطلب</h1>
              <p className="mt-2 text-[13px] leading-6 text-[#778791]">تم إرسال طلب {lounge.name} بنجاح، وسيتم متابعة المسافر من قبل الموظف المختص.</p>
              <div className="mt-4 rounded-[18px] bg-[#f5f8fa] p-4 text-right"><p className="text-[11px] text-slate-400">رقم الطلب</p><p className="mt-1 text-[20px] font-semibold text-[#143f58]">{orderId}</p></div>
              <button onClick={reset} className="mt-5 h-[56px] w-full rounded-[18px] bg-[#143f58] text-[14px] font-semibold text-white">إدخال طلب جديد</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
