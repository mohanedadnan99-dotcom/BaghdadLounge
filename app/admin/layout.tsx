import Link from "next/link";
import { Command, Gauge, Settings2, ShieldCheck, WalletCards } from "lucide-react";

export default function AdminLayout({children}:{children:React.ReactNode}){
  return <>
    {children}
    <div className="fixed bottom-24 left-4 z-40 flex flex-col gap-2 print:hidden">
      <Link href="/admin/security" aria-label="الأمان والتشغيل اليومي" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#4b254f] text-[#f0c77f] shadow-xl"><ShieldCheck className="size-5"/></Link>
      <Link href="/admin/business" aria-label="مركز الأعمال والمالية" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#0d4a44] text-[#d8b06d] shadow-xl"><WalletCards className="size-5"/></Link>
      <Link href="/admin/control" aria-label="مركز القيادة التنفيذي" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#102d3b] text-[#d8b06d] shadow-xl"><Gauge className="size-5"/></Link>
      <Link href="/admin/command" aria-label="مركز القيادة والبحث" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#123f58] text-[#d8b06d] shadow-xl"><Command className="size-5"/></Link>
      <Link href="/admin/operations" aria-label="التشغيل والإعدادات" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#d8b06d] text-[#123f58] shadow-xl"><Settings2 className="size-5"/></Link>
    </div>
  </>;
}
