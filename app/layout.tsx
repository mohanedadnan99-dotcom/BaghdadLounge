import type { Metadata, Viewport } from "next";
import { Noto_Sans_Arabic, Manrope } from "next/font/google";
import { TicketOcrFetchBridge } from "@/components/ticket-ocr-fetch-bridge";
import "./globals.css";

const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", weight: ["300", "400", "500", "600", "700"] });
const latin = Manrope({ subsets: ["latin"], variable: "--font-latin" });

export const metadata: Metadata = {
  title: { default: "Lounge Baghdad | لاونج بغداد", template: "%s | Lounge Baghdad" },
  description: "احجز تجربة لاونج بغداد في مطار بغداد الدولي مع خدمة الاستقبال والتوصيل الفاخر.",
  applicationName: "Lounge Baghdad",
  keywords: ["لاونج بغداد", "مطار بغداد", "صالة كبار الشخصيات", "Baghdad Lounge"],
  openGraph: { title: "Lounge Baghdad", description: "رحلتك تبدأ براحة تليق بك", locale: "ar_IQ", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${latin.variable}`}>
      <body><TicketOcrFetchBridge />{children}</body>
    </html>
  );
}