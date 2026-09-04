"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

export default function HandoverResetPage() {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function reset() {
    if (confirmText !== "تصفير النظام") return;
    setBusy(true); setError(""); setResult(null);
    try {
      const token = sessionStorage.getItem("mainAdminToken") || "";
      const response = await fetch("/api/admin/handover-reset", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ confirm: "RESET_HANDOVER_DATA" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تصفير النظام");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تصفير النظام");
    } finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[#eef2f3] p-5 text-[#102d3b]">
    <div className="mx-auto max-w-xl pt-10">
      <div className="rounded-[28px] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle className="size-6"/></div><div><h1 className="text-xl font-bold">تصفير بيانات التسليم</h1><p className="mt-1 text-xs text-slate-500">مخصص للمالك فقط</p></div></div>
        <p className="mt-5 text-sm leading-7 text-slate-600">يمسح بيانات المسافرين والعمليات والشفتات والحجوزات التجريبية وطلبات الكباتن والتسويات، ويُبقي حسابات الموظفين والكباتن والشركات وشركات الطيران والأسعار والإعدادات كما هي.</p>
        {!result && <><label className="mt-5 block text-sm font-semibold">للتأكيد اكتب: تصفير النظام</label><input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4" placeholder="تصفير النظام"/><button onClick={reset} disabled={busy||confirmText!=="تصفير النظام"} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white disabled:opacity-35">{busy?<Loader2 className="size-5 animate-spin"/>:<RotateCcw className="size-5"/>}تصفير النظام الآن</button></>}
        {error&&<div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {result&&<div className="mt-5 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><div className="flex items-center gap-2 font-bold"><CheckCircle2 className="size-5"/>تم تصفير بيانات النظام</div><p className="mt-2 text-sm">عمليات الصالة: {result.removed?.opsEntries||0} · حجوزات الموقع: {result.removed?.publicBookings||0} · طلبات الكباتن: {result.removed?.captainOrders||0}</p></div>}
        <Link href="/admin" className="mt-5 block text-center text-sm font-semibold text-[#153f57]">الرجوع إلى لوحة الإدارة</Link>
      </div>
    </div>
  </main>;
}
