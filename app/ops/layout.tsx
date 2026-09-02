import type { ReactNode } from "react";
import OpsOfflineBootstrap from "@/components/ops-offline-bootstrap";
import OpsScanFallback from "@/components/ops-scan-fallback";
import OpsHardwareScannerTest from "@/components/ops-hardware-scanner-test";

export default function OpsLayout({ children }: { children: ReactNode }) {
  return <><OpsOfflineBootstrap/><OpsScanFallback/><OpsHardwareScannerTest/>{children}</>;
}
