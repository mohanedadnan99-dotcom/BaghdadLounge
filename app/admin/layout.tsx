import Link from "next/link";
import { Command, Settings2 } from "lucide-react";

export default function AdminLayout({children}:{children:React.ReactNode}){
  return <>
    {children}
    <div className="fixed bottom-24 left-4 z-40 flex flex-col gap-2">
      <Link href="/admin/command" aria-label="مركز القيادة والبحث" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#0b3042] text-[#d8b06d] shadow-xl transition hover:-translate-y-0.5">
        <Command className="size-5"/>
      </Link>
      <Link href="/admin/operations" aria-label="التشغيل والإعدادات" className="grid size-12 place-items-center rounded-full border border-white/20 bg-[#d8b06d] text-[#123f58] shadow-xl transition hover:-translate-y-0.5">
        <Settings2 className="size-5"/>
      </Link>
    </div>
  </>;
}
