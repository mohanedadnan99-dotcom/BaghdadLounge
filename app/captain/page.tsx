import type { Metadata } from "next";
import CaptainPortal from "./portal";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { readMaintenanceState } from "@/lib/maintenance";

export const metadata: Metadata = {
  title: "بوابة الكباتن",
  description: "بوابة كباتن الشركات لتأكيد طلبات صالات مطار بغداد.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CaptainPage() {
  const maintenance = await readMaintenanceState();
  if (maintenance.captain) return <MaintenanceScreen kind="captain" />;
  return <CaptainPortal />;
}
