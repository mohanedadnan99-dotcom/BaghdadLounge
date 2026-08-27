"use client";

import Image from "next/image";
import { useState } from "react";
import { BookingExperience } from "@/components/booking-experience";
import { ArrowDownLeft, Clock3, Headphones, ShieldCheck } from "lucide-react";

type Lang = "ar" | "en";

const copy = {
  ar: {
    airport: "مطار بغداد الدولي", booking: "الحجز", switch: "EN", eyebrow: "ضيافة خاصة في مطار بغداد الدولي",
    title1: "بوابتك إلى", title2: "تجربة سفر أهدأ", intro: "من الصالة الراقية إلى التوصيل الخاص، نصمّم لك بداية أكثر هدوءاً وخصوصية لكل رحلة.",
    cta: "احجز تجربتك", available: "خدمتنا متاحة 24 ساعة", caption: "راحة تبدأ قبل الإقلاع", location: "بغداد · العراق",
    services: [["01", "الصالة", "هدوء وخصوصية قبل الرحلة"], ["02", "التوصيل", "سيارة خاصة من وإلى المطار"], ["03", "العناية", "فريق متوفر على مدار الساعة"]],
    manifesto: "السفر يبدأ من اللحظة التي تصل بها إلى المطار. نحن نجعل هذه اللحظة أجمل.", rights: "جميع الحقوق محفوظة",
  },
  en: {
    airport: "Baghdad International Airport", booking: "Booking", switch: "العربية", eyebrow: "PRIVATE HOSPITALITY AT BAGHDAD AIRPORT",
    title1: "Your gateway to", title2: "a calmer journey", intro: "From a refined lounge to private transfers, we shape a quieter and more personal beginning to every journey.",
    cta: "Book your experience", available: "Available 24 hours", caption: "Comfort begins before takeoff", location: "Baghdad · Iraq",
    services: [["01", "The lounge", "Calm and privacy before the flight"], ["02", "The transfer", "Private transport to and from the airport"], ["03", "The care", "A team available around the clock"]],
    manifesto: "Travel begins the moment you reach the airport. We make that moment better.", rights: "All rights reserved",
  },
} as const;

function GateLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`gate-brand ${dark ? "gate-brand-dark" : ""}`} aria-label="Lounge Baghdad">
      <svg className="gate-mark" viewBox="0 0 64 64" role="img" aria-label="LB airport gate mark">
        <path className="gate-outline" d="M8 58V20C8 11.2 15.2 4 24 4h16c8.8 0 16 7.2 16 16v38" />
        <path className="gate-runway" d="M32 4v54M22 58V20h10M42 28c6 0 10 3 10 8s-4 8-10 8H32M42 44c7 0 12 2.7 12 7s-5 7-12 7H32" />
        <path className="gate-threshold" d="M3 58h58" />
      </svg>
      <div className="gate-wordmark"><strong>LOUNGE</strong><strong>BAGHDAD</strong><span>PRIVATE AIRPORT HOSPITALITY</span></div>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = copy[lang];
  const rtl = lang === "ar";

  return (
    <main lang={lang} dir={rtl ? "rtl" : "ltr"} className={rtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]"}>
      <section className="baghdad-hero" id="top">
        <div className="baghdad-grid" aria-hidden="true" />
        <header className="baghdad-header">
          <a href="#top"><GateLogo /></a>
          <nav className="baghdad-nav" aria-label={rtl ? "التنقل الرئيسي" : "Main navigation"}>
            <span className="nav-airport">{t.airport}</span>
            <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="language-switch" aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}>{t.switch}</button>
            <a href="#booking" className="nav-book">{t.booking}<span><ArrowDownLeft size={14} /></span></a>
          </nav>
        </header>

        <div className="hero-layout">
          <div className="hero-copy">
            <div className="hero-eyebrow"><span>LB</span><i />{t.eyebrow}</div>
            <h1>{t.title1}<em>{t.title2}</em></h1>
            <p className="hero-intro">{t.intro}</p>
            <div className="hero-actions">
              <a href="#booking" className="copper-button">{t.cta}<span><ArrowDownLeft size={17} /></span></a>
              <p><Clock3 size={15} />{t.available}</p>
            </div>
            <div className="hero-route" aria-hidden="true"><b>BGW</b><span /><small>LOUNGE BAGHDAD</small></div>
          </div>

          <div className="architectural-visual">
            <div className="visual-frame">
              <Image src="/lounge-baghdad-hero.jpg" alt={rtl ? "صالة لاونج بغداد الفاخرة" : "Lounge Baghdad premium interior"} fill priority sizes="(max-width: 900px) 100vw, 54vw" className="object-cover object-center" />
              <div className="visual-shade" />
              <div className="visual-caption"><i />{t.caption}</div>
            </div>
            <div className="visual-copper-corner" aria-hidden="true" />
            <div className="bgw-stamp"><small>IATA</small><b>BGW</b><span>{t.location}</span></div>
          </div>
        </div>
      </section>

      <section className="service-ribbon">
        <div className="service-ribbon-inner">
          {t.services.map(([number, title, description], index) => {
            const Icon = [ShieldCheck, Headphones, Clock3][index];
            return <article key={number}><span>{number}</span><Icon size={21} strokeWidth={1.45} /><div><h2>{title}</h2><p>{description}</p></div></article>;
          })}
        </div>
      </section>

      <section className="brand-manifesto">
        <span aria-hidden="true">LB</span><p>{t.manifesto}</p><i aria-hidden="true">BGW / IQ</i>
      </section>

      <BookingExperience lang={lang} />

      <footer className="baghdad-footer">
        <div className="footer-brand"><GateLogo dark /><p>{rtl ? "بوابتك إلى تجربة سفر أهدأ" : "Your gateway to a calmer journey"}</p></div>
        <div className="footer-meta"><span>BGW · BAGHDAD · IRAQ</span><span>{t.rights} © {new Date().getFullYear()}</span></div>
      </footer>
    </main>
  );
}
