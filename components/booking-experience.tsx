"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Banknote, CarFront, Check, CreditCard, Loader2, Luggage, Minus, PlaneLanding, PlaneTakeoff, Plus, Users } from "lucide-react";

type FormState = {
  tripType: "departure" | "arrival";
  transport: "self" | "chauffeur";
  side: "karkh" | "rusafa";
  name: string; phone: string; flightNumber: string; date: string; time: string;
  passengers: number; bags: number; address: string; landmark: string; notes: string;
  payment: "cash" | "wayl";
};

const initial: FormState = { tripType:"departure", transport:"self", side:"karkh", name:"", phone:"", flightNumber:"", date:"", time:"", passengers:1, bags:0, address:"", landmark:"", notes:"", payment:"cash" };
const money = (n:number) => new Intl.NumberFormat("ar-IQ").format(n) + " د.ع";

export function BookingExperience() {
  const [step,setStep] = useState(1);
  const [form,setForm] = useState<FormState>(initial);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState<{reference:string; paymentUrl?:string}|null>(null);
  const loungeTotal = form.passengers * 40000;
  const carTotal = form.transport === "chauffeur" ? 75000 : 0;
  const total = loungeTotal + carTotal;
  const patch = <K extends keyof FormState>(key:K,value:FormState[K]) => setForm(v=>({...v,[key]:value}));

  const canContinue = useMemo(() => {
    if(step===1) return true;
    if(step===2) return form.transport === "self" || Boolean(form.address.trim());
    return Boolean(form.name.trim() && /^\+?[0-9\s-]{8,15}$/.test(form.phone) && form.flightNumber.trim() && form.date && form.time);
  },[step,form]);

  async function submit() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/bookings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "تعذر إتمام الحجز");
      setResult(data);
      if(data.paymentUrl) window.location.href = data.paymentUrl;
    } catch(e) { setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع"); }
    finally { setLoading(false); }
  }

  if(result && !result.paymentUrl) return (
    <section id="booking" className="px-5 py-20 lg:px-14">
      <div className="mx-auto max-w-xl border border-[#c9a55c]/35 bg-[#10100f] p-8 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#c9a55c] text-black"><Check size={30}/></div>
        <p className="mt-6 text-xs text-[#c9a55c]">تم استلام طلبك بنجاح</p>
        <h2 className="mt-3 text-2xl">شكراً لاختيارك لاونج بغداد</h2>
        <p className="mt-4 text-sm leading-7 text-[#98938b]">سيتواصل معك فريقنا لتأكيد تفاصيل الحجز. احتفظ برقم الحجز التالي:</p>
        <div className="mt-6 border border-dashed border-[#c9a55c]/45 bg-black/30 px-5 py-4 font-[var(--font-latin)] text-xl tracking-widest text-[#e5c987]">{result.reference}</div>
      </div>
    </section>
  );

  return (
    <section id="booking" className="relative px-5 py-20 lg:px-14 lg:py-28">
      <div className="absolute inset-0 hero-noise opacity-60" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="text-xs tracking-[.15em] text-[#c9a55c]">حجزك بخطوات بسيطة</p>
          <h2 className="mt-4 text-3xl sm:text-4xl">رتّب تجربتك الآن</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#88847e]">أدخل تفاصيل رحلتك وسيقوم فريقنا بمتابعة الحجز معك مباشرة.</p>
        </div>

        <div className="grid overflow-hidden border border-white/10 bg-[#101010] shadow-2xl shadow-black lg:grid-cols-[1fr_330px]">
          <div className="p-5 sm:p-8 lg:p-10">
            <div className="mb-9 flex items-center gap-2">
              {[1,2,3,4].map(n=><div key={n} className="flex flex-1 items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] ${step>=n?"bg-[#c9a55c] text-black":"border border-white/15 text-[#777]"}`}>{step>n?<Check size={13}/>:n}</span>{n<4&&<span className={`h-px flex-1 ${step>n?"bg-[#c9a55c]":"bg-white/10"}`}/>}</div>)}
            </div>

            {step===1 && <div>
              <StepTitle eyebrow="الخطوة الأولى" title="ما نوع رحلتك؟" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice active={form.tripType==="departure"} onClick={()=>patch("tripType","departure")} icon={<PlaneTakeoff/>} title="مغادرة من المطار" desc="ترتيب وصولك ودخولك إلى الصالة قبل السفر" />
                <Choice active={form.tripType==="arrival"} onClick={()=>patch("tripType","arrival")} icon={<PlaneLanding/>} title="استقبال من المطار" desc="استقبالك بعد الوصول وتجربة أكثر راحة" />
              </div>
            </div>}

            {step===2 && <div>
              <StepTitle eyebrow={form.tripType==="arrival"?"خدمة التوصيل":"خدمة الوصول"} title={form.tripType==="arrival"?"هل تحتاج سيارة توصلك بعد الوصول؟":"كيف ستصل إلى المطار؟"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice active={form.transport==="self"} onClick={()=>patch("transport","self")} icon={<Users/>} title={form.tripType==="arrival"?"لا، شكرًا":"سأصل بنفسي"} desc={form.tripType==="arrival"?"أحتاج حجز الصالة فقط بدون سيارة":"أصل إلى المطار بسيارتي أو مع شخص آخر"} />
                <Choice active={form.transport==="chauffeur"} onClick={()=>patch("transport","chauffeur")} icon={<CarFront/>} title="أحتاج سيارة خاصة" desc={form.tripType==="arrival"?"سيارة خاصة تستقبلك من المطار وتوصلك إلى وجهتك":"سيارة مريحة توصلك من موقعك إلى المطار"} badge="75,000 د.ع" />
              </div>
              {form.transport==="chauffeur" && <div className="mt-6 grid gap-4 border-t border-white/8 pt-6 sm:grid-cols-2">
                <Field label="الجانب"><select className="field" value={form.side} onChange={e=>patch("side",e.target.value as FormState["side"])}><option value="karkh">الكرخ</option><option value="rusafa">الرصافة</option></select></Field>
                <Field label={form.tripType==="arrival"?"عنوان التوصيل":"العنوان الكامل"}><input className="field" placeholder={form.tripType==="arrival"?"المنطقة، الشارع، المحلة":"المنطقة، الشارع، المحلة"} value={form.address} onChange={e=>patch("address",e.target.value)}/></Field>
                <div className="sm:col-span-2"><Field label="أقرب نقطة دالة (اختياري)"><input className="field" placeholder="مثال: قرب المستشفى..." value={form.landmark} onChange={e=>patch("landmark",e.target.value)}/></Field></div>
              </div>}
            </div>}

            {step===3 && <div>
              <StepTitle eyebrow="تفاصيل المسافر" title="أدخل معلومات رحلتك" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="الاسم الكامل"><input className="field" placeholder="الاسم الثلاثي" value={form.name} onChange={e=>patch("name",e.target.value)}/></Field>
                <Field label="رقم الهاتف"><input className="field" dir="ltr" inputMode="tel" placeholder="07xxxxxxxxx" value={form.phone} onChange={e=>patch("phone",e.target.value)}/></Field>
                <Field label="رقم الرحلة"><input className="field" dir="ltr" placeholder="مثال: IA123" value={form.flightNumber} onChange={e=>patch("flightNumber",e.target.value.toUpperCase())}/></Field>
                <Field label={form.tripType==="arrival"?"تاريخ الوصول":"تاريخ المغادرة"}><input className="field" type="date" value={form.date} onChange={e=>patch("date",e.target.value)}/></Field>
                <Field label={form.tripType==="arrival"?"وقت الوصول المتوقع":"وقت الحضور المطلوب"}><input className="field" type="time" value={form.time} onChange={e=>patch("time",e.target.value)}/></Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <Counter label="عدد المسافرين" value={form.passengers} min={1} max={20} onChange={value=>patch("passengers",value)} />
                  <Counter label="عدد الحقائب" value={form.bags} min={0} max={40} onChange={value=>patch("bags",value)} />
                </div>
                <p className="sm:col-span-2 -mt-2 text-[11px] text-[#8f897f]">* الأطفال دون سن 12 سنة دخولهم مجانًا.</p>
                <div className="sm:col-span-2"><Field label="ملاحظات إضافية (اختياري)"><textarea className="field min-h-24 resize-none" placeholder="أي تفاصيل تساعدنا في ترتيب تجربتك..." value={form.notes} onChange={e=>patch("notes",e.target.value)}/></Field></div>
              </div>
            </div>}

            {step===4 && <div>
              <StepTitle eyebrow="الخطوة الأخيرة" title="اختر طريقة الدفع" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice active={form.payment==="cash"} onClick={()=>patch("payment","cash")} icon={<Banknote/>} title="الدفع كاش" desc="الدفع نقداً عند تأكيد وتقديم الخدمة" />
                <Choice active={form.payment==="wayl"} onClick={()=>patch("payment","wayl")} icon={<CreditCard/>} title="الدفع الإلكتروني" desc="دفع آمن إلكترونياً عن طريق Wayl" />
              </div>
              {error&&<div role="alert" className="mt-5 border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div>}
            </div>}

            <div className="mt-10 flex items-center justify-between border-t border-white/8 pt-6">
              <button type="button" onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1} className="flex items-center gap-2 px-3 py-2 text-sm text-[#888] disabled:invisible"><ArrowRight size={16}/> رجوع</button>
              {step<4?<button type="button" disabled={!canContinue} onClick={()=>setStep(s=>Math.min(4,s+1))} className="flex items-center gap-2 bg-[#c9a55c] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">التالي <ArrowLeft size={16}/></button>:<button type="button" onClick={submit} disabled={loading} className="flex min-w-40 items-center justify-center gap-2 bg-[#c9a55c] px-6 py-3 text-sm font-semibold text-black disabled:opacity-60">{loading?<><Loader2 size={17} className="animate-spin"/> جاري الحجز</>:"تأكيد الحجز"}</button>}
            </div>
          </div>

          <aside className="border-t border-white/10 bg-[#0b0b0b] p-6 lg:border-t-0 lg:border-r lg:p-8">
            <p className="text-[11px] tracking-[.12em] text-[#c9a55c]">ملخص الحجز</p>
            <h3 className="mt-3 text-xl">تجربة لاونج بغداد</h3>
            <div className="mt-7 space-y-4 text-sm">
              <Summary label="نوع الرحلة" value={form.tripType==="departure"?"مغادرة":"استقبال"}/>
              <Summary label={form.tripType==="arrival"?"التوصيل بعد الوصول":"الوصول للمطار"} value={form.transport==="chauffeur"?"سيارة خاصة":form.tripType==="arrival"?"بدون سيارة":"وصول شخصي"}/>
              <Summary label="المسافرون" value={`${form.passengers} ${form.passengers===1?"شخص":"أشخاص"}`} icon={<Users size={14}/>}/>
              <Summary label="الحقائب" value={`${form.bags} حقيبة`} icon={<Luggage size={14}/>}/>
              {form.date&&<Summary label="الموعد" value={`${form.date} · ${form.time||"--:--"}`}/>} 
            </div>
            <div className="my-7 h-px bg-white/10" />
            <div className="space-y-3 text-xs text-[#a19b92]"><div className="flex justify-between"><span>دخول الصالة × {form.passengers}</span><span>{money(loungeTotal)}</span></div>{carTotal>0&&<div className="flex justify-between"><span>السيارة الخاصة</span><span>{money(carTotal)}</span></div>}</div>
            <div className="mt-5 flex items-end justify-between border-t border-dashed border-white/15 pt-5"><span className="text-sm">المجموع</span><strong className="text-xl text-[#dfc17c]">{money(total)}</strong></div>
            <p className="mt-6 text-[10px] leading-5 text-[#605d58]">دخول الصالة: 40,000 د.ع للشخص. الأطفال دون سن 12 سنة مجانًا. سعر السيارة ثابت للكرخ أو الرصافة. يخضع الحجز للتأكيد النهائي من فريقنا.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function StepTitle({eyebrow,title}:{eyebrow:string;title:string}) { return <div className="mb-7"><p className="text-[11px] text-[#a58b55]">{eyebrow}</p><h3 className="mt-2 text-xl sm:text-2xl">{title}</h3></div> }
function Choice({active,onClick,icon,title,desc,badge}:{active:boolean;onClick:()=>void;icon:React.ReactNode;title:string;desc:string;badge?:string}) { return <button type="button" onClick={onClick} aria-pressed={active} className={`choice relative min-h-32 rounded-xl p-5 text-right ${active?"active":""}`}><span className={active?"text-[#daba73]":"text-[#777]"}>{icon}</span><span className="mt-4 block text-sm">{title}</span><span className="mt-2 block text-[11px] leading-5 text-[#77736d]">{desc}</span>{badge&&<span className="absolute left-3 top-3 rounded-full bg-[#c9a55c]/12 px-2 py-1 text-[9px] text-[#daba73]">{badge}</span>}</button> }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label><span className="label">{label}</span>{children}</label> }
function Counter({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(value:number)=>void}) { return <div><span className="label">{label}</span><div className="flex h-12 items-center justify-between border border-white/10 bg-black/20 px-2"><button type="button" aria-label={`تقليل ${label}`} onClick={()=>onChange(Math.max(min,value-1))} disabled={value<=min} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[#c9a55c] disabled:opacity-25"><Minus size={15}/></button><span className="min-w-10 text-center font-[var(--font-latin)] text-base text-[#ddd6cb]">{value}</span><button type="button" aria-label={`زيادة ${label}`} onClick={()=>onChange(Math.min(max,value+1))} disabled={value>=max} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[#c9a55c] disabled:opacity-25"><Plus size={15}/></button></div></div> }
function Summary({label,value,icon}:{label:string;value:string;icon?:React.ReactNode}) { return <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[#6f6b65]">{icon}{label}</span><span className="text-left text-[#c5bfb6]">{value}</span></div> }
