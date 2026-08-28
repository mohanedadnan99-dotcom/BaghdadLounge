"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Edit3, Loader2, LogOut, Plus, Power, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";

type Captain = { id:number; username:string; name:string; company:string; phone:string; active:boolean; created_at:string };
const emptyForm = { name:"", company:"", phone:"", username:"", password:"" };

export default function CaptainAdminPage(){
  const [token,setToken]=useState("");
  const [login,setLogin]=useState({username:"",password:""});
  const [form,setForm]=useState(emptyForm);
  const [captains,setCaptains]=useState<Captain[]>([]);
  const [editing,setEditing]=useState<Captain|null>(null);
  const [editPassword,setEditPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{ const saved=sessionStorage.getItem("captainAdminToken")||""; if(saved){setToken(saved); loadCaptains(saved);} },[]);

  async function api(path:string, options:RequestInit={}, useToken=token){
    return fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{}),...(useToken?{Authorization:`Bearer ${useToken}`}:{})}});
  }

  async function loadCaptains(useToken=token){
    const r=await api("/api/captain/admin/captains",{},useToken); const x=await r.json();
    if(r.status===401){logout();return}
    if(!r.ok){setMessage(x.message||"تعذر تحميل الحسابات");return}
    setCaptains(x.captains||[]);
  }

  async function doLogin(e:FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    try{const r=await api("/api/captain/admin/login",{method:"POST",body:JSON.stringify(login)},"");const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر الدخول");return}setToken(x.token);sessionStorage.setItem("captainAdminToken",x.token);await loadCaptains(x.token);}finally{setLoading(false)}
  }

  async function createAccount(e:FormEvent){
    e.preventDefault(); setLoading(true); setMessage("");
    try{const r=await api("/api/captain/admin/captains",{method:"POST",body:JSON.stringify(form)});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر إنشاء الحساب");return}setForm(emptyForm);setMessage("تم إنشاء حساب الكابتن وصار فعال فوراً");await loadCaptains();}finally{setLoading(false)}
  }

  async function saveEdit(e:FormEvent){
    e.preventDefault(); if(!editing)return; setLoading(true); setMessage("");
    try{const r=await api("/api/captain/admin/captains",{method:"PATCH",body:JSON.stringify({...editing,password:editPassword})});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر الحفظ");return}setEditing(null);setEditPassword("");setMessage("تم حفظ التعديل");await loadCaptains();}finally{setLoading(false)}
  }

  async function toggle(c:Captain){
    const r=await api("/api/captain/admin/captains",{method:"PATCH",body:JSON.stringify({...c,active:!c.active})});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر تغيير الحالة");return}await loadCaptains();
  }

  async function remove(c:Captain){
    if(!confirm(`حذف حساب ${c.name} نهائياً؟`))return;
    const r=await api(`/api/captain/admin/captains?id=${c.id}`,{method:"DELETE"});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر الحذف");return}setMessage("تم حذف الحساب");await loadCaptains();
  }

  function logout(){setToken("");sessionStorage.removeItem("captainAdminToken");setCaptains([]);setEditing(null)}

  if(!token) return <main dir="rtl" className="min-h-screen bg-[#0f3a50] px-5 py-10 text-white"><div className="mx-auto max-w-sm"><div className="mb-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#d8b06d] text-[#153f57]"><ShieldCheck className="size-8"/></div><h1 className="mt-5 text-2xl font-semibold">لوحة إدارة الكباتن</h1><p className="mt-2 text-sm text-white/60">دخول مخصص للإدارة فقط</p></div><form onSubmit={doLogin} className="rounded-[28px] bg-white p-5 text-slate-900"><label className="text-sm font-medium">اسم المستخدم</label><input value={login.username} onChange={e=>setLogin({...login,username:e.target.value})} className="mt-2 h-14 w-full rounded-2xl border bg-[#f7f9fa] px-4 text-left" dir="ltr" placeholder="admin"/><label className="mt-4 block text-sm font-medium">كلمة المرور</label><input value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} className="mt-2 h-14 w-full rounded-2xl border bg-[#f7f9fa] px-4 text-left" dir="ltr" type="password" placeholder="••••••"/>{message&&<p className="mt-3 text-center text-sm text-red-600">{message}</p>}<button disabled={loading} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#153f57] font-semibold text-white">{loading?<Loader2 className="size-5 animate-spin"/>:<ShieldCheck className="size-5"/>}دخول الأدمن</button></form></div></main>;

  return <main dir="rtl" className="min-h-screen bg-[#f4f7f8] text-[#183448]"><header className="bg-[#123f58] text-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4"><button onClick={logout} className="grid size-10 place-items-center rounded-full bg-white/10"><LogOut className="size-5"/></button><div className="text-right"><p className="text-xs text-white/60">ADMIN PANEL</p><h1 className="mt-1 text-lg font-semibold">إدارة حسابات الكباتن</h1></div></div></header><div className="mx-auto max-w-3xl space-y-5 px-4 py-5">{message&&<div className="rounded-2xl border border-[#d9e7eb] bg-white px-4 py-3 text-sm">{message}</div>}

  <form onSubmit={createAccount} className="rounded-[26px] border border-[#e0e8ec] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">إنشاء كابتن جديد</h2><p className="mt-1 text-xs text-slate-400">الحساب يشتغل فوراً بعد الموافقة</p></div><span className="grid size-11 place-items-center rounded-2xl bg-[#edf4f6] text-[#2b7289]"><Plus className="size-5"/></span></div><div className="grid gap-3 sm:grid-cols-2">{[["name","اسم الكابتن"],["company","اسم الشركة"],["phone","رقم الهاتف"],["username","اليوزر"],["password","الباسورد"]].map(([k,l])=><label key={k} className={k==="password"?"sm:col-span-2":""}><span className="text-xs font-medium text-slate-500">{l}</span><input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})} type={k==="password"?"password":"text"} dir={k==="username"||k==="password"||k==="phone"?"ltr":"rtl"} className="mt-1 h-12 w-full rounded-xl border border-[#dde5e9] bg-[#fafcfc] px-3 outline-none focus:border-[#2b7289]" required={k!=="phone"}/></label>)}</div><button disabled={loading} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#143f58] font-semibold text-white"><Check className="size-5"/>موافق — إنشاء الحساب</button></form>

  <section><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{captains.length} حساب</span><h2 className="text-lg font-semibold">الكباتن الحاليين</h2></div><div className="space-y-3">{captains.map(c=><article key={c.id} className="rounded-[22px] border border-[#e0e8ec] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-2"><button onClick={()=>setEditing({...c})} className="grid size-10 place-items-center rounded-xl bg-[#edf4f6] text-[#2b7289]"><Edit3 className="size-4"/></button><button onClick={()=>toggle(c)} className={`grid size-10 place-items-center rounded-xl ${c.active?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}><Power className="size-4"/></button><button onClick={()=>remove(c)} className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 className="size-4"/></button></div><div className="min-w-0 text-right"><div className="flex items-center justify-end gap-2"><span className={`size-2 rounded-full ${c.active?"bg-emerald-400":"bg-slate-300"}`}/><h3 className="truncate font-semibold">{c.name}</h3></div><p className="mt-1 text-xs text-slate-400">{c.company}</p><p className="mt-2 text-sm" dir="ltr">@{c.username} · {c.phone||"بدون رقم"}</p></div></div></article>)}</div></section>

  {editing&&<form onSubmit={saveEdit} className="rounded-[26px] border-2 border-[#b8d3dc] bg-white p-5"><div className="mb-4 flex items-center justify-between"><button type="button" onClick={()=>setEditing(null)} className="text-sm text-slate-400">إلغاء</button><h2 className="font-semibold">تعديل الحساب</h2></div><div className="grid gap-3 sm:grid-cols-2">{[["name","اسم الكابتن"],["company","اسم الشركة"],["phone","رقم الهاتف"],["username","اليوزر"]].map(([k,l])=><label key={k}><span className="text-xs text-slate-500">{l}</span><input value={(editing as any)[k]} onChange={e=>setEditing({...editing,[k]:e.target.value})} className="mt-1 h-12 w-full rounded-xl border px-3" dir={k==="username"||k==="phone"?"ltr":"rtl"}/></label>)}<label className="sm:col-span-2"><span className="text-xs text-slate-500">باسورد جديد (اتركه فارغ إذا ما تريد تغيّره)</span><input value={editPassword} onChange={e=>setEditPassword(e.target.value)} type="password" dir="ltr" className="mt-1 h-12 w-full rounded-xl border px-3"/></label></div><button disabled={loading} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#143f58] font-semibold text-white"><Save className="size-5"/>حفظ التعديل</button></form>}
  </div></main>
}
