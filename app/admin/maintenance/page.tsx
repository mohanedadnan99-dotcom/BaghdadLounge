"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, Power, RefreshCw, ShieldAlert, Wrench } from "lucide-react";

type State={booking:boolean;captain:boolean};

export default function MaintenanceAdmin(){
  const [state,setState]=useState<State>({booking:false,captain:false});
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState<"booking"|"captain"|"">("");const [message,setMessage]=useState("");const [error,setError]=useState("");
  const token=()=>typeof window!=="undefined"?(sessionStorage.getItem("mainAdminToken")||""):"";
  async function api(url:string,opt:RequestInit={}){const t=token();return fetch(url,{...opt,credentials:"same-origin",headers:{"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}})}
  async function load(){setLoading(true);setError("");try{const r=await api("/api/admin/control?action=dashboard");if(r.status===401||r.status===403){location.replace("/admin");return}const x=await r.json();if(!r.ok)throw new Error(x.message||"تعذر تحميل حالة النظام");setState(x.maintenance||{booking:false,captain:false})}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل حالة النظام")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  async function setMaintenance(kind:"booking"|"captain",stop:boolean){setBusy(kind);setError("");setMessage("");const key=kind==="booking"?"maintenance_booking":"maintenance_captain";try{const r=await api("/api/admin/control",{method:"PATCH",body:JSON.stringify({action:"setting",key,value:stop?"1":"0"})});const x=await r.json();if(!r.ok)throw new Error(x.message||"تعذر تغيير وضع الصيانة");setState(s=>({...s,[kind]:stop}));setMessage(`${kind==="booking"?"الموقع":"بوابة الكباتن"} ${stop?"تم إيقافها ووضعها تحت الصيانة":"تم تشغيلها وأصبحت متاحة"}`)}catch(e){setError(e instanceof Error?e.message:"تعذر تنفيذ الإجراء")}finally{setBusy("")}}
  if(loading)return <main className="grid min-h-screen place-items-center bg-[#071923]"><Loader2 className="size-9 animate-spin text-[#d8b06d]"/></main>;
  return <main dir="rtl" className="min-h-screen bg-[#eef2f3] text-[#102d3b]">
    <header className="border-b bg-[#071923] text-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5"><div className="grid size-11 place-items-center rounded-2xl bg-[#d8b06d] text-[#102d3b]"><Wrench className="size-5"/></div><div className="flex-1"><div className="text-[9px] tracking-[.18em] text-[#d8b06d]">SYSTEM MAINTENANCE</div><h1 className="text-xl font-bold">إدارة تشغيل وصيانة النظام</h1></div><button onClick={()=>void load()} className="grid size-10 place-items-center rounded-xl bg-white/10" aria-label="تحديث الحالة"><RefreshCw className="size-4"/></button><Link href="/admin" className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs"><ArrowRight className="size-4"/>الأدمن</Link></div></header>
    <div className="mx-auto max-w-6xl space-y-5 p-4 py-8">
      {message&&<div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="size-5"/>{message}</div>}
      {error&&<div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><ShieldAlert className="size-5"/>{error}</div>}
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">التحكم الفعلي</h2><p className="mt-2 text-sm leading-7 text-slate-500">الإيقاف هنا يغيّر قاعدة البيانات فوراً، ويوقف الواجهة نفسها ويمنع الـAPI من قبول طلبات جديدة. صفحات الإدارة تبقى شغالة حتى تقدر ترجع النظام.</p></section>
      <div className="grid gap-5 md:grid-cols-2">
        <ServiceCard title="موقع حجز الزبائن" description="الموقع الرئيسي والحجوزات العامة" stopped={state.booking} busy={busy==="booking"} onStart={()=>setMaintenance("booking",false)} onStop={()=>setMaintenance("booking",true)} href="/"/>
        <ServiceCard title="بوابة الكباتن" description="تسجيل دخول الكباتن وإرسال طلبات الصالات" stopped={state.captain} busy={busy==="captain"} onStart={()=>setMaintenance("captain",false)} onStop={()=>setMaintenance("captain",true)} href="/captain"/>
      </div>
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900"><b>مهم:</b> وضع الصيانة لا يوقف لوحة الإدارة. هذا مقصود حتى يبقى عندك وصول دائم لزر التشغيل إذا الموقع أو بوابة الكباتن متوقفة.</section>
    </div>
  </main>
}

function ServiceCard({title,description,stopped,busy,onStart,onStop,href}:{title:string;description:string;stopped:boolean;busy:boolean;onStart:()=>void;onStop:()=>void;href:string}){
 return <section className="rounded-[28px] bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${stopped?"bg-red-100 text-red-700":"bg-emerald-100 text-emerald-700"}`}>{stopped?"تحت الصيانة":"يعمل الآن"}</span></div><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={busy||!stopped} onClick={onStart} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy?<Loader2 className="size-4 animate-spin"/>:<Power className="size-4"/>}تشغيل</button><button type="button" disabled={busy||stopped} onClick={onStop} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy?<Loader2 className="size-4 animate-spin"/>:<Power className="size-4"/>}إيقاف</button></div><Link href={href} target="_blank" className="mt-4 flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold text-slate-600">فتح الخدمة للتأكد<ExternalLink className="size-4"/></Link></section>
}
