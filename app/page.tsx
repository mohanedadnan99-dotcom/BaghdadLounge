"use client";

import Image from "next/image";
import { useState } from "react";
import { BookingExperienceLive } from "@/components/booking-experience-live";
import { ArrowDown, CarFront, Check, Clock3, PlaneTakeoff, ShieldCheck } from "lucide-react";

type Lang = "ar" | "en";

const copy = {
  ar: {
    airport: "مطار بغداد الدولي", booking: "احجز الآن", switch: "EN", badge: "صالة مطار بغداد",
    title: "احجز صالة مطار بغداد", titleAccent: "ورحلتك تبدأ براحة", intro: "استمتع بوقت هادئ ومريح قبل رحلتك، مع إمكانية إضافة سيارة خاصة توصلك من وإلى المطار.",
    cta: "ابدأ الحجز", price: "40,000 د.ع", priceLabel: "دخول الشخص الواحد", open: "متاح 24 ساعة طوال أيام الأسبوع",
    assurances: [["صالة راقية", "جلسات مريحة وخصوصية"], ["توصيل خاص", "من وإلى مطار بغداد"], ["حجز واضح", "تأكيد ومتابعة مباشرة"]],
    sectionTitle: "كل ما تحتاجه قبل رحلتك", sectionText: "نرتّب الصالة والتوصيل في حجز واحد واضح، حتى تصل إلى المطار وأنت مرتاح.",
    rights: "جميع الحقوق محفوظة", footerLine: "صالة راقية وخدمة توصيل من وإلى مطار بغداد الدولي",
  },
  en: {
    airport: "Baghdad International Airport", booking: "Book now", switch: "العربية", badge: "Baghdad Airport Lounge",
    title: "Book Baghdad Airport Lounge", titleAccent: "and start your journey in comfort", intro: "Enjoy a calm, comfortable time before your flight, with an optional private transfer to or from the airport.",
    cta: "Start booking", price: "IQD 40,000", priceLabel: "per lounge guest", open: "Available 24/7, every day",
    assurances: [["Premium lounge", "Comfortable seating and privacy"], ["Private transfer", "To and from Baghdad Airport"], ["Clear booking", "Direct confirmation and follow-up"]],
    sectionTitle: "Everything you need before your flight", sectionText: "Arrange lounge access and private transfer in one clear booking, so you reach the airport feeling at ease.",
    rights: "All rights reserved", footerLine: "Premium lounge and transfer service at Baghdad International Airport",
  },
} as const;

function LoungeLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`lounge-logo ${dark ? "lounge-logo-dark" : ""}`} aria-label="Lounge Baghdad">
      <span className="logo-mark"><b>L</b><i /><b>B</b></span>
      <span className="logo-type"><strong>LOUNGE BAGHDAD</strong><small>Baghdad International Airport</small></span>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("ar");
  const t = copy[lang];
  const rtl = lang === "ar";

  return (
    <main lang={lang} dir={rtl ? "rtl" : "ltr"} className={rtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]"}>
      <section className="lounge-hero" id="top">
        <Image src="/lounge-hero-v2.jpg" alt={rtl ? "صالة مطار فاخرة تطل على مدرج الطائرات" : "Premium airport lounge overlooking the runway"} fill priority sizes="100vw" className="hero-photo" />
        <div className="hero-overlay" />

        <header className="lounge-header">
          <a href="#top"><LoungeLogo /></a>
          <div className="header-actions">
            <span className="header-airport">{t.airport}</span>
            <button type="button" className="language-button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التبديل إلى العربية"}>{t.switch}</button>
            <a href="#booking" className="header-cta">{t.booking}</a>
          </div>
        </header>

        <div className="hero-content">
          <div className="hero-badge"><PlaneTakeoff size={15} />{t.badge}<span>BGW</span></div>
          <h1>{t.title}<em>{t.titleAccent}</em></h1>
          <p>{t.intro}</p>
          <div className="hero-cta-row">
            <a href="#booking" className="main-cta">{t.cta}<span><ArrowDown size={17} /></span></a>
            <div className="hero-price"><strong>{t.price}</strong><small>{t.priceLabel}</small></div>
          </div>
          <div className="availability"><Clock3 size={15} /><span>{t.open}</span></div>
        </div>

        <div className="hero-proof">
          <ShieldCheck size={18} /><span>LOUNGE BAGHDAD</span><i /> <b>BGW</b>
        </div>
      </section>

      <section className="assurance-bar">
        <div className="assurance-inner">
          {t.assurances.map(([title, description], index) => {
            const Icon = [PlaneTakeoff, CarFront, Check][index];
            return <article key={title}><Icon size={21} strokeWidth={1.6} /><div><h2>{title}</h2><p>{description}</p></div></article>;
          })}
        </div>
      </section>

      <section className="booking-introduction">
        <span>LOUNGE BAGHDAD · BGW</span><h2>{t.sectionTitle}</h2><p>{t.sectionText}</p>
      </section>

      <BookingExperienceLive lang={lang} />

      <footer className="lounge-footer">
        <div className="footer-main"><LoungeLogo dark /><p>{t.footerLine}</p></div>
        <div className="footer-meta"><span>BGW · BAGHDAD · IRAQ</span><span>{t.rights} © {new Date().getFullYear()}</span></div>
      </footer>
    </main>
  );
}
