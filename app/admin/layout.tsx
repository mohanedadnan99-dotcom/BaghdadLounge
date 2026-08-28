import Link from "next/link";
import { Settings2 } from "lucide-react";

export default function AdminLayout({children}:{children:React.ReactNode}){
  return <>
    {children}
    <Link href="/admin/operations" aria-label="التشغيل والإعدادات" className="fixed bottom-24 left-4 z-40 grid size-12 place-items-center rounded-full border border-white/20 bg-[#d8b06d] text-[#123f58] shadow-xl">
      <Settings2 className="size-5"/>
    </Link>
  </>;
}
