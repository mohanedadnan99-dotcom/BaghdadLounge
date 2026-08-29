"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, KeyRound, Laptop, LogOut, RefreshCw, ShieldCheck, UserCheck, XCircle } from "lucide-react";

type Session={id:string;username:string;name:string;role:string;device_label:string;created_at:string;last_seen_at:string;expires_at:string;revoked_at:string|null;revoked_by:string};
type Approval={id:number;kind:string;entity_key:string;title:string;payload:any;requested_by:string;requested_role:string;status:string;decided_by:string;decision_note:string;created_at:string;decided_at:string|null};
type Shift={id:number;username:string;name:string;role:string;status:string;started_at:string;ended_at:string|null;handover_note:string};
type Close={id:number;close_date:string;created_by:string;customer_orders:number;captain_orders:number;completed_orders:number;cancelled_orders:number;customer_revenue_iqd:number;invoice_payments_iqd:number;company_payments_iqd:number;open_tasks:number;overdue_invoices:number;notes:string;created_at:string};
type AlertData={credit:any[];invoices:any[]};
type Data={sessions:Session[];approvals:Approval[];shifts:Shift[];closes:Close[];alerts:AlertData;currentSessionId:string|null;session:{role:string;username?:string;name?:string}};
const money=(n:number)=>new Intl.NumberFormat("ar-IQ").format(Number(n||0))+" د.ع";
const dt=(v:string|null)=>v?new Intl.DateTimeFormat("ar-IQ",{timeZone:"Asia/Baghdad",dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—";
const todayBaghdad=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Baghdad",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export default function SecurityWorkspace(){
  const [token,setToken]=useState("");const [data,setData]=useState<Data|null>(null);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");
  const [handover,setHandover]=useState("");const [closeDate,setCloseDate]=useState(todayBaghdad());const [closeNotes,setCloseNotes]=useState("");
  const headers=useMemo(()=>({"Content-Type":"application/json",Authorization:`Bearer ${token}`}),[token]);
  async function load(t=token){if(!t)return;setLoading(true);setMessage("");try{const r=await fetch("/api/admin/security",{headers:{Authorization:`Bearer ${t}`}});const x=await r.json();if(r.status===401){sessionStorage.removeItem("mainAdminToken");setMessage("انتهت الجلسة. سجل دخولك مرة ثانية من لوحة الإدارة.");return}if(!r.ok)throw new Error(x.message||"تعذر تحميل مركز الأمان");setData(x)}catch(e){setMessage(e instanceof Error?e.message:"حدث خطأ")}finally{setLoading(false)}}
  useEffect(()=>{const t=sessionStorage.getItem("mainAdminToken")||sessionStorage.getItem("promoAdminToken")||"";setToken(t);if(t)void load(t);else{setLoading(false);setMessage("سجل دخولك أولاً من لوحة الإدارة")}},[]);
  async function post(body:any){const r=await fetch("/api/admin/security",{method:"POST",headers,body:JSON.stringify(body)});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر التنفيذ");return false}await load();return true}
  async function patch(body:any){const r=await fetch("/api/admin/security",{method:"PATCH",headers,body:JSON.stringify(body)});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر التنفيذ");return false}await load();return true}
  const mineOpen=data?.shifts.find(s=>s.username===(data.session.username||"admin")&&s.status==="open");
  if(loading)return <main className="min-h-screen bg-[#071b25] p-6 text-white" dir="rtl"><div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-8">جاري تحميل مركز الأمان والتشغيل...</div></main>;
  return <main className="min-h-screen bg-[#071b25] text-white" dir="rtl">
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 rounded-[28px] border border-[#d8b06d]/30 bg-[#0d2a38] p-6 shadow-2xl md:flex-row md:items-center md:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-[#d8b06d]"><ShieldCheck className="size-5"/><span className="text-sm font-bold">SECURITY & OPERATIONS</span></div><h1 className="text-2xl font-black md:text-3xl">الأمان والتشغيل اليومي</h1><p className="mt-2 text-sm text-white/60">الجلسات، الموافقات، الشفتات، الإغلاق اليومي والتنبيهات المالية.</p></div>
        <div className="flex gap-2"><a href="/admin" className="rounded-xl border border-white/15 px-4 py-3 text-sm">لوحة الإدارة</a><button onClick={()=>load()} className="flex items-center gap-2 rounded-xl bg-[#d8b06d] px-4 py-3 text-sm font-bold text-[#12394d]"><RefreshCw className="size-4"/>تحديث</button></div>
      </header>
      {message&&<div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{message}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <Card title="الجلسات النشطة" value={data?.sessions.filter(s=>!s.revoked_at).length||0} icon={<Laptop/>}/>
        <Card title="موافقات معلقة" value={data?.approvals.filter(a=>a.status==='pending').length||0} icon={<FileCheck2/>}/>
        <Card title="شفتات مفتوحة" value={data?.shifts.filter(s=>s.status==='open').length||0} icon={<UserCheck/>}/>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="الشفت الحالي" icon={<Clock3 className="size-5"/>}>
          {mineOpen?<div className="space-y-4"><div className="rounded-2xl bg-emerald-400/10 p-4"><b>الشفت مفتوح</b><div className="mt-1 text-sm text-white/60">بدأ {dt(mineOpen.started_at)}</div></div><textarea value={handover} onChange={e=>setHandover(e.target.value)} placeholder="ملاحظة التسليم للموظف التالي" className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none"/><button onClick={()=>post({action:'shiftEnd',note:handover})} className="w-full rounded-xl bg-rose-500 px-4 py-3 font-bold">إنهاء الشفت وتسجيل التسليم</button></div>:<button onClick={()=>post({action:'shiftStart'})} className="w-full rounded-xl bg-emerald-500 px-4 py-4 font-bold">بدء الشفت الآن</button>}
          <div className="mt-4 max-h-64 space-y-2 overflow-auto">{data?.shifts.slice(0,12).map(s=><div key={s.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex justify-between"><b>{s.name}</b><span className={s.status==='open'?"text-emerald-300":"text-white/50"}>{s.status==='open'?'مفتوح':'مغلق'}</span></div><div className="mt-1 text-white/50">{dt(s.started_at)} {s.ended_at?`← ${dt(s.ended_at)}`:''}</div>{s.handover_note&&<div className="mt-2 rounded-lg bg-white/5 p-2">تسليم: {s.handover_note}</div>}</div>)}</div>
        </Panel>

        {['owner','manager','accountant'].includes(data?.session.role||'')&&<Panel title="الإغلاق اليومي" icon={<CheckCircle2 className="size-5"/>}>
          <div className="grid gap-3"><label className="text-sm text-white/60">تاريخ الإغلاق<input type="date" value={closeDate} onChange={e=>setCloseDate(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white"/></label><textarea value={closeNotes} onChange={e=>setCloseNotes(e.target.value)} placeholder="ملاحظات الإغلاق" className="min-h-20 rounded-xl border border-white/10 bg-black/20 p-3"/><button onClick={()=>post({action:'dailyClose',date:closeDate,notes:closeNotes})} className="rounded-xl bg-[#d8b06d] px-4 py-3 font-bold text-[#12394d]">حفظ إغلاق اليوم</button></div>
          <div className="mt-4 max-h-72 space-y-2 overflow-auto">{data?.closes.slice(0,10).map(c=><div key={c.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex justify-between"><b>{String(c.close_date).slice(0,10)}</b><span>{c.created_by}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-white/60"><span>طلبات: {Number(c.customer_orders)+Number(c.captain_orders)}</span><span>مكتمل: {c.completed_orders}</span><span>ملغي: {c.cancelled_orders}</span><span>إيراد: {money(c.customer_revenue_iqd)}</span><span>دفعات فواتير: {money(c.invoice_payments_iqd)}</span><span>فواتير متأخرة: {c.overdue_invoices}</span></div></div>)}</div>
        </Panel>}
      </section>

      {data?.session.role==='owner'&&<Panel title="الجلسات والأجهزة" icon={<KeyRound className="size-5"/>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm"><thead className="text-white/50"><tr><th className="p-3">الموظف</th><th>الدور</th><th>الجهاز / المتصفح</th><th>بداية الجلسة</th><th>آخر نشاط</th><th>الحالة</th><th></th></tr></thead><tbody>{data.sessions.map(s=><tr key={s.id} className="border-t border-white/10"><td className="p-3"><b>{s.name||s.username}</b><div className="text-xs text-white/40">{s.username}</div></td><td>{s.role}</td><td className="max-w-xs truncate" title={s.device_label}>{s.device_label||'غير معروف'}</td><td>{dt(s.created_at)}</td><td>{dt(s.last_seen_at)}</td><td>{s.revoked_at?<span className="text-rose-300">منتهية</span>:s.id===data.currentSessionId?<span className="text-emerald-300">هذا الجهاز</span>:<span className="text-sky-300">نشطة</span>}</td><td>{!s.revoked_at&&s.id!==data.currentSessionId&&<button onClick={()=>patch({action:'revokeSession',id:s.id})} className="rounded-lg border border-rose-400/30 px-3 py-2 text-rose-200">إنهاء</button>}</td></tr>)}</tbody></table></div>
      </Panel>}

      {['owner','manager'].includes(data?.session.role||'')&&<Panel title="طلبات الموافقة" icon={<FileCheck2 className="size-5"/>}>
        <div className="space-y-3">{data?.approvals.length?data.approvals.map(a=><div key={a.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><b>{a.title}</b><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{a.status}</span></div><div className="mt-1 text-xs text-white/50">طلبه {a.requested_by} — {dt(a.created_at)}</div></div>{data.session.role==='owner'&&a.status==='pending'&&<div className="flex gap-2"><button onClick={()=>patch({action:'decideApproval',id:a.id,decision:'approved'})} className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold"><CheckCircle2 className="size-4"/>موافقة</button><button onClick={()=>patch({action:'decideApproval',id:a.id,decision:'rejected'})} className="flex items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-bold"><XCircle className="size-4"/>رفض</button></div>}</div><pre className="mt-3 overflow-auto rounded-xl bg-black/20 p-3 text-xs text-white/60">{JSON.stringify(a.payload,null,2)}</pre></div>):<div className="text-white/50">ماكو طلبات موافقة حالياً.</div>}</div>
      </Panel>}

      {['owner','manager','accountant'].includes(data?.session.role||'')&&<section className="grid gap-6 xl:grid-cols-2">
        <Panel title="تنبيهات الحد الائتماني" icon={<AlertTriangle className="size-5"/>}>{data?.alerts.credit.length?<div className="space-y-2">{data.alerts.credit.map((a:any)=><div key={a.name} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><div className="flex justify-between"><b>{a.name}</b><span className={Number(a.percent)>=100?'text-rose-300':'text-amber-300'}>{a.percent}%</span></div><div className="mt-1 text-sm text-white/55">الرصيد {money(a.balance)} من حد {money(a.lim)}</div></div>)}</div>:<div className="text-white/50">ماكو شركات وصلت 70% من الحد.</div>}</Panel>
        <Panel title="الفواتير المستحقة والمتأخرة" icon={<Clock3 className="size-5"/>}>{data?.alerts.invoices.length?<div className="space-y-2">{data.alerts.invoices.map((a:any)=><div key={a.id} className="rounded-xl border border-white/10 p-3"><div className="flex justify-between"><b>{a.invoice_number} — {a.company_name}</b><span className={Number(a.days_overdue)>0?'text-rose-300':'text-amber-300'}>{Number(a.days_overdue)>0?`متأخرة ${a.days_overdue} يوم`:'قريبة الاستحقاق'}</span></div><div className="mt-1 text-sm text-white/55">الاستحقاق {String(a.due_date).slice(0,10)} — {money(Number(a.total_iqd)-Number(a.paid_iqd))}</div></div>)}</div>:<div className="text-white/50">ماكو فواتير تحتاج تنبيه.</div>}</Panel>
      </section>}
    </div>
  </main>;
}

function Panel({title,icon,children}:{title:string;icon:any;children:any}){return <section className="rounded-[26px] border border-white/10 bg-[#0b2633] p-5 shadow-xl"><div className="mb-4 flex items-center gap-2 text-[#d8b06d]">{icon}<h2 className="font-black text-white">{title}</h2></div>{children}</section>}
function Card({title,value,icon}:{title:string;value:number;icon:any}){return <div className="rounded-2xl border border-white/10 bg-[#0b2633] p-5"><div className="flex items-center justify-between text-white/55"><span>{title}</span><span className="text-[#d8b06d]">{icon}</span></div><div className="mt-3 text-3xl font-black">{new Intl.NumberFormat('ar-IQ').format(value)}</div></div>}
