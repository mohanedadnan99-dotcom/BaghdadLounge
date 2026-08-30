"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export default function AdminLogoutButton({mobile=false}:{mobile?:boolean}){
  const [busy,setBusy]=useState(false);
  async function logout(){
    if(busy)return;
    setBusy(true);
    try{await fetch("/api/captain/admin/logout",{method:"POST",credentials:"same-origin"})}catch{}
    sessionStorage.removeItem("mainAdminToken");
    sessionStorage.removeItem("receptionAdminToken");
    sessionStorage.removeItem("accountingAdminToken");
    location.replace("/admin");
  }
  return <button type="button" onClick={logout} disabled={busy} className={mobile
    ?"flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2.5 text-xs font-bold text-red-200 disabled:opacity-60"
    :"mt-3 flex w-full items-center gap-3 rounded-2xl border border-red-400/15 bg-red-500/10 px-3 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"}>
    <LogOut className="size-4"/><span>{busy?"جاري تسجيل الخروج...":"تسجيل الخروج"}</span>
  </button>;
}
