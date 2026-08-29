import PublicHome from "@/components/public-home";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { readMaintenanceState } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function Home() {
  const maintenance = await readMaintenanceState();
  if (maintenance.booking) return <MaintenanceScreen kind="booking" />;
  return <PublicHome />;
}
