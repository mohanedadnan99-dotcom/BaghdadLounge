import type { ReactNode } from "react";
import OpsPricingBridge from "@/components/ops-pricing-bridge";
import OpsScanFallback from "@/components/ops-scan-fallback";
export default function OpsLayout({children}:{children:ReactNode}){return <><OpsPricingBridge/><OpsScanFallback/>{children}</>}
