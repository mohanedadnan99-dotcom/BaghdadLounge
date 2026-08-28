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

type CaptainInfo = {
  name: string;
  company: string;
};

type Lounge = {
  id: LoungeId;
  name: string;
  subtitle: string;
  icon: typeof Landmark;
  accent: string;
  badge: string;
};

const lounges: Lounge[] = [
  { id: "samarra", name: "صالة سامراء", subtitle: "خدمة المسافرين", icon: Landmark, accent: "from-[#0f5a72] to-[#1c4761]", badge: "S" },
  { id: "babylon", name: "صالة بابل", subtitle: "خدمة المسافرين", icon: Building2, accent: "from-[#8b5a2a] to-[#b37b3f]", badge: "B" },
  { id: "nineveh", name: "صالة نينوى", subtitle: "خدمة المسافرين", icon: Sparkles, accent: "from-[#38498e] to-[#5962a8]", badge: "N" },
];

function ProgressCard({ step }: { step: Step }) {
  const config = step === "lounge"
    ? { current: 1, title: "اختيار الصالة", subtitle: "طلب صالة جديد", percent: 33 }
    : step === "details"
      ? { current: 2, title: "بيانات المسافر", subtitle: "طلب صالة جديد", percent: 66 }
      : { current: 3, title: "تأكيد الطلب", subtitle: "طلب صالة جديد", percent: 100 };
  return (
    <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,47,62,0.08)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-400">{config.subtitle}</p><h2 className="mt-1 text-[1.85rem] font-black tracking-tight text-[#15384b]">{config.title}</h2></div>
        <span className="rounded-full bg-[#edf3f5] px-4 py-2 text-sm font-black text-[#2b6e84]">{config.current} من 3</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7edf1]"><div className="h-full rounded-full bg-gradient-to-r from-[#2e8199] to-[#286d86] transition-all duration-300" style={{ width: `${config.percent}%` }} /></div>
    </div>
  );
}

function StepHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="px-1 pt-2 text-right"><p className="text-sm font-bold text-[#315f73]">{eyebrow}</p><h1 className="mt-3 text-[2.45rem] font-black leading-[1.15] tracking-tight text-[#16384b]">{title}</h1><p className="mt-4 text-lg leading-8 text-slate-500">{description}</p></div>;
}

function CounterCard({ label, description, value, min = 0, onChange, icon: Icon }: { label: string; description: string; value: number; min?: number; onChange: (value: number) => void; icon: typeof UsersRound }) {
  return (
    <div className="rounded-[30px] border border-[#dfe7ec] bg-white p-5 shadow-[0_10px_30px_rgba(15,47,62,0.06)]">
      <div className="flex items-start justify-between gap-3"><span className="grid size-14 place-items-center rounded-full bg-[#edf4f6] text-[#2d7188]"><Icon className="size-7" /></span><div className="text-right"><h3 className="text-[1.1rem] font-black text-[#1a3446]">{label}</h3><p className="mt-1 text-base text-slate-400">{description}</p></div></div>
      <div className="mt-6 flex items-center justify-between rounded-[28px] border border-[#eef3f6] bg-[#f7fafb] px-5 py-4">
        <button type="button" onClick={() => onChange(Math.min(20, value + 1))} disabled={value >= 20} className="grid size-16 place-items-center rounded-3xl bg-[#123e58] text-white shadow-[0_10px_18px_rgba(18,62,88,0.18)] transition disabled:opacity-40"><Plus className="size-7" /></button>
        <span className="text-[3rem] font-black leading-none tracking-tight text-[#143f59]">{value}</span>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid size-16 place-items-center rounded-3xl border border-[#e8edf1] bg-white text-slate-400 shadow-sm transition disabled:opacity-40"><Minus className="size-7" /></button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof UserRound }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-5 last:border-b-0"><div className="flex items-center gap-3 text-slate-400"><Icon className="size-5" /><span className="text-[1.05rem] font-bold">{label}</span></div><div className="text-left text-[1.15rem] font-black text-[#172d3d]">{value}</div></div>;
}

export default function CaptainPortal() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captain, setCaptain] = useState<CaptainInfo>({ name: "", company: "" });
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
  const lounge = useMemo(() => lounges.find((item) => item.id === loungeId), [loungeId]);

  async function login(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/captain/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = (await response.json()) as { captain?: CaptainInfo; sessionToken?: string; message?: string };
      if (!response.ok || !result.captain || !result.sessionToken) { setError(result.message || "تعذر تسجيل الدخول"); return; }
      setCaptain(result.captain); setToken(result.sessionToken); setLoggedIn(true); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("صار خلل بالاتصال، حاول مرة ثانية"); } finally { setLoading(false); }
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!/^(?:\+?964|0)?7\d{9}$/.test(phone.replace(/[\s-]/g, ""))) { setError("اكتب رقم مسافر عراقي صحيح"); return; }
    setError(""); setStep("review"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirm() {
    if (!lounge) return; setError(""); setLoading(true);
    try {
      const response = await fetch("/api/captain/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionToken: token, loungeId, passengers, bags, carts, phone }) });
      const result = (await response.json()) as { orderId?: string; message?: string };
      if (!response.ok || !result.orderId) { setError(result.message || "تعذر تأكيد الطلب"); return; }
      setOrderId(result.orderId); setStep("success"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("صار خلل بالاتصال، حاول مرة ثانية"); } finally { setLoading(false); }
  }

  function resetFlow() { setStep("lounge"); setLoungeId(""); setPassengers(1); setBags(0); setCarts(0); setPhone(""); setError(""); setOrderId(""); }
  function logout() { setLoggedIn(false); setToken(""); setCaptain({ name: "", company: "" }); setUsername(""); setPassword(""); setShowPassword(false); resetFlow(); }

  if (!loggedIn) return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(150,185,190,0.18),transparent_20%),linear-gradient(180deg,#102f40_0%,#0d3348_45%,#0f3a55_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4"><div className="grid size-16 place-items-center rounded-[22px] border border-white/15 bg-white/10"><Plane className="size-8 -rotate-45 text-white/90" /></div><div className="text-right"><h2 className="text-[1.6rem] font-black">بوابة الصالات</h2><p className="mt-1 text-sm uppercase tracking-[0.14em] text-white/60">CAPTAIN PORTAL</p></div></div>
          <div className="mt-9 flex justify-start"><span className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-base font-bold text-white/90">نسخة تجريبية</span></div>
          <div className="mt-16 flex justify-end"><div className="grid size-24 place-items-center rounded-[28px] bg-[#d8b06d] text-[#1a4054] shadow-[0_20px_40px_rgba(4,18,28,0.22)]"><ShieldCheck className="size-11" /></div></div>
          <div className="mt-6 text-right"><p className="text-[1.65rem] font-black text-[#d8b06d]">أهلاً بالكابتن</p><h1 className="mt-4 text-[3rem] font-black leading-[1.18] tracking-tight">سجّل دخولك وخلي<br />طلب الصالة أسرع</h1><p className="mt-6 text-[1.33rem] leading-9 text-white/75">منصة مبسطة لكباتن الشركات لإدخال طلب المسافر خلال أقل من دقيقة.</p></div>
          <form onSubmit={login} className="mt-10 rounded-[34px] border border-white/60 bg-[#fafafb] p-6 text-slate-900 shadow-[0_25px_60px_rgba(6,24,36,0.22)]">
            <div className="mb-6 flex items-start justify-between gap-4"><div className="grid size-16 place-items-center rounded-full bg-[#eef2f4] text-[#6e8d9a]"><LockKeyhole className="size-8" /></div><div className="text-right"><h2 className="text-[2rem] font-black text-[#162f40]">تسجيل الدخول</h2><p className="mt-2 text-lg text-slate-400">أدخل حساب الكابتن المخصص إلك</p></div></div>
            <div className="space-y-5">
              <div><label className="mb-3 block text-right text-[1.15rem] font-bold text-[#203544]">اسم المستخدم</label><div className="relative"><UserRound className="absolute right-5 top-1/2 size-6 -translate-y-1/2 text-[#9ba5bb]" /><input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" required autoComplete="username" className="h-[86px] w-full rounded-[28px] border border-[#e1e6eb] bg-[#f4f6f8] px-16 text-left text-[1.1rem] text-slate-700 outline-none focus:border-[#2b6f86]" placeholder="Username" /></div></div>
              <div><label className="mb-3 block text-right text-[1.15rem] font-bold text-[#203544]">كلمة المرور</label><div className="relative"><LockKeyhole className="absolute right-5 top-1/2 size-6 -translate-y-1/2 text-[#9ba5bb]" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-[#9ba5bb]">{showPassword ? <EyeOff className="size-6" /> : <Eye className="size-6" />}</button><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} dir="ltr" required autoComplete="current-password" className="h-[86px] w-full rounded-[28px] border border-[#e1e6eb] bg-[#f4f6f8] px-16 text-left text-[1.1rem] text-slate-700 outline-none focus:border-[#2b6f86]" placeholder="••••••" /></div></div>
            </div>
            {error && <p className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">{error}</p>}
            <button disabled={loading} className="mt-8 flex h-[86px] w-full items-center justify-center gap-3 rounded-[28px] bg-[#153e56] px-6 text-[1.45rem] font-black text-white shadow-[0_16px_30px_rgba(21,62,86,0.22)] disabled:opacity-60">{loading ? <Loader2 className="size-6 animate-spin" /> : <ArrowLeft className="size-6" />}<span>{loading ? "جاري التحقق" : "دخول إلى اللوحة"}</span></button>
          </form>
        </div>
        <p className="pb-3 pt-8 text-center text-lg text-white/55">الدخول مخصص لكباتن الشركات المعتمدين</p>
      </div>
    </main>
  );

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#133f58] text-white shadow-[0_10px_30px_rgba(9,34,46,0.16)]"><div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-5"><button onClick={logout} className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/5 text-white/85"><LogOut className="size-6" /></button><div className="flex items-center gap-3"><div className="relative grid size-16 place-items-center rounded-[20px] border border-white/10 bg-white/10 text-xl font-black text-white/90"><span>{captain.name.trim().charAt(0) || "م"}</span><span className="absolute bottom-1 left-1 size-3 rounded-full bg-emerald-400 shadow-[0_0_0_3px_#133f58]" /></div><div className="text-right"><p className="text-sm text-white/65">{captain.company || "بوابة الكباتن"}</p><p className="mt-1 text-[1.45rem] font-black">كابتن {captain.name}</p></div></div></div></header>
      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        {step !== "success" && <ProgressCard step={step} />}
        {step === "lounge" && <section className="mt-12"><StepHeader eyebrow="الخطوة الأولى" title="اختر إحدى الصالات" description="حدد الصالة التي يحتاجها المسافر." /><div className="mt-8 space-y-5">{lounges.map((item) => { const Icon = item.icon; const selected = loungeId === item.id; return <button key={item.id} type="button" onClick={() => setLoungeId(item.id)} className={`flex w-full items-center gap-5 rounded-[32px] border p-6 text-right shadow-[0_12px_28px_rgba(15,47,62,0.06)] transition ${selected ? "border-[#78a3b1] bg-white ring-4 ring-[#d7e8ed]" : "border-[#e5edf1] bg-white"}`}><span className="grid size-20 place-items-center rounded-[28px] bg-[#f6f8f9] text-slate-300">{selected ? <Check className="size-8 text-[#1e6b83]" /> : <ChevronLeft className="size-8" />}</span><div className="flex-1 text-right"><h3 className="text-[1.9rem] font-black text-[#142e3f]">{item.name}</h3><p className="mt-2 text-lg text-slate-400">{item.subtitle}</p></div><span className={`grid size-20 place-items-center rounded-[28px] bg-gradient-to-br ${item.accent} text-white shadow-[0_12px_25px_rgba(16,50,69,0.18)]`}><Icon className="size-9" /></span></button>; })}</div><button type="button" disabled={!loungeId} onClick={() => { setError(""); setStep("details"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`mt-8 flex h-[84px] w-full items-center justify-center gap-3 rounded-[28px] text-[1.4rem] font-black ${loungeId ? "bg-[#143f58] text-white" : "bg-[#9fb4bf] text-white/85"}`}><ArrowLeft className="size-6" /><span>متابعة إلى بيانات المسافر</span></button></section>}
        {step === "details" && lounge && <section className="mt-10"><div className="mt-8 flex items-center justify-between px-1"><button type="button" onClick={() => setStep("lounge")} className="flex items-center gap-2 text-[1.05rem] font-bold text-[#6a7d88]"><ArrowLeft className="size-5" /><span>تغيير الصالة</span></button><div className="text-right"><p className="text-sm font-medium text-slate-400">الخطوة الثانية</p><h1 className="mt-1 text-[2rem] font-black text-[#15384b]">بيانات المسافر</h1></div></div><div className={`mt-6 rounded-[32px] bg-gradient-to-r ${lounge.accent} p-6 text-white shadow-[0_18px_38px_rgba(94,65,38,0.18)]`}><div className="flex items-center justify-between gap-4"><div className="grid size-20 place-items-center rounded-[26px] border border-white/15 bg-white/10 text-[2rem] font-black">{lounge.badge}</div><div className="text-right"><p className="text-lg text-white/75">الصالة المختارة</p><p className="mt-2 text-[2rem] font-black">{lounge.name}</p></div></div></div><form onSubmit={review} className="mt-6 space-y-5"><div className="grid grid-cols-2 gap-4"><CounterCard label="المسافرون" description="عدد الأشخاص" value={passengers} min={1} onChange={setPassengers} icon={UsersRound} /><CounterCard label="الحقائب" description="عدد الحقائب" value={bags} onChange={setBags} icon={Luggage} /></div><CounterCard label="عربات الحقائب" description="حدد العدد المطلوب حسب كمية الحقائب" value={carts} onChange={setCarts} icon={ShoppingCart} /><div className="rounded-[30px] border border-[#dfe7ec] bg-white p-5 shadow-[0_10px_30px_rgba(15,47,62,0.06)]"><div className="flex items-start justify-between gap-3"><span className="grid size-14 place-items-center rounded-full bg-[#edf4f6] text-[#2d7188]"><Phone className="size-7" /></span><div className="text-right"><h3 className="text-[1.15rem] font-black text-[#1a3446]">رقم المسافر</h3><p className="mt-1 text-base text-slate-400">للتواصل عند الحاجة</p></div></div><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" dir="ltr" required className="mt-6 h-[82px] w-full rounded-[26px] border border-[#dfe6ec] bg-[#f8fafb] px-6 text-left text-[1.4rem] text-slate-700 outline-none focus:border-[#2b6f86]" placeholder="07XX XXX XXXX" />{error && <p className="mt-3 text-right text-sm font-bold text-red-600">{error}</p>}</div><button className="flex h-[84px] w-full items-center justify-center gap-3 rounded-[28px] bg-[#143f58] text-[1.4rem] font-black text-white"><ArrowLeft className="size-6" /><span>مراجعة الطلب</span></button></form></section>}
        {step === "review" && lounge && <section className="mt-10"><div className="mt-8 flex items-center justify-between px-1"><button type="button" onClick={() => setStep("details")} className="flex items-center gap-2 text-[1.05rem] font-bold text-[#6a7d88]"><ArrowLeft className="size-5" /><span>تعديل البيانات</span></button><div className="text-right"><p className="text-sm font-medium text-[#315f73]">الخطوة الأخيرة</p><h1 className="mt-1 text-[2.15rem] font-black text-[#15384b]">تأكد من تفاصيل الطلب</h1><p className="mt-2 text-base text-slate-500">راجع المعلومات جيداً قبل تأكيد الطلب.</p></div></div><div className="mt-6 overflow-hidden rounded-[32px] border border-[#dfe6eb] bg-white shadow-[0_16px_35px_rgba(15,47,62,0.08)]"><div className={`bg-gradient-to-r ${lounge.accent} p-6 text-white`}><div className="flex items-center justify-between gap-4"><div className="grid size-20 place-items-center rounded-[26px] border border-white/15 bg-white/10 text-[2rem] font-black">{lounge.badge}</div><div className="text-right"><p className="text-lg text-white/75">طلب دخول صالة</p><h2 className="mt-2 text-[2rem] font-black">{lounge.name}</h2></div></div></div><div className="px-6"><DetailRow label="الكابتن" value={captain.name} icon={UserRound} /><DetailRow label="الشركة" value={captain.company || "غير مضافة"} icon={Building2} /><DetailRow label="عدد المسافرين" value={passengers} icon={UsersRound} /><DetailRow label="عدد الحقائب" value={bags} icon={Luggage} /><DetailRow label="عدد عربات الحقائب" value={carts} icon={ShoppingCart} /><DetailRow label="رقم المسافر" value={phone} icon={Phone} /></div></div><div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-right text-[1rem] font-bold leading-8 text-emerald-800"><div className="flex items-start justify-between gap-3"><ShieldCheck className="mt-1 size-6 shrink-0" /><p>بعد التأكيد، راح يستلم موظف الاستقبال تفاصيل الطلب ويتواصل وياك.</p></div></div>{error && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">{error}</p>}<button type="button" onClick={confirm} disabled={loading} className="mt-6 flex h-[84px] w-full items-center justify-center gap-3 rounded-[28px] bg-[#143f58] text-[1.5rem] font-black text-white disabled:opacity-60">{loading ? <Loader2 className="size-6 animate-spin" /> : <Send className="size-6" />}<span>{loading ? "جاري التأكيد" : "تأكيد الحجز"}</span></button></section>}
        {step === "success" && lounge && <section className="pt-10"><div className="rounded-[34px] border border-white bg-white p-7 text-center shadow-[0_18px_38px_rgba(15,47,62,0.08)]"><div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-10" /></div><h1 className="mt-6 text-[2.2rem] font-black text-[#15384b]">تم تأكيد الطلب</h1><p className="mt-3 text-lg leading-8 text-slate-500">تم إرسال طلب {lounge.name} بنجاح، وسيتم متابعة المسافر من قبل الموظف المختص.</p><div className="mt-6 rounded-[26px] bg-[#f5f8fa] p-5 text-right"><p className="text-sm font-bold text-slate-400">رقم الطلب</p><p className="mt-2 text-[1.8rem] font-black tracking-wide text-[#143f58]">{orderId}</p></div><button type="button" onClick={resetFlow} className="mt-7 flex h-[80px] w-full items-center justify-center gap-3 rounded-[28px] bg-[#143f58] text-[1.35rem] font-black text-white"><ArrowLeft className="size-6" /><span>إدخال طلب جديد</span></button></div></section>}
      </div>
    </main>
  );
}
