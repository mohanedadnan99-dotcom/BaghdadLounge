import Link from "next/link";
import { BrainCircuit, Command, DatabaseZap, Gauge, Settings2, ShieldCheck, UserCog, WalletCards, Wrench } from "lucide-react";
import AdminLogoutButton from "./logout-button";

const tools=[
  {href:"/admin/employees",label:"الموظفون والصلاحيات",icon:UserCog},
  {href:"/admin/operations",label:"التشغيل والإعدادات",icon:Settings2},
  {href:"/admin/control",label:"مركز القيادة التنفيذي",icon:Gauge},
  {href:"/admin/command",label:"مركز القيادة والبحث",icon:Command},
  {href:"/admin/business",label:"الأعمال والمالية",icon:WalletCards},
  {href:"/admin/security",label:"الأمان والتشغيل اليومي",icon:ShieldCheck},
  {href:"/admin/governance",label:"الحوكمة والموثوقية",icon:DatabaseZap},
  {href:"/admin/intelligence",label:"الذكاء الإداري",icon:BrainCircuit},
  {href:"/admin/maintenance",label:"إدارة الصيانة",icon:Wrench},
];

export default function AdminLayout({children}:{children:React.ReactNode}){
  return <div className="min-h-screen bg-[#071f2b]" data-admin-layout="v2">
    <div className="mx-auto flex max-w-[1680px] gap-4 px-3 py-3 lg:px-5">
      <aside className="sticky top-3 hidden h-[calc(100vh-24px)] w-64 shrink-0 overflow-y-auto rounded-3xl border border-white/10 bg-[#0b2b39]/95 p-3 shadow-2xl backdrop-blur lg:block print:hidden">
        <div className="mb-3 border-b border-white/10 px-3 pb-3">
          <div className="text-[11px] font-semibold tracking-[.22em] text-[#d8b06d]">LOUNGE BAGHDAD</div>
          <div className="mt-1 text-sm font-bold text-white">مراكز الإدارة</div>
        </div>
        <nav className="space-y-1.5">
          {tools.map(({href,label,icon:Icon})=><Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm font-semibold text-white/75 transition hover:border-white/10 hover:bg-white/7 hover:text-white">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/7 text-[#d8b06d] transition group-hover:bg-[#d8b06d] group-hover:text-[#102d3b]"><Icon className="size-4.5"/></span>
            <span>{label}</span>
          </Link>)}
        </nav>
        <AdminLogoutButton/>
      </aside>
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
    </div>

    <div className="fixed inset-x-3 bottom-3 z-50 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b2b39]/95 p-2 shadow-2xl backdrop-blur lg:hidden print:hidden">
      <div className="flex min-w-max gap-2">
        {tools.map(({href,label,icon:Icon})=><Link key={href} href={href} className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2.5 text-xs font-semibold text-white/85">
          <Icon className="size-4 text-[#d8b06d]"/><span>{label}</span>
        </Link>)}
        <AdminLogoutButton mobile/>
      </div>
    </div>
  </div>;
}
