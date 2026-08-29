import "./admin-v2.css";
import AdminRoleGate from "./role-gate";

export default function AdminPage(){
  return <div className="admin-enterprise-shell">
    <AdminRoleGate/>
    <a href="/admin/system" className="fixed bottom-24 left-4 z-40 hidden rounded-2xl border border-[#d6ad68]/40 bg-[#0b3042] px-4 py-3 text-xs font-bold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-[#123f56] lg:flex lg:items-center lg:gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-[#d6ad68] text-[#12394d]">⚙</span>
      الإدارة المتقدمة
    </a>
  </div>;
}
