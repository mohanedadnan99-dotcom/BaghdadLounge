"use client";

import { useState } from "react";
import { BookingExperience } from "@/components/booking-experience";
import { ArrowDown, Clock3, Headphones, ShieldCheck } from "lucide-react";

const loungeLogo = "https://scontent.fbgw12-1.fna.fbcdn.net/v/t39.30808-6/268797061_106349245244621_2135641784869740368_n.jpg?stp=dst-jpg_tt6&cstp=mx1200x1200&ctp=s1200x1200&_nc_cat=106&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=do3U9gQAiiMQ7kNvwEhQEYt&_nc_oc=AdqXvsl9FCucLfdgWfVRYTENxt--k-YrPWw8cLhWL01k7qeXiZb9wyP9BK7S8d9N4ao&_nc_zt=23&_nc_ht=scontent.fbgw12-1.fna&_nc_gid=Rl-yXgLWW7kpDqI9lrKrYQ&_nc_ss=7b289&oh=00_AQE__icqwSJOrM6Gmc2ou1khWPbjMliMqr1FAN4_0NO5bw&oe=6A9522DE";

type Lang = "ar" | "en";

const copy = {
  ar: {
    airport: "مطار بغداد الدولي",
    bookNow: "احجز الآن",
    eyebrow: "تجربة سفر استثنائية",
    title1: "رحلتك تبدأ",
    title2: "براحة تليق بك",
    intro: "من لحظة وصولك إلى المطار وحتى مغادرتك، نهتم بكل التفاصيل لتعيش تجربة هادئة، راقية ومتكاملة.",
    start: "ابدأ الحجز",
    always: "متوفرون لخدمتكم على مدار الساعة",
    features: [
      ["خصوصية وراحة", "عناية كاملة بتفاصيل رحلتك"],
      ["خدمة على مدار الساعة", "فريقنا جاهز لخدمتك دائماً"],
      ["حجز سريع", "خطوات واضحة وتأكيد فوري"],
    ],
    rights: "جميع الحقوق محفوظة",
    switch: "EN",
  },
  en: {
    airport: "Baghdad International Airport",
    bookNow: "Book now",
    eyebrow: "AN EXCEPTIONAL TRAVEL EXPERIENCE",
    title1: "Your journey begins",
    title2: "with the comfort you deserve",
    intro: "From the moment you arrive at the airport until your departure, we take care of every detail for a calm, refined and seamless experience.",
    start: "Start booking",
    always: "Available 24/7 to serve you",
    features: [
      ["Privacy & comfort", "Careful attention to every detail of your journey"],
      ["24/7 service", "Our team is always ready to assist you"],
      ["Quick booking", "Clear steps and fast confirmation"],
    ],
    rights: "All rights reserved",
    switch: "العربية",
  },
} as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = copy[lang];
  const rtl = lang === "ar";

  return (
    <main lang={lang} dir={rtl ? "rtl" : "ltr"} className={`min-h-screen overflow-hidden bg-[#090909] ${rtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]"}`}>
      <section className="relative min-h-[100svh] flex items-end lg:items-center">
        <div className="absolute inset-0 bg-cover bg-[36%_center] lg:bg-center" style={{ backgroundImage: "url('https://raw.githubusercontent.com/mohanedadnan99-dotcom/BaghdadLounge/main/public/lounge-baghdad-hero.jpg')" }} />
        <div className={`absolute inset-0 bg-gradient-to-t from-[#090909] via-black/50 to-black/25 ${rtl ? "lg:bg-gradient-to-l" : "lg:bg-gradient-to-r"} lg:from-black/90 lg:via-black/55 lg:to-black/10`} />
        <div className="absolute inset-0 hero-noise" />

        <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between gap-3 px-5 py-5 lg:px-14">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-full border border-[#d6b56d]/70 bg-[#0b0b0b] p-[3px] shadow-[0_8px_35px_rgba(0,0,0,.5)] sm:h-[76px] sm:w-[76px]">
              <img src={loungeLogo} alt={rtl ? "شعار لاونج بغداد" : "Lounge Baghdad logo"} className="h-full w-full rounded-full object-cover object-center" />
            </div>
            <div className="leading-tight">
              <div className="font-[var(--font-latin)] tracking-[.18em] text-sm font-medium sm:text-base">LOUNGE BAGHDAD</div>
              <div className="mt-1.5 text-[10px] text-[#b4aea4] sm:text-[11px]">{t.airport}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[11px] font-medium text-[#e5c987] backdrop-blur transition hover:border-[#c9a55c]/70 hover:bg-[#c9a55c]/10" aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}>{t.switch}</button>
            <a href="#booking" className="hidden sm:block border border-[#c9a55c]/60 px-5 py-2.5 text-xs text-[#e5c987] hover:bg-[#c9a55c] hover:text-black transition">{t.bookNow}</a>
          </div>
        </header>

        <div className="relative z-[1] w-full px-5 pb-14 lg:pb-0 lg:px-14 xl:px-24">
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-3 text-xs tracking-[.16em] text-[#d8bd82]"><span className="h-px w-10 bg-[#c9a55c]" />{t.eyebrow}</p>
            <h1 className="text-4xl leading-[1.4] font-semibold sm:text-6xl lg:text-7xl">{t.title1}<br/><span className="gold-text">{t.title2}</span></h1>
            <p className="mt-6 max-w-xl text-sm leading-8 text-[#c3beb5] sm:text-base">{t.intro}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="#booking" className="inline-flex items-center justify-center gap-3 bg-[#c9a55c] px-8 py-4 font-semibold text-black hover:bg-[#e0c17c] transition">{t.start} <ArrowDown size={17}/></a>
              <div className="flex items-center justify-center gap-2 px-5 py-3 text-xs text-[#bdb7ae]"><Clock3 size={16} className="text-[#c9a55c]"/> {t.always}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/7 bg-[#0c0c0c] px-5 py-8 lg:px-14">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          {[[ShieldCheck,...t.features[0]],[Headphones,...t.features[1]],[Clock3,...t.features[2]]].map(([Icon,title,desc]) => {
            const I = Icon as typeof ShieldCheck; return <div key={String(title)} className="flex items-center gap-4"><I className="text-[#c9a55c]" size={24}/><div><h2 className="text-sm">{String(title)}</h2><p className="mt-1 text-[11px] text-[#77736d]">{String(desc)}</p></div></div>
          })}
        </div>
      </section>

      <BookingExperience lang={lang} />

      <footer className="border-t border-white/7 px-5 py-8 text-center text-xs text-[#77736d]">
        <div className="mb-4 flex justify-center"><div className="h-16 w-16 overflow-hidden rounded-full border border-[#c9a55c]/45 bg-[#0b0b0b] p-[3px] shadow-[0_8px_30px_rgba(0,0,0,.45)]"><img src={loungeLogo} alt={rtl ? "شعار لاونج بغداد" : "Lounge Baghdad logo"} className="h-full w-full rounded-full object-cover object-center" /></div></div>
        <div className="mb-3 font-[var(--font-latin)] tracking-[.18em] text-[#c9a55c]">LOUNGE BAGHDAD</div>
        <p>{t.airport} · {t.rights} © {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
