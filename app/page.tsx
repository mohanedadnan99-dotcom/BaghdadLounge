import { BookingExperience } from "@/components/booking-experience";
import { ArrowDown, Clock3, Headphones, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#090909]">
      <section className="relative min-h-[100svh] flex items-end lg:items-center">
        <div
          className="absolute inset-0 bg-cover bg-[36%_center] lg:bg-center"
          style={{ backgroundImage: "url('https://raw.githubusercontent.com/mohanedadnan99-dotcom/BaghdadLounge/main/public/lounge-baghdad-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/50 to-black/25 lg:bg-gradient-to-l lg:from-black/90 lg:via-black/55 lg:to-black/10" />
        <div className="absolute inset-0 hero-noise" />

        <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 py-6 lg:px-14">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border border-[#c9a55c]/50 text-[#d9b86e] text-lg font-bold">LB</div>
            <div className="leading-tight">
              <div className="font-[var(--font-latin)] tracking-[.2em] text-sm">LOUNGE BAGHDAD</div>
              <div className="text-[10px] text-[#aaa49b] mt-1">مطار بغداد الدولي</div>
            </div>
          </div>
          <a href="#booking" className="hidden sm:block border border-[#c9a55c]/60 px-5 py-2.5 text-xs text-[#e5c987] hover:bg-[#c9a55c] hover:text-black transition">احجز الآن</a>
        </header>

        <div className="relative z-[1] w-full px-5 pb-14 lg:pb-0 lg:px-14 xl:px-24">
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-3 text-xs tracking-[.2em] text-[#d8bd82]"><span className="h-px w-10 bg-[#c9a55c]" />تجربة سفر استثنائية</p>
            <h1 className="text-4xl leading-[1.4] font-semibold sm:text-6xl lg:text-7xl">رحلتك تبدأ<br/><span className="gold-text">براحة تليق بك</span></h1>
            <p className="mt-6 max-w-xl text-sm leading-8 text-[#c3beb5] sm:text-base">من لحظة وصولك إلى المطار وحتى مغادرتك، نهتم بكل التفاصيل لتعيش تجربة هادئة، راقية ومتكاملة.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="#booking" className="inline-flex items-center justify-center gap-3 bg-[#c9a55c] px-8 py-4 font-semibold text-black hover:bg-[#e0c17c] transition">ابدأ الحجز <ArrowDown size={17}/></a>
              <div className="flex items-center justify-center gap-2 px-5 py-3 text-xs text-[#bdb7ae]"><Clock3 size={16} className="text-[#c9a55c]"/> متوفرون لخدمتكم على مدار الساعة</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/7 bg-[#0c0c0c] px-5 py-8 lg:px-14">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          {[[ShieldCheck,"خصوصية وراحة","عناية كاملة بتفاصيل رحلتك"],[Headphones,"خدمة على مدار الساعة","فريقنا جاهز لخدمتك دائماً"],[Clock3,"حجز سريع","خطوات واضحة وتأكيد فوري"]].map(([Icon,title,desc]) => {
            const I = Icon as typeof ShieldCheck; return <div key={String(title)} className="flex items-center gap-4"><I className="text-[#c9a55c]" size={24}/><div><h2 className="text-sm">{String(title)}</h2><p className="mt-1 text-[11px] text-[#77736d]">{String(desc)}</p></div></div>
          })}
        </div>
      </section>

      <BookingExperience />

      <footer className="border-t border-white/7 px-5 py-8 text-center text-xs text-[#77736d]">
        <div className="mb-3 font-[var(--font-latin)] tracking-[.18em] text-[#c9a55c]">LOUNGE BAGHDAD</div>
        <p>مطار بغداد الدولي · جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
