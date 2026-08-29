import { Clock3, ShieldCheck } from "lucide-react";

export function MaintenanceScreen({kind}:{kind:"booking"|"captain"}){
  const captain=kind==="captain";
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(216,176,109,.12),transparent_32%),linear-gradient(180deg,#071923,#0b3142)] px-5 text-white">
    <section className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/[.06] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
      <div className="mx-auto grid size-20 place-items-center rounded-[26px] bg-[#d8b06d] text-[#102d3b] shadow-lg"><ShieldCheck className="size-9"/></div>
      <div className="mt-7 text-[10px] tracking-[.22em] text-[#d8b06d]">LOUNGE BAGHDAD · BGW</div>
      <h1 className="mt-3 text-3xl font-bold">{captain?"بوابة الكباتن متوقفة مؤقتاً":"الموقع تحت الصيانة مؤقتاً"}</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/65">{captain?"تقوم الإدارة حالياً بأعمال صيانة على بوابة الكباتن. يرجى المحاولة لاحقاً.":"نقوم حالياً بأعمال صيانة لتحسين تجربة الحجز. يرجى العودة بعد قليل."}</p>
      <div className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/55"><Clock3 className="size-4"/>سيعود النظام فور انتهاء الصيانة</div>
    </section>
  </main>
}
