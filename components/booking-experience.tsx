"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Banknote, CarFront, Check, CreditCard, Loader2, Luggage, Minus, PlaneLanding, PlaneTakeoff, Plus, Users } from "lucide-react";

type Lang = "ar" | "en";
type FormState = {
  tripType: "departure" | "arrival";
  transport: "self" | "chauffeur";
  side: "karkh" | "rusafa";
  name: string; phone: string; flightNumber: string; date: string; time: string;
  passengers: number; bags: number; address: string; landmark: string; notes: string;
  payment: "cash" | "wayl";
};

const initial: FormState = { tripType:"departure", transport:"self", side:"karkh", name:"", phone:"", flightNumber:"", date:"", time:"", passengers:1, bags:0, address:"", landmark:"", notes:"", payment:"cash" };

const copy = {
  ar: {
    successLabel:"تم استلام طلبك بنجاح", successTitle:"شكراً لاختيارك لاونج بغداد", successText:"سيتواصل معك فريقنا لتأكيد تفاصيل الحجز. احتفظ برقم الحجز التالي:",
    bookingSimple:"حجزك بخطوات بسيطة", arrange:"رتّب تجربتك الآن", bookingIntro:"أدخل تفاصيل رحلتك وسيقوم فريقنا بمتابعة الحجز معك مباشرة.",
    stepOne:"الخطوة الأولى", tripQuestion:"ما نوع رحلتك؟", departure:"مغادرة من المطار", departureDesc:"ترتيب وصولك ودخولك إلى الصالة قبل السفر", arrival:"استقبال من المطار", arrivalDesc:"استقبالك بعد الوصول وتجربة أكثر راحة",
    transportService:"خدمة التوصيل", arrivalCarQ:"هل تحتاج سيارة توصلك بعد الوصول؟", accessService:"خدمة الوصول", departureCarQ:"كيف ستصل إلى المطار؟", noThanks:"لا، شكرًا", loungeOnly:"أحتاج حجز الصالة فقط بدون سيارة", self:"سأصل بنفسي", selfDesc:"أصل إلى المطار بسيارتي أو مع شخص آخر", privateCar:"أحتاج سيارة خاصة", arrivalCarDesc:"سيارة خاصة تستقبلك من المطار وتوصلك إلى وجهتك", departureCarDesc:"سيارة مريحة توصلك من موقعك إلى المطار",
    side:"الجانب", karkh:"الكرخ", rusafa:"الرصافة", deliveryAddress:"عنوان التوصيل", fullAddress:"العنوان الكامل", addressPlaceholder:"المنطقة، الشارع، المحلة", landmark:"أقرب نقطة دالة (اختياري)", landmarkPlaceholder:"مثال: قرب المستشفى...",
    travelerDetails:"تفاصيل المسافر", enterDetails:"أدخل معلومات رحلتك", fullName:"الاسم الكامل", namePlaceholder:"الاسم الثلاثي", phone:"رقم الهاتف", flight:"رقم الرحلة", flightPlaceholder:"مثال: IA123", arrivalDate:"تاريخ الوصول", departureDate:"تاريخ المغادرة", arrivalTime:"وقت الوصول المتوقع", departureTime:"وقت الحضور المطلوب", passengers:"عدد المسافرين", bags:"عدد الحقائب", kids:"* الأطفال دون سن 12 سنة دخولهم مجانًا.", extraBags:"لديك أكثر من 4 حقائب، لذلك تُضاف رسوم خدمة قدرها 10,000 د.ع لتوفير عربة إضافية وعامل للمساعدة بالحقائب.", notes:"ملاحظات إضافية (اختياري)", notesPlaceholder:"أي تفاصيل تساعدنا في ترتيب تجربتك...",
    lastStep:"الخطوة الأخيرة", payment:"اختر طريقة الدفع", cash:"الدفع كاش", cashDesc:"الدفع نقداً عند تأكيد وتقديم الخدمة", wayl:"الدفع الإلكتروني", waylDesc:"دفع آمن إلكترونياً عن طريق Wayl", back:"رجوع", next:"التالي", booking:"تأكيد الحجز", bookingNow:"جاري الحجز", genericError:"تعذر إتمام الحجز، يرجى التأكد من المعلومات والمحاولة مرة أخرى",
    summary:"ملخص الحجز", experience:"تجربة لاونج بغداد", tripType:"نوع الرحلة", postArrival:"التوصيل بعد الوصول", airportAccess:"الوصول للمطار", withoutCar:"بدون سيارة", personalArrival:"وصول شخصي", peopleOne:"شخص", peopleMany:"أشخاص", bag:"حقيبة", appointment:"الموعد", loungeEntry:"دخول الصالة", car:"السيارة الخاصة", extraBagService:"خدمة حقائب إضافية", total:"المجموع", footerNote:"دخول الصالة: 40,000 د.ع للشخص. الأطفال دون سن 12 سنة مجانًا. سعر السيارة ثابت للكرخ أو الرصافة. يخضع الحجز للتأكيد النهائي من فريقنا.",
  },
  en: {
    successLabel:"Your booking request has been received", successTitle:"Thank you for choosing Lounge Baghdad", successText:"Our team will contact you to confirm the booking details. Please keep your booking reference:",
    bookingSimple:"A simple booking experience", arrange:"Arrange your experience now", bookingIntro:"Enter your flight details and our team will follow up with you directly.",
    stepOne:"Step one", tripQuestion:"What type of trip is this?", departure:"Departure from the airport", departureDesc:"Arrange your airport arrival and lounge access before your flight", arrival:"Arrival at the airport", arrivalDesc:"A comfortable welcome after landing",
    transportService:"Transfer service", arrivalCarQ:"Do you need a private car after arrival?", accessService:"Airport access", departureCarQ:"How will you get to the airport?", noThanks:"No, thank you", loungeOnly:"Lounge booking only, without a car", self:"I will arrive myself", selfDesc:"I will reach the airport in my own car or with someone else", privateCar:"I need a private car", arrivalCarDesc:"A private car will meet you at the airport and take you to your destination", departureCarDesc:"A comfortable private car from your location to the airport",
    side:"Baghdad side", karkh:"Karkh", rusafa:"Rusafa", deliveryAddress:"Destination address", fullAddress:"Full address", addressPlaceholder:"Area, street, district", landmark:"Nearest landmark (optional)", landmarkPlaceholder:"Example: near the hospital...",
    travelerDetails:"Traveler details", enterDetails:"Enter your flight information", fullName:"Full name", namePlaceholder:"Full name", phone:"Phone number", flight:"Flight number", flightPlaceholder:"Example: IA123", arrivalDate:"Arrival date", departureDate:"Departure date", arrivalTime:"Expected arrival time", departureTime:"Required pickup time", passengers:"Passengers", bags:"Bags", kids:"* Children under 12 enter free of charge.", extraBags:"More than 4 bags require an additional IQD 10,000 handling fee for an extra trolley and baggage assistant.", notes:"Additional notes (optional)", notesPlaceholder:"Any details that help us arrange your experience...",
    lastStep:"Final step", payment:"Choose payment method", cash:"Cash payment", cashDesc:"Pay in cash when the service is confirmed and provided", wayl:"Online payment", waylDesc:"Secure online payment via Wayl", back:"Back", next:"Next", booking:"Confirm booking", bookingNow:"Booking...", genericError:"We could not complete the booking. Please check your information and try again.",
    summary:"Booking summary", experience:"Lounge Baghdad experience", tripType:"Trip type", postArrival:"Transfer after arrival", airportAccess:"Airport access", withoutCar:"No car", personalArrival:"Self arrival", peopleOne:"person", peopleMany:"people", bag:"bag", appointment:"Date & time", loungeEntry:"Lounge entry", car:"Private car", extraBagService:"Extra baggage handling", total:"Total", footerNote:"Lounge entry: IQD 40,000 per person. Children under 12 enter free. Private car pricing is fixed for Karkh or Rusafa. All bookings are subject to final confirmation by our team.",
  }
} as const;

export function BookingExperience({lang}:{lang:Lang}) {
  const t = copy[lang];
  const rtl = lang === "ar";
  const [step,setStep] = useState(1);
  const [form,setForm] = useState<FormState>(initial);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState<{reference:string; paymentUrl?:string}|null>(null);
  const loungeTotal = form.passengers * 40000;
  const carTotal = form.transport === "chauffeur" ? 75000 : 0;
  const extraBaggageTotal = form.bags > 4 ? 10000 : 0;
  const total = loungeTotal + carTotal + extraBaggageTotal;
  const money = (n:number) => lang === "ar" ? new Intl.NumberFormat("ar-IQ").format(n) + " د.ع" : "IQD " + new Intl.NumberFormat("en-US").format(n);
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
      if(!response.ok) throw new Error(lang === "ar" ? (data.error || t.genericError) : t.genericError);
      setResult(data);
      if(data.paymentUrl) window.location.href = data.paymentUrl;
    } catch(e) { setError(e instanceof Error ? e.message : t.genericError); }
    finally { setLoading(false); }
  }

  if(result && !result.paymentUrl) return (
    <section id="booking" dir={rtl?"rtl":"ltr"} className="px-5 py-20 lg:px-14">
      <div className="mx-auto max-w-xl border border-[#c9a55c]/35 bg-[#10100f] p-8 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#c9a55c] text-black"><Check size={30}/></div>
        <p className="mt-6 text-xs text-[#c9a55c]">{t.successLabel}</p>
        <h2 className="mt-3 text-2xl">{t.successTitle}</h2>
        <p className="mt-4 text-sm leading-7 text-[#98938b]">{t.successText}</p>
        <div className="mt-6 border border-dashed border-[#c9a55c]/45 bg-black/30 px-5 py-4 font-[var(--font-latin)] text-xl tracking-widest text-[#e5c987]">{result.reference}</div>
      </div>
    </section>
  );

  return (
    <section id="booking" dir={rtl?"rtl":"ltr"} className="relative px-5 py-20 lg:px-14 lg:py-28">
      <div className="absolute inset-0 hero-noise opacity-60" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="text-xs tracking-[.15em] text-[#c9a55c]">{t.bookingSimple}</p>
          <h2 className="mt-4 text-3xl sm:text-4xl">{t.arrange}</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#88847e]">{t.bookingIntro}</p>
        </div>

        <div className="grid overflow-hidden border border-white/10 bg-[#101010] shadow-2xl shadow-black lg:grid-cols-[1fr_330px]">
          <div className="p-5 sm:p-8 lg:p-10">
            <div className="mb-9 flex items-center gap-2">
              {[1,2,3,4].map(n=><div key={n} className="flex flex-1 items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] ${step>=n?"bg-[#c9a55c] text-black":"border border-white/15 text-[#777]"}`}>{step>n?<Check size={13}/>:n}</span>{n<4&&<span className={`h-px flex-1 ${step>n?"bg-[#c9a55c]":"bg-white/10"}`}/>}</div>)}
            </div>

            {step===1 && <div>
              <StepTitle eyebrow={t.stepOne} title={t.tripQuestion} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice rtl={rtl} active={form.tripType==="departure"} onClick={()=>patch("tripType","departure")} icon={<PlaneTakeoff/>} title={t.departure} desc={t.departureDesc} />
                <Choice rtl={rtl} active={form.tripType==="arrival"} onClick={()=>patch("tripType","arrival")} icon={<PlaneLanding/>} title={t.arrival} desc={t.arrivalDesc} />
              </div>
            </div>}

            {step===2 && <div>
              <StepTitle eyebrow={form.tripType==="arrival"?t.transportService:t.accessService} title={form.tripType==="arrival"?t.arrivalCarQ:t.departureCarQ} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice rtl={rtl} active={form.transport==="self"} onClick={()=>patch("transport","self")} icon={<Users/>} title={form.tripType==="arrival"?t.noThanks:t.self} desc={form.tripType==="arrival"?t.loungeOnly:t.selfDesc} />
                <Choice rtl={rtl} active={form.transport==="chauffeur"} onClick={()=>patch("transport","chauffeur")} icon={<CarFront/>} title={t.privateCar} desc={form.tripType==="arrival"?t.arrivalCarDesc:t.departureCarDesc} badge={money(75000)} />
              </div>
              {form.transport==="chauffeur" && <div className="mt-6 grid gap-4 border-t border-white/8 pt-6 sm:grid-cols-2">
                <Field label={t.side}><select className="field" value={form.side} onChange={e=>patch("side",e.target.value as FormState["side"])}><option value="karkh">{t.karkh}</option><option value="rusafa">{t.rusafa}</option></select></Field>
                <Field label={form.tripType==="arrival"?t.deliveryAddress:t.fullAddress}><input className="field" placeholder={t.addressPlaceholder} value={form.address} onChange={e=>patch("address",e.target.value)}/></Field>
                <div className="sm:col-span-2"><Field label={t.landmark}><input className="field" placeholder={t.landmarkPlaceholder} value={form.landmark} onChange={e=>patch("landmark",e.target.value)}/></Field></div>
              </div>}
            </div>}

            {step===3 && <div>
              <StepTitle eyebrow={t.travelerDetails} title={t.enterDetails} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.fullName}><input className="field" placeholder={t.namePlaceholder} value={form.name} onChange={e=>patch("name",e.target.value)}/></Field>
                <Field label={t.phone}><input className="field" dir="ltr" inputMode="tel" placeholder="07xxxxxxxxx" value={form.phone} onChange={e=>patch("phone",e.target.value)}/></Field>
                <Field label={t.flight}><input className="field" dir="ltr" placeholder={t.flightPlaceholder} value={form.flightNumber} onChange={e=>patch("flightNumber",e.target.value.toUpperCase())}/></Field>
                <Field label={form.tripType==="arrival"?t.arrivalDate:t.departureDate}><input className="field" type="date" value={form.date} onChange={e=>patch("date",e.target.value)}/></Field>
                <Field label={form.tripType==="arrival"?t.arrivalTime:t.departureTime}><input className="field" type="time" value={form.time} onChange={e=>patch("time",e.target.value)}/></Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <Counter label={t.passengers} value={form.passengers} min={1} max={20} onChange={value=>patch("passengers",value)} />
                  <Counter label={t.bags} value={form.bags} min={0} max={40} onChange={value=>patch("bags",value)} />
                </div>
                <p className="sm:col-span-2 -mt-2 text-[11px] text-[#8f897f]">{t.kids}</p>
                {form.bags > 4 && <div className="sm:col-span-2 -mt-2 border border-[#c9a55c]/25 bg-[#c9a55c]/5 px-4 py-3 text-[11px] leading-6 text-[#cdbb94]">{t.extraBags}</div>}
                <div className="sm:col-span-2"><Field label={t.notes}><textarea className="field min-h-24 resize-none" placeholder={t.notesPlaceholder} value={form.notes} onChange={e=>patch("notes",e.target.value)}/></Field></div>
              </div>
            </div>}

            {step===4 && <div>
              <StepTitle eyebrow={t.lastStep} title={t.payment} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice rtl={rtl} active={form.payment==="cash"} onClick={()=>patch("payment","cash")} icon={<Banknote/>} title={t.cash} desc={t.cashDesc} />
                <Choice rtl={rtl} active={form.payment==="wayl"} onClick={()=>patch("payment","wayl")} icon={<CreditCard/>} title={t.wayl} desc={t.waylDesc} />
              </div>
              {error&&<div role="alert" className="mt-5 border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div>}
            </div>}

            <div className="mt-10 flex items-center justify-between border-t border-white/8 pt-6">
              <button type="button" onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1} className="flex items-center gap-2 px-3 py-2 text-sm text-[#888] disabled:invisible">{rtl?<ArrowRight size={16}/>:<ArrowLeft size={16}/>} {t.back}</button>
              {step<4?<button type="button" disabled={!canContinue} onClick={()=>setStep(s=>Math.min(4,s+1))} className="flex items-center gap-2 bg-[#c9a55c] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{t.next} {rtl?<ArrowLeft size={16}/>:<ArrowRight size={16}/>}</button>:<button type="button" onClick={submit} disabled={loading} className="flex min-w-40 items-center justify-center gap-2 bg-[#c9a55c] px-6 py-3 text-sm font-semibold text-black disabled:opacity-60">{loading?<><Loader2 size={17} className="animate-spin"/> {t.bookingNow}</>:t.booking}</button>}
            </div>
          </div>

          <aside className={`border-t border-white/10 bg-[#0b0b0b] p-6 lg:border-t-0 lg:p-8 ${rtl?"lg:border-r":"lg:border-l"}`}>
            <p className="text-[11px] tracking-[.12em] text-[#c9a55c]">{t.summary}</p>
            <h3 className="mt-3 text-xl">{t.experience}</h3>
            <div className="mt-7 space-y-4 text-sm">
              <Summary label={t.tripType} value={form.tripType==="departure"?t.departure:t.arrival}/>
              <Summary label={form.tripType==="arrival"?t.postArrival:t.airportAccess} value={form.transport==="chauffeur"?t.privateCar:form.tripType==="arrival"?t.withoutCar:t.personalArrival}/>
              <Summary label={t.passengers} value={`${form.passengers} ${form.passengers===1?t.peopleOne:t.peopleMany}`} icon={<Users size={14}/>}/>
              <Summary label={t.bags} value={`${form.bags} ${t.bag}`} icon={<Luggage size={14}/>}/>
              {form.date&&<Summary label={t.appointment} value={`${form.date} · ${form.time||"--:--"}`}/>} 
            </div>
            <div className="my-7 h-px bg-white/10" />
            <div className="space-y-3 text-xs text-[#a19b92]">
              <div className="flex justify-between gap-4"><span>{t.loungeEntry} × {form.passengers}</span><span>{money(loungeTotal)}</span></div>
              {carTotal>0&&<div className="flex justify-between gap-4"><span>{t.car}</span><span>{money(carTotal)}</span></div>}
              {extraBaggageTotal>0&&<div className="flex justify-between gap-4"><span>{t.extraBagService}</span><span>{money(extraBaggageTotal)}</span></div>}
            </div>
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-dashed border-white/15 pt-5"><span className="text-sm">{t.total}</span><strong className="text-xl text-[#dfc17c]">{money(total)}</strong></div>
            <p className="mt-6 text-[10px] leading-5 text-[#605d58]">{t.footerNote}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function StepTitle({eyebrow,title}:{eyebrow:string;title:string}) { return <div className="mb-7"><p className="text-[11px] text-[#a58b55]">{eyebrow}</p><h3 className="mt-2 text-xl sm:text-2xl">{title}</h3></div> }
function Choice({active,onClick,icon,title,desc,badge,rtl}:{active:boolean;onClick:()=>void;icon:React.ReactNode;title:string;desc:string;badge?:string;rtl:boolean}) { return <button type="button" onClick={onClick} aria-pressed={active} className={`choice relative min-h-32 rounded-xl p-5 ${rtl?"text-right":"text-left"} ${active?"active":""}`}><span className={active?"text-[#daba73]":"text-[#777]"}>{icon}</span><span className="mt-4 block text-sm">{title}</span><span className="mt-2 block text-[11px] leading-5 text-[#77736d]">{desc}</span>{badge&&<span className={`absolute top-3 rounded-full bg-[#c9a55c]/12 px-2 py-1 text-[9px] text-[#daba73] ${rtl?"left-3":"right-3"}`}>{badge}</span>}</button> }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label><span className="label">{label}</span>{children}</label> }
function Counter({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(value:number)=>void}) { return <div><span className="label">{label}</span><div className="flex h-12 items-center justify-between border border-white/10 bg-black/20 px-2"><button type="button" aria-label={`Decrease ${label}`} onClick={()=>onChange(Math.max(min,value-1))} disabled={value<=min} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[#c9a55c] disabled:opacity-25"><Minus size={15}/></button><span className="min-w-10 text-center font-[var(--font-latin)] text-base text-[#ddd6cb]">{value}</span><button type="button" aria-label={`Increase ${label}`} onClick={()=>onChange(Math.min(max,value+1))} disabled={value>=max} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[#c9a55c] disabled:opacity-25"><Plus size={15}/></button></div></div> }
function Summary({label,value,icon}:{label:string;value:string;icon?:React.ReactNode}) { return <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[#6f6b65]">{icon}{label}</span><span className="text-[#c5bfb6]">{value}</span></div> }
