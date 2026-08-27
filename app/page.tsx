"use client";

import Image from "next/image";
import { useState } from "react";
import { BookingExperience } from "@/components/booking-experience";
import { ArrowDownLeft, Clock3, Headphones, ShieldCheck, Sparkles } from "lucide-react";

type Lang = "ar" | "en";

const copy = {
  ar: {
    airport: "مطار بغداد الدولي", bookNow: "احجز تجربتك", eyebrow: "لاونج بغداد · تجربة ضيافة خاصة",
    title1: "وقت السفر،", title2: "الراحة أولاً.",
    intro: "نرتّب لك تجربة صالة هادئة وخدمة توصيل خاصة من وإلى مطار بغداد الدولي، بكل عناية وخصوصية.",
    start: "ابدأ الحجز", always: "خدمتنا متاحة 24 ساعة", imageLabel: "هدوء يسبق رحلتك", imageSub: "خصوصية · راحة · عناية",
    features: [["خصوصية تامة", "مساحة هادئة بعيداً عن ازدحام المطار"], ["عناية متواصلة", "فريقنا جاهز لخدمتك على مدار الساعة"], ["حجز سلس", "أربع خطوات واضحة وتأكيد مباشر"]],
    rights: "جميع الحقوق محفوظة", switch: "EN",
  },
  en: {
    airport: "Baghdad International Airport", bookNow: "Book your experience", eyebrow: "LOUNGE BAGHDAD · PRIVATE HOSPITALITY",
    title1: "When you travel,", title2: "comfort comes first.",
    intro: "A calm lounge experience and private airport transfer, thoughtfully arranged around your journey through Baghdad International Airport.",
    start: "Start booking", always: "Available around the clock", imageLabel: "Calm before takeoff", imageSub: "Privacy · Comfort · Care",
    features: [["Complete privacy", "A calm space away from the airport crowds"], ["Attentive service", "Our team is available around the clock"], ["Seamless booking", "Four clear steps and direct confirmation"]],
    rights: "All rights reserved", switch: "العربية",
  },
} as const;

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand-mark" aria-hidden="true"><span className={compact ? "text-[13px]" : "text-[15px]"}>LB</span><i /></div>;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = copy[lang];
  const rtl = lang === "ar";

  return (
    <main lang={lang} dir={rtl ? "rtl" : "ltr"} className={`min-h-screen overflow-hidden bg-[#10110f] ${rtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]"}`}>
      <section className="relative min-h-[100svh] bg-[#10110f] text-[#f5f0e7]">
        <header className="relative z-30 mx-auto flex h-24 max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-14">
          <a href="#top" className="flex items-center gap-3.5" aria-label="Lounge Baghdad">
            <BrandMark />
            <div className="leading-none"><div className="font-[var(--font-latin)] text-[13px] font-semibold tracking-[.2em] sm:text-sm">LOUNGE BAGHDAD</div><div className="mt-2 text-[9px] text-[#9d978d] sm:text-[10px]">{t.airport}</div></div>
          </a>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="nav-pill" aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}>{t.switch}</button>
            <a href="#booking" className="hidden rounded-full bg-[#e8d5ad] px-5 py-3 text-[11px] font-semibold text-[#161713] transition hover:bg-white sm:inline-flex">{t.bookNow}</a>
          </div>
        </header>

        <div id="top" className="relative mx-auto grid min-h-[calc(100svh-6rem)] max-w-[1480px] lg:grid-cols-[.88fr_1.12fr] lg:px-8 lg:pb-8">
          <div className="relative z-10 flex items-end px-5 pb-12 pt-[54svh] sm:px-8 lg:items-center lg:px-10 lg:pb-0 lg:pt-0 xl:px-16">
            <div className="max-w-[620px]">
              <p className="hero-kicker"><Sparkles size={13} /> {t.eyebrow}</p>
              <h1 className="mt-6 text-[clamp(2.75rem,6.5vw,6.6rem)] font-medium leading-[1.16] tracking-[-.04em]">{t.title1}<br /><span className="font-light text-[#d9bc83]">{t.title2}</span></h1>
              <p className="mt-6 max-w-xl text-sm leading-8 text-[#aaa49a] sm:text-[15px] lg:mt-8">{t.intro}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4 lg:mt-10">
                <a href="#booking" className="group inline-flex items-center gap-4 rounded-full bg-[#e8d5ad] px-6 py-3.5 text-sm font-semibold text-[#151612] transition hover:bg-white">{t.start}<span className="grid h-8 w-8 place-items-center rounded-full bg-[#171814] text-[#e8d5ad] transition group-hover:-translate-x-0.5 group-hover:translate-y-0.5"><ArrowDownLeft size={15} /></span></a>
                <span className="flex items-center gap-2 text-[11px] text-[#8d887f]"><Clock3 size={15} className="text-[#d9bc83]" />{t.always}</span>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 top-0 h-[62svh] lg:relative lg:h-auto lg:min-h-0">
            <div className="absolute inset-0 overflow-hidden lg:rounded-[2rem]">
              <Image src="/lounge-baghdad-hero.jpg" alt={rtl ? "صالة لاونج بغداد الراقية" : "Lounge Baghdad interior"} fill priority sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10110f] via-black/5 to-black/20 lg:bg-gradient-to-r lg:from-[#10110f]/25 lg:via-transparent lg:to-black/5" />
            </div>
            <div className="absolute bottom-7 left-6 right-6 hidden items-end justify-between rounded-[1.4rem] border border-white/15 bg-black/25 p-5 text-white backdrop-blur-md sm:flex lg:bottom-6 lg:left-6 lg:right-6">
              <div><p className="text-sm font-medium">{t.imageLabel}</p><p className="mt-1.5 text-[10px] tracking-[.12em] text-white/60">{t.imageSub}</p></div>
              <BrandMark compact />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eae5dc] px-5 py-7 text-[#171814] sm:px-8 lg:px-14 lg:py-9">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-3 sm:gap-0">
          {[[ShieldCheck, ...t.features[0]], [Headphones, ...t.features[1]], [Clock3, ...t.features[2]]].map(([Icon, title, desc], index) => {
            const I = Icon as typeof ShieldCheck;
            return <div key={String(title)} className={`flex items-center gap-4 py-2 sm:px-7 ${index > 0 ? "sm:border-r sm:border-black/10" : ""}`}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10"><I size={19} strokeWidth={1.6} /></span><div><h2 className="text-xs font-semibold">{String(title)}</h2><p className="mt-1.5 text-[10px] leading-5 text-[#777168]">{String(desc)}</p></div></div>;
          })}
        </div>
      </section>

      <BookingExperience lang={lang} />

      <footer className="bg-[#10110f] px-5 py-10 text-[#8b867e]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-7 border-t border-white/10 pt-8 text-center sm:flex-row sm:text-start">
          <div className="flex items-center gap-3"><BrandMark compact /><div><div className="font-[var(--font-latin)] text-xs tracking-[.2em] text-[#eee7da]">LOUNGE BAGHDAD</div><div className="mt-1.5 text-[9px]">{t.airport}</div></div></div>
          <p className="text-[10px]">{t.rights} © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </main>
  );
}
