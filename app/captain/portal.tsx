"use client";

import { FormEvent, useMemo, useState } from "react";
import { Building2, Check, ChevronLeft, Eye, EyeOff, Landmark, Loader2, LockKeyhole, LogOut, Luggage, Minus, Phone, Plane, Plus, Send, ShoppingCart, Sparkles, UserRound, UsersRound } from "lucide-react";

type Step = "lounge" | "details" | "review" | "success";
type LoungeId = "samarra" | "babylon" | "nineveh";

const lounges = [
  { id: "samarra" as const, name: "صالة سامراء", icon: Landmark, accent: "from-[#1d5e73] to-[#163d55]" },
  { id: "babylon" as const, name: "صالة بابل", icon: Building2, accent: "from-[#aa7541] to-[#78502e]" },
  { id: "nineveh" as const, name: "صالة نينوى", icon: Sparkles, accent: "from-[#495686] to-[#303a67]" },
];

function Counter({ label, value, min = 0, onChange, icon: Icon }: { label: string; value: number; min?: number; onChange: (value: number) => void; icon: typeof UsersRound }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3f5] text-[#17384b]"><Icon className="size-5" /></span><p className="text-sm font-bold text-slate-800">{label}</p></div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-1.5">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid size-11 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40" aria-label={`تقليل ${label}`}><Minus className="size-4" /></button>
        <span className="text-2xl font-black tabular-nums text-[#17384b]">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(20, value + 1))} disabled={value >= 20} className="grid size-11 place-items-center rounded-lg bg-[#17384b] text-white disabled:opacity-40" aria-label={`زيادة ${label}`}><Plus className="size-4" /></button>
      </div>
    </div>
  );
}

export default function CaptainPortal() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captain, setCaptain] = useState({ name: "", company: "" });
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
      const result = await response.json() as { captain?: { name: string; company: string }; sessionToken?: string; message?: string };
      if (!response.ok || !result.captain || !result.sessionToken) return setError(result.message || "تعذر تسجيل الدخول");
      setCaptain(result.captain); setToken(result.sessionToken); setLoggedIn(true);
    } catch { setError("صار خلل بالاتصال، حاول مرة ثانية"); } finally { setLoading(false); }
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!/^(?:\+?964|0)?7\d{9}$/.test(phone.replace(/[\s-]/g, ""))) return setError("اكتب رقم مسافر عراقي صحيح");
    setError(""); setStep("review"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirm() {
    if (!lounge) return; setError(""); setLoading(true);
    try {
      const response = await fetch("/api/captain/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionToken: token, loungeId, passengers, bags, carts, phone }) });
      const result = await response.json() as { orderId?: string; message?: string };
      if (!response.ok || !result.orderId) return setError(result.message || "تعذر تأكيد الطلب");
      setOrderId(result.orderId); setStep("success"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("صار خلل بالاتصال، حاول مرة ثانية"); } finally { setLoading(false); }
  }

  function reset() { setStep("lounge"); setLoungeId(""); setPassengers(1); setBags(0); setCarts(0); setPhone(""); setError(""); setOrderId(""); }

  if (!loggedIn) return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top,#244f65_0,#17384b_42%,#0b2230_100%)] px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">
        <div className="mb-7"><span className="mb-5 grid size-14 place-items-center rounded-2xl bg-[#d7b679] text-[#17384b]"><Plane className="size-7 -rotate-45" /></span><p className="text-sm font-bold text-[#d7b679]">أهلاً بالكابتن</p><h1 className="mt-2 text-3xl font-black leading-relaxed">بوابة كباتن الصالات</h1><p className="mt-2 text-sm leading-7 text-slate-300">سجّل دخولك وأدخل طلب المسافر خلال أقل من دقيقة.</p></div>
        <form onSubmit={login} className="rounded-[28px] bg-white p-5 text-slate-900 shadow-2xl">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-black">تسجيل الدخول</h2><p className="mt-1 text-xs text-slate-500">أدخل حساب الكابتن المخصص إلك</p></div><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-[#17384b]"><LockKeyhole className="size-5" /></span></div>
          <label className="mb-2 block text-xs font-bold">اسم المستخدم</label><div className="relative mb-4"><UserRound className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" required autoComplete="username" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-11 text-left outline-none focus:border-[#1d5e73]" placeholder="Username" /></div>
          <label className="mb-2 block text-xs font-bold">كلمة المرور</label><div className="relative"><LockKeyhole className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} dir="ltr" required autoComplete="current-password" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-11 text-left outline-none focus:border-[#1d5e73]" placeholder="••••••"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-400">{showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
          <button disabled={loading} className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#17384b] text-sm font-black text-white disabled:opacity-60">{loading ? <Loader2 className="size-4 animate-spin"/> : null}{loading ? "جاري التحقق" : "دخول إلى اللوحة"}</button>
        </form>
      </div>
    </main>
  );

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f7f8] text-slate-900">
      <header className="sticky top-0 z-20 bg-[#17384b] text-white shadow-lg"><div className="mx-auto flex max-w-md items-center justify-between px-5 py-4"><div><p className="text-xs text-white/60">{captain.company || "بوابة الكباتن"}</p><p className="mt-1 text-sm font-black">كابتن {captain.name}</p></div><button onClick={() => { setLoggedIn(false); setToken(""); reset(); }} className="grid size-10 place-items-center rounded-xl bg-white/10" aria-label="تسجيل الخروج"><LogOut className="size-4"/></button></div></header>
      <div className="mx-auto max-w-md px-5 py-6">
        {step === "lounge" && <section><p className="text-xs font-bold text-[#1d5e73]">الخطوة الأولى</p><h1 className="mt-2 text-2xl font-black text-[#17384b]">اختر إحدى الصالات</h1><p className="mt-2 text-sm text-slate-500">حدد الصالة التي يحتاجها المسافر.</p><div className="mt-5 space-y-3">{lounges.map((item) => { const Icon = item.icon; const selected = loungeId === item.id; return <button key={item.id} onClick={() => setLoungeId(item.id)} className={`flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-right shadow-sm ${selected ? "border-[#1d5e73] ring-4 ring-[#1d5e73]/10" : "border-slate-200"}`}><span className={`grid size-14 place-items-center rounded-2xl bg-gradient-to-br ${item.accent} text-white`}><Icon className="size-6"/></span><span className="flex-1 font-black">{item.name}</span><span className={`grid size-8 place-items-center rounded-full ${selected ? "bg-[#17384b] text-white" : "bg-slate-100 text-slate-400"}`}>{selected ? <Check className="size-4"/> : <ChevronLeft className="size-4"/>}</span></button>})}</div><button disabled={!loungeId} onClick={() => setStep("details")} className="mt-6 h-13 w-full rounded-xl bg-[#17384b] text-sm font-black text-white disabled:opacity-40">متابعة إلى بيانات المسافر</button></section>}
        {step === "details" && lounge && <section><button onClick={() => setStep("lounge")} className="mb-4 text-xs font-bold text-slate-500">تغيير الصالة</button><div className={`mb-5 rounded-2xl bg-gradient-to-l ${lounge.accent} p-4 text-white`}><p className="text-xs text-white/70">الصالة المختارة</p><p className="mt-1 font-black">{lounge.name}</p></div><form onSubmit={review} className="space-y-3"><div className="grid grid-cols-2 gap-3"><Counter label="المسافرون" value={passengers} min={1} onChange={setPassengers} icon={UsersRound}/><Counter label="الحقائب" value={bags} onChange={setBags} icon={Luggage}/></div><Counter label="عربات الحقائب" value={carts} onChange={setCarts} icon={ShoppingCart}/><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="mb-3 flex items-center gap-3 text-sm font-bold"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-[#17384b]"><Phone className="size-5"/></span>رقم المسافر</label><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" dir="ltr" required className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-left outline-none focus:border-[#1d5e73]" placeholder="07XX XXX XXXX"/>{error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}</div><button className="h-13 w-full rounded-xl bg-[#17384b] text-sm font-black text-white">مراجعة الطلب</button></form></section>}
        {step === "review" && lounge && <section><button onClick={() => setStep("details")} className="mb-4 text-xs font-bold text-slate-500">تعديل البيانات</button><p className="text-xs font-bold text-[#1d5e73]">الخطوة الأخيرة</p><h1 className="mt-2 text-2xl font-black text-[#17384b]">تأكد من تفاصيل الطلب</h1><p className="mt-2 text-sm text-slate-500">راجع المعلومات جيداً قبل تأكيد الطلب.</p><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className={`bg-gradient-to-l ${lounge.accent} p-5 text-white`}><p className="text-xs text-white/70">طلب دخول صالة</p><p className="mt-1 text-lg font-black">{lounge.name}</p></div><dl className="divide-y divide-slate-100 px-5">{[["الكابتن", captain.name],["الشركة", captain.company || "غير مضافة"],["عدد المسافرين", passengers],["عدد الحقائب", bags],["عدد العربات", carts],["رقم المسافر", phone]].map(([label,value]) => <div key={String(label)} className="flex justify-between gap-4 py-4 text-sm"><dt className="font-bold text-slate-500">{label}</dt><dd className="font-black text-slate-800">{value}</dd></div>)}</dl></div><p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-800">بعد التأكيد، راح يستلم موظف الاستقبال تفاصيل الطلب ويتواصل وياك.</p>{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<button onClick={confirm} disabled={loading} className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#17384b] text-sm font-black text-white disabled:opacity-60">{loading ? <Loader2 className="size-4 animate-spin"/> : <Send className="size-4"/>}{loading ? "جاري تأكيد الطلب" : "تأكيد الحجز"}</button></section>}
        {step === "success" && lounge && <section className="flex min-h-[70vh] flex-col justify-center text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500 text-white shadow-lg"><Check className="size-9"/></span><p className="mt-6 text-xs font-black text-emerald-600">تمت العملية بنجاح</p><h1 className="mt-2 text-3xl font-black text-[#17384b]">تم تأكيد الحجز</h1><p className="mt-3 text-sm leading-7 text-slate-500">تم تأكيد حجز {lounge.name}، وراح يتواصل وياك موظف الاستقبال.</p><div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-4"><p className="text-xs font-bold text-slate-400">رقم الطلب</p><p dir="ltr" className="mt-1 text-lg font-black tracking-widest">{orderId}</p></div><button onClick={reset} className="mt-6 h-13 w-full rounded-xl bg-[#17384b] text-sm font-black text-white"><Plus className="ml-2 inline size-4"/>إنشاء طلب جديد</button></section>}
      </div>
    </main>
  );
}
