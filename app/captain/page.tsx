import type { Metadata } from "next";
import CaptainPortal from "./portal";

export const metadata: Metadata = {
  title: "بوابة الكباتن",
  description: "بوابة كباتن الشركات لتأكيد طلبات صالات مطار بغداد.",
  robots: { index: false, follow: false },
};

export default function CaptainPage() {
  return <CaptainPortal />;
}
