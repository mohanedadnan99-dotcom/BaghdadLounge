"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgePercent, CalendarDays, Check, Copy, Edit3, Loader2, LogOut, Plus, Power, Save, ShieldCheck, Trash2 } from "lucide-react";

type Promo = {
  id:number;
  company_name:string;
  code:string;
  discount_percent:number;
  starts_at:string|null;
  expires_at:string|null;
  max_uses:number|null;
  uses_count:number;
  active:boolean;
  created_at:string;
};

type FormData = { companyName:string; code:string; discountPercent:string; startsAt:string; expiresAt:string; maxUses:string };
const emptyForm:FormData = { companyName:"", code:"", discountPercent:"10", startsAt:"", expiresAt:"", maxUses:"" };

function dateForInput(value:string|null){ if(!value)return ""; const d=new Date(value); if(Number.isNaN(d.getTime()))return ""; const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,16); }
function prettyDate(value:string|null){ if(!value)return "بدون حد زمني"; return new Intl.DateTimeFormat("ar-IQ",{year:"numeric",month:"short",day:"numeric"}).format(new Date(value)); }

export default function PromoAdminPage(){
  const [token,setToken]=useState("");
  const [login,setLogin]=useState({username:"",password:""});
  const [form,setForm]=useState<FormData>(emptyForm);
  const [promos,setPromos]=useState<Promo[]>([]);
  const [editing,setEditing]=useState<Promo|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{ const saved=sessionStorage.getItem("promoAdminToken")||""; if(saved){setToken(saved);void loadPromos(saved);} },[]);

  async function api(path:string,options:RequestInit={},useToken=token){
    return fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{}),...(useToken?{Authorization:`Bearer ${useToken}`}:{})}});
  }

  async function loadPromos(useToken=token){
    const r=await api("/api/prmos/promos",{},useToken); const x=await r.json();
    if(r.status===401){logout();return}
    if(!r.ok){setMessage(x.message||"تعذر تحميل رموز الخصم");return}
    setPromos(x.promos||[]);
  }

  async function doLogin(e:FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    try{
      const r=await api("/api/prmos/login",{method:"POST",body:JSON.stringify(login)},""); const x=await r.json();
      if(!r.ok){setMessage(x.message||"تعذر تسجيل الدخول");return}
      setToken(x.token); sessionStorage.setItem("promoAdminToken",x.token); await loadPromos(x.token);
    } finally { setLoading(false); }
  }

  async function createCode(e:FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    try{
      const r=await api("/api/prmos/promos",{method:"POST",body:JSON.stringify({...form,discountPercent:Number(form.discountPercent),maxUses:form.maxUses?Number(form.maxUses):null})}); const x=await r.json();
      if(!r.ok){setMessage(x.message||"تعذر إنشاء رمز الخصم");return}
      setForm(emptyForm); setMessage(`تم إنشاء رمز ${x.promo.code} لشركة ${x.promo.company_name}`); await loadPromos();
    } finally { setLoading(false); }
  }

  async function saveEdit(e:FormEvent){
    e.preventDefault(); if(!editing)return; setLoading(true); setMessage("");
    try{
      const r=await api("/api/prmos/promos",{method:"PATCH",body:JSON.stringify({id:editing.id,companyName:editing.company_name,code:editing.code,discountPercent:editing.discount_percent,startsAt:dateForInput(editing.starts_at),expiresAt:dateForInput(editing.expires_at),maxUses:editing.max_uses,active:editing.active})}); const x=await r.json();
      if(!r.ok){setMessage(x.message||"تعذر حفظ التعديل");return}
      setEditing(null); setMessage("تم حفظ التعديل"); await loadPromos();
    } finally { setLoading(false); }
  }

  async function toggle(p:Promo){
    const r=await api("/api/prmos/promos",{method:"PATCH",body:JSON.stringify({id:p.id,companyName:p.company_name,code:p.code,discountPercent:p.discount_percent,startsAt:dateForInput(p.starts_at),expiresAt:dateForInput(p.expires_at),maxUses:p.max_uses,active:!p.active})}); const x=await r.json();
    if(!r.ok){setMessage(x.message||"تعذر تغيير الحالة");return} await loadPromos();
  }

  async function remove(p:Promo){
    if(!confirm(`حذف رمز ${p.code} الخاص بشركة ${p.company_name}؟`))return;
    const r=await api(`/api/prmos/promos?id=${p.id}`,{method:"DELETE"}); const x=await r.json(); if(!r.ok){setMessage(x.message||"تعذر الحذف");return} setMessage("تم حذف رمز الخصم"); await loadPromos();
  }

  function logout(){ setToken(""); sessionStorage.removeItem("promoAdminToken"); setPromos([]); setEditing(null); }

  const activeCount=useMemo(()=>promos.filter(p=>p.active).length,[promos]);
  const usesCount=useMemo(()=>promos.reduce((sum,p)=>sum+p.uses_count,0),[promos]);

  if(!token) return <main dir="rtl" className="min-h-screen bg-[linear-gradient(145deg,#0d3245_0%,#123f58_55%,#0a2f43_100%)] px-5 py-10 text-white">
    <div className="mx-auto max-w-sm">
      <div className="mb-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#d8b06d] text-[#153f57]"><BadgePercent className="size-8"/></div><h1 className="mt-5 text-2xl font-semibold">إدارة خصومات الشركات</h1><p className="mt-2 text-sm text-white/60">لوحة مستقلة لإدارة رموز الشركاء</p></div>
      <form onSubmit={doLogin} className="rounded-[28px] bg-white p-5 text-slate-900 shadow-[0_24px_50px_rgba(0,0,0,.18)]"><label className="text-sm font-medium">اسم المستخدم</label><input value={login.username} onChange={e=>setLogin({...login,username:e.target.value})} className="mt-2 h-14 w-full rounded-2xl border bg-[#f7f9fa] px-4 text-left" dir="ltr" placeholder="admin"/><label className="mt-4 block text-sm font-medium">كلمة المرور</label><input value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} className="mt-2 h-14 w-full rounded-2xl border bg-[#f7f9fa] px-4 text-left" dir="ltr" type="password" placeholder="••••••"/>{message&&<p className="mt-3 text-center text-sm text-red-600">{message}</p>}<button disabled={loading} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#153f57] font-semibold text-white">{loading?<Loader2 className="size-5 animate-spin"/>:<ShieldCheck className="size-5"/>}دخول الإدارة</button></form>
    </div>
  </main>;

  return <main dir="rtl" className="min-h-screen bg-[#f4f7f8] text-[#183448]">
    <header className="bg-[#123f58] text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"><button onClick={logout} className="grid size-10 place-items-center rounded-full bg-white/10"><LogOut className="size-5"/></button><div className="text-right"><p className="text-xs tracking-[.16em] text-white/50">PARTNER PROMOS</p><h1 className="mt-1 text-lg font-semibold">إدارة خصومات الشركات</h1></div></div></header>
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5">
      <div className="grid grid-cols-3 gap-3"><Stat label="رموز الخصم" value={promos.length}/><Stat label="الفعّالة" value={activeCount}/><Stat label="مرات الاستخدام" value={usesCount}/></div>
      {message&&<div className="rounded-2xl border border-[#d9e7eb] bg-white px-4 py-3 text-sm">{message}</div>}

      <form onSubmit={createCode} className="rounded-[26px] border border-[#e0e8ec] bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#edf4f6] text-[#2b7289]"><Plus className="size-5"/></span><div className="text-right"><h2 className="text-lg font-semibold">إنشاء رمز خصم جديد</h2><p className="mt-1 text-xs leading-5 text-slate-400">اربط كل رمز باسم الشركة حتى يظهر اسمها تلقائياً للعميل عند تطبيق الخصم.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="اسم الشركة" value={form.companyName} onChange={v=>setForm({...form,companyName:v})} placeholder="مثال: تكسي المميز"/>
          <Input label="رمز الخصم" value={form.code} onChange={v=>setForm({...form,code:v.toUpperCase().replace(/\s/g,"")})} placeholder="MUMAYAZ10" dir="ltr"/>
          <Input label="نسبة الخصم %" value={form.discountPercent} onChange={v=>setForm({...form,discountPercent:v})} type="number" dir="ltr" min="1" max="100"/>
          <Input label="الحد الأقصى للاستخدام — اختياري" value={form.maxUses} onChange={v=>setForm({...form,maxUses:v})} type="number" dir="ltr" min="1" placeholder="بدون حد"/>
          <Input label="يبدأ من — اختياري" value={form.startsAt} onChange={v=>setForm({...form,startsAt:v})} type="datetime-local" dir="ltr"/>
          <Input label="ينتهي في — اختياري" value={form.expiresAt} onChange={v=>setForm({...form,expiresAt:v})} type="datetime-local" dir="ltr"/>
        </div>
        <button disabled={loading} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#143f58] font-semibold text-white">{loading?<Loader2 className="size-5 animate-spin"/>:<Check className="size-5"/>}إنشاء رمز الخصم</button>
      </form>

      <section><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{promos.length} رمز</span><h2 className="text-lg font-semibold">رموز الشركات</h2></div><div className="space-y-3">{promos.map(p=>{
        const expired=p.expires_at&&new Date(p.expires_at)<new Date(); const exhausted=p.max_uses!==null&&p.uses_count>=p.max_uses;
        return <article key={p.id} className="rounded-[22px] border border-[#e0e8ec] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-2"><button onClick={()=>setEditing({...p})} className="grid size-10 place-items-center rounded-xl bg-[#edf4f6] text-[#2b7289]"><Edit3 className="size-4"/></button><button onClick={()=>toggle(p)} className={`grid size-10 place-items-center rounded-xl ${p.active?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}><Power className="size-4"/></button><button onClick={()=>remove(p)} className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 className="size-4"/></button></div><div className="min-w-0 text-right"><div className="flex items-center justify-end gap-2"><span className={`size-2 rounded-full ${p.active&&!expired&&!exhausted?"bg-emerald-400":"bg-slate-300"}`}/><h3 className="truncate font-semibold">{p.company_name}</h3></div><button type="button" onClick={()=>navigator.clipboard?.writeText(p.code)} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#f2f6f7] px-3 py-2 font-[var(--font-latin)] text-sm font-semibold text-[#153f57]"><Copy className="size-3.5"/>{p.code}</button></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Mini label="الخصم" value={`${p.discount_percent}%`}/><Mini label="الاستخدام" value={`${p.uses_count}${p.max_uses?` / ${p.max_uses}`:""}`}/><Mini label="الصلاحية" value={expired?"منتهي":exhausted?"مكتمل":p.active?"فعال":"موقوف"}/></div><div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-400"><CalendarDays className="size-3.5"/><span>{p.expires_at?`ينتهي ${prettyDate(p.expires_at)}`:"بدون تاريخ انتهاء"}</span></div></article>
      })}</div></section>

      {editing&&<form onSubmit={saveEdit} className="rounded-[26px] border-2 border-[#b8d3dc] bg-white p-5"><div className="mb-4 flex items-center justify-between"><button type="button" onClick={()=>setEditing(null)} className="text-sm text-slate-400">إلغاء</button><h2 className="font-semibold">تعديل رمز الخصم</h2></div><div className="grid gap-3 sm:grid-cols-2"><Input label="اسم الشركة" value={editing.company_name} onChange={v=>setEditing({...editing,company_name:v})}/><Input label="رمز الخصم" value={editing.code} onChange={v=>setEditing({...editing,code:v.toUpperCase().replace(/\s/g,"")})} dir="ltr"/><Input label="نسبة الخصم %" value={String(editing.discount_percent)} onChange={v=>setEditing({...editing,discount_percent:Number(v)})} type="number" dir="ltr" min="1" max="100"/><Input label="الحد الأقصى للاستخدام" value={editing.max_uses===null?"":String(editing.max_uses)} onChange={v=>setEditing({...editing,max_uses:v?Number(v):null})} type="number" dir="ltr" min="1"/><Input label="يبدأ من" value={dateForInput(editing.starts_at)} onChange={v=>setEditing({...editing,starts_at:v||null})} type="datetime-local" dir="ltr"/><Input label="ينتهي في" value={dateForInput(editing.expires_at)} onChange={v=>setEditing({...editing,expires_at:v||null})} type="datetime-local" dir="ltr"/></div><button disabled={loading} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#143f58] font-semibold text-white"><Save className="size-5"/>حفظ التعديل</button></form>}
    </div>
  </main>;
}

function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-[#e0e8ec] bg-white p-3 text-center"><div className="text-xl font-semibold text-[#153f57]">{value}</div><div className="mt-1 text-[10px] text-slate-400">{label}</div></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-[#f7f9fa] px-2 py-2"><div className="text-sm font-semibold text-[#153f57]">{value}</div><div className="mt-1 text-[9px] text-slate-400">{label}</div></div>}
function Input({label,value,onChange,placeholder="",dir="rtl",type="text",min,max}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;dir?:"rtl"|"ltr";type?:string;min?:string;max?:string}){return <label><span className="text-xs font-medium text-slate-500">{label}</span><input required={label.includes("اسم الشركة")||label.includes("رمز الخصم")||label.includes("نسبة الخصم")} value={value} onChange={e=>onChange(e.target.value)} type={type} dir={dir} min={min} max={max} placeholder={placeholder} className="mt-1 h-12 w-full rounded-xl border border-[#dde5e9] bg-[#fafcfc] px-3 outline-none focus:border-[#2b7289]"/></label>}
