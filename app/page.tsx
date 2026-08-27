"use client";

import Image from "next/image";
import { useState } from "react";
import { BookingExperience } from "@/components/booking-experience";
import { ArrowDownLeft, ArrowUpLeft, Clock3, Headphones, ShieldCheck } from "lucide-react";

type Lang = "ar" | "en";

const copy = {
  ar: {
    airport: "مطار بغداد الدولي", book: "الحجز", switch: "EN",
    overline: "تجربة ما قبل السفر، بمستوى آخر", line1: "ما قبل الرحلة،", line2: "يستحق أن يكون أجمل.",
    intro: "صالة راقية وخدمة توصيل خاصة من وإلى مطار بغداد الدولي. نهتم بالتفاصيل، حتى تبدأ رحلتك بهدوء يليق بك.",
    cta: "احجز تجربتك", open: "متوفرون على مدار 24 ساعة", code: "بغداد · العراق", imageCaption: "هنا تبدأ الرحلة بهدوء",
    pillars: [["01", "صالة راقية", "راحة وخصوصية قبل الرحلة"], ["02", "توصيل خاص", "من وإلى مطار بغداد الدولي"], ["03", "خدمة مستمرة", "فريقنا متوفر على مدار الساعة"]],
    promise: "خصوصية. عناية. راحة.", rights: "جميع الحقوق محفوظة",
  },
  en: {
    airport: "Baghdad International Airport", book: "Booking", switch: "العربية",
    overline: "A DIFFERENT CLASS OF PRE-FLIGHT", line1: "Before the flight,", line2: "there is Lounge Baghdad.",
    intro: "A refined lounge and private transfer service to and from Baghdad International Airport. Every detail is arranged for a calmer journey.",
    cta: "Book your experience", open: "Available 24 hours a day", code: "Baghdad · Iraq", imageCaption: "Your journey begins in calm",
    pillars: [["01", "Refined lounge", "Privacy and comfort before the flight"], ["02", "Private transfer", "To and from Baghdad International Airport"], ["03", "Always available", "Our team is ready around the clock"]],
    promise: "Privacy. Care. Comfort.", rights: "All rights reserved",
  },
} as const;

function Signature({ light = false }: { light?: boolean }) {
  return (
    <div className={`signature ${light ? "signature-light" : ""}`} aria-label="Lounge Baghdad">
      <div className="signature-symbol"><span>L</span><span>B</span></div>
      <div className="signature-copy"><strong>LOUNGE</strong><strong>BAGHDAD</strong></div>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = copy[lang];
  const rtl = lang === "ar";

  return (
    <main lang={lang} dir={rtl ? "rtl" : "ltr"} className={rtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]"}>
      <section className="brand-hero" id="top">
        <header className="brand-header">
          <a href="#top"><Signature /></a>
          <div className="brand-nav">
            <span className="hidden text-[10px] text-white/45 md:block">{t.airport}</span>
            <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="language-switch" aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}>{t.switch}</button>
            <a href="#booking" className="header-book">{t.book}<ArrowDownLeft size={14} /></a>
          </div>
        </header>

        <div className="hero-watermark" aria-hidden="true">LOUNGE</div>
        <div className="hero-image-wrap">
          <Image src="/lounge-baghdad-hero.jpg" alt={rtl ? "صالة لاونج بغداد" : "Lounge Baghdad interior"} fill priority sizes="(max-width: 900px) 100vw, 68vw" className="object-cover object-center" />
          <div className="hero-image-shade" />
          <div className="image-caption"><span />{t.imageCaption}</div>
        </div>

        <div className="airport-code" aria-label="Baghdad airport code"><b>BGW</b><span>{t.code}</span></div>

        <div className="hero-statement">
          <p className="statement-overline"><span />{t.overline}</p>
          <h1><span>{t.line1}</span><em>{t.line2}</em></h1>
          <p className="statement-copy">{t.intro}</p>
          <div className="statement-actions">
            <a href="#booking" className="primary-book"><span>{t.cta}</span><i><ArrowUpLeft size={17} /></i></a>
            <p><Clock3 size={14} />{t.open}</p>
          </div>
        </div>

        <div className="hero-index" aria-hidden="true"><span>LOUNGE BAGHDAD</span><i /><b>01</b></div>
      </section>

      <section className="brand-pillars" aria-label={rtl ? "مزايا الخدمة" : "Service features"}>
        <div className="pillars-inner">
          {t.pillars.map(([number, title, description], index) => {
            const Icon = [ShieldCheck, Headphones, Clock3][index];
            return <article key={number}><span className="pillar-number">{number}</span><Icon size={20} strokeWidth={1.5} /><div><h2>{title}</h2><p>{description}</p></div></article>;
          })}
        </div>
      </section>

      <BookingExperience lang={lang} />

      <footer className="brand-footer">
        <div className="footer-top"><Signature light /><p>{t.promise}</p></div>
        <div className="footer-bottom"><span>BGW · IRAQ</span><span>{t.rights} © {new Date().getFullYear()}</span></div>
      </footer>
    </main>
  );
}
