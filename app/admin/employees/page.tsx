"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Edit3, KeyRound, Loader2, Plus, Power, ShieldCheck, Trash2, UserCog, UsersRound, X } from "lucide-react";

type Role="owner"|"manager"|"reception"|"booking"|"captain_coordinator"|"lounge_supervisor"|"accountant"|"marketing"|"customer_service"|"viewer";
type Permission="orders"|"operations"|"captains"|"promos"|"finance"|"users"|"settings"|"reports"|"activity"|"companies"|"lounges";
type Employee={id:number;username:string;name:string;phone:string;role:Role;permissions:Permission[];active:boolean;last_login_at:string|null;created_at:string};

type FormState={id?:number;name:string;phone:string;username:string;password:string;role:Role;permissions:Permission[];active:boolean};

const roleLabels:Record<Role,string>={
  owner:"Super Admin — مدير النظام",
  manager:"Operations Manager — مدير العمليات",
  reception:"Reception — الاستقبال",
  booking:"Booking Officer — موظف الحجوزات",
  captain_coordinator:"Captain Coordinator — منسق الكباتن",
  lounge_supervisor:"Lounge Supervisor — مشرف الصالة",
  accountant:"Finance / Accountant — الحسابات",
  marketing:"Marketing Manager — التسويق والبروموكود",
  customer_service:"Customer Service — خدمة العملاء",
  viewer:"Management View — عرض الإدارة فقط",
};
const permissionLabels:Record<Permission,string>={
  orders:"الحجوزات والطلبات",
  operations:"التشغيل اليومي",
  captains:"إدارة الكباتن",
  promos:"البروموكودات والخصومات",
  finance:"الحسابات والمدفوعات",
  users:"الموظفون والصلاحيات",
  settings:"إعدادات النظام",
  reports:"التقارير والإحصائيات",
  activity:"سجل النشاط",
  companies:"الشركات المتعاونة",
  lounges:"الصالات والخدمات",
};
const allPermissions=Object.keys(permissionLabels) as Permission[];
const empty:FormState={name:"",phone:"",username:"",password:"",role:"booking",permissions:["orders"],active:true};

export default function EmployeesPage(){
  const [token,setToken]=useState("");
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [defaults,setDefaults]=useState<Record<Role,Permission[]>|null>(null);
  const [form,setForm]=useState<FormState>(empty);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{const t=sessionStorage.getItem("mainAdminToken")||"";setToken(t);if(t)void load(t);else setLoading(false)},[]);
  async function request(path:string,opt:RequestInit={},t=token){return fetch(path,{...opt,headers:{"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}})}
  async function load(t=token){setLoading(true);setMessage("");try{const r=await request("/api/admin/users",{},t);const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر تحميل الموظفين");return}setEmployees(x.users||[]);setDefaults(x.defaults||null)}catch{setMessage("تعذر الاتصال بالنظام")}finally{setLoading(false)}}

  function startCreate(){const role:Role="booking";setForm({...empty,role,permissions:defaults?.[role]||["orders"]});setOpen(true)}
  function startEdit(e:Employee){setForm({id:e.id,name:e.name,phone:e.phone||"",username:e.username,password:"",role:e.role,permissions:[...e.permissions],active:e.active});setOpen(true)}
  function changeRole(role:Role){setForm(v=>({...v,role,permissions:defaults?.[role]||v.permissions}))}
  function togglePermission(p:Permission){setForm(v=>({...v,permissions:v.permissions.includes(p)?v.permissions.filter(x=>x!==p):[...v.permissions,p]}))}
  async function save(e:FormEvent){e.preventDefault();setSaving(true);setMessage("");try{const method=form.id?"PATCH":"POST";const body:any={...form};if(form.id&&!form.password)delete body.password;const r=await request("/api/admin/users",{method,body:JSON.stringify(body)});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر حفظ الموظف");return}setOpen(false);await load()}finally{setSaving(false)}}
  async function toggle(e:Employee){const r=await request("/api/admin/users",{method:"PATCH",body:JSON.stringify({id:e.id,active:!e.active})});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر تغيير حالة الحساب");return}await load()}
  async function remove(e:Employee){if(!confirm(`حذف حساب ${e.name} نهائياً؟`))return;const r=await request(`/api/admin/users?id=${e.id}`,{method:"DELETE"});const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر حذف الحساب");return}await load()}

  const activeCount=useMemo(()=>employees.filter(x=>x.active).length,[employees]);
  const dt=(v:string|null)=>v?new Intl.DateTimeFormat("ar-IQ",{timeZone:"Asia/Baghdad",dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"لم يسجل الدخول";

  if(!token)return <main dir="rtl" className="min-h-screen bg-[#071f2b] p-6 text-white"><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><ShieldCheck className="mx-auto mb-4 size-10 text-[#d8b06d]"/><h1 className="text-xl font-bold">يجب تسجيل الدخول أولاً</h1><Link href="/admin" className="mt-5 inline-flex rounded-xl bg-[#d8b06d] px-5 py-3 font-bold text-[#071f2b]">العودة للوحة الإدارة</Link></div></main>;

  return <main dir="rtl" className="min-h-screen bg-[#071f2b] px-4 py-6 text-white sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#d8b06d]"><UserCog className="size-4"/> إدارة الوصول والصلاحيات</div>
          <h1 className="text-2xl font-black sm:text-3xl">الموظفون والصلاحيات</h1>
          <p className="mt-2 text-sm text-white/55">أنشئ حساباً مستقلاً لكل موظف وحدد ما يستطيع الوصول إليه داخل نظام لاونج بغداد.</p>
        </div>
        <div className="flex gap-2"><Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><ArrowRight className="size-4"/> اللوحة الرئيسية</Link><button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#d8b06d] px-4 py-3 text-sm font-bold text-[#071f2b]"><Plus className="size-4"/> إضافة موظف</button></div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="إجمالي الموظفين" value={employees.length}/><Stat label="الحسابات الفعالة" value={activeCount}/><Stat label="الحسابات الموقوفة" value={employees.length-activeCount}/>
      </div>
      {message&&<div className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{message}</div>}

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] shadow-2xl">
        {loading?<div className="grid min-h-64 place-items-center"><Loader2 className="size-8 animate-spin text-[#d8b06d]"/></div>:employees.length===0?<div className="p-12 text-center text-white/50"><UsersRound className="mx-auto mb-3 size-10"/>لا توجد حسابات موظفين بعد.</div>:
        <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-right text-sm"><thead className="bg-white/[.05] text-white/55"><tr><th className="p-4">الموظف</th><th className="p-4">المسمى الوظيفي</th><th className="p-4">الصلاحيات</th><th className="p-4">آخر دخول</th><th className="p-4">الحالة</th><th className="p-4">الإجراءات</th></tr></thead><tbody>{employees.map(e=><tr key={e.id} className="border-t border-white/[.07]"><td className="p-4"><div className="font-bold">{e.name}</div><div className="mt-1 text-xs text-white/45">@{e.username}{e.phone?` · ${e.phone}`:""}</div></td><td className="p-4"><span className="rounded-full border border-[#d8b06d]/20 bg-[#d8b06d]/10 px-3 py-1 text-xs text-[#efcf96]">{roleLabels[e.role]}</span></td><td className="p-4"><div className="flex max-w-md flex-wrap gap-1">{e.permissions.slice(0,4).map(p=><span key={p} className="rounded-lg bg-white/[.06] px-2 py-1 text-[11px] text-white/65">{permissionLabels[p]}</span>)}{e.permissions.length>4&&<span className="rounded-lg bg-white/[.06] px-2 py-1 text-[11px] text-white/45">+{e.permissions.length-4}</span>}</div></td><td className="p-4 text-xs text-white/55">{dt(e.last_login_at)}</td><td className="p-4"><button onClick={()=>void toggle(e)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${e.active?"bg-emerald-500/15 text-emerald-200":"bg-white/[.06] text-white/45"}`}><Power className="size-3.5"/>{e.active?"فعال":"موقوف"}</button></td><td className="p-4"><div className="flex gap-2"><button onClick={()=>startEdit(e)} className="grid size-9 place-items-center rounded-xl bg-white/[.06] text-white/70" title="تعديل"><Edit3 className="size-4"/></button><button onClick={()=>void remove(e)} className="grid size-9 place-items-center rounded-xl bg-red-500/10 text-red-200" title="حذف"><Trash2 className="size-4"/></button></div></td></tr>)}</tbody></table></div>}
      </div>
    </div>

    {open&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={save} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0b2a38] p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-black">{form.id?"تعديل حساب الموظف":"إضافة موظف جديد"}</h2><p className="mt-1 text-xs text-white/45">لكل موظف حساب مستقل وصلاحيات خاصة به.</p></div><button type="button" onClick={()=>setOpen(false)} className="grid size-10 place-items-center rounded-xl bg-white/[.06]"><X className="size-5"/></button></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="اسم الموظف"><input required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="input" placeholder="الاسم الكامل"/></Field><Field label="رقم الهاتف"><input value={form.phone} onChange={e=>setForm(v=>({...v,phone:e.target.value}))} className="input" placeholder="07xxxxxxxxx"/></Field><Field label="اسم المستخدم"><input required autoCapitalize="none" value={form.username} onChange={e=>setForm(v=>({...v,username:e.target.value}))} className="input" placeholder="username"/></Field><Field label={form.id?"كلمة مرور جديدة — اختياري":"كلمة المرور"}><div className="relative"><KeyRound className="absolute right-3 top-3 size-4 text-white/30"/><input required={!form.id} minLength={form.id?0:6} type="password" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))} className="input pr-10" placeholder={form.id?"اتركها فارغة بدون تغيير":"6 أحرف على الأقل"}/></div></Field></div>
      <Field label="المسمى الوظيفي"><select value={form.role} onChange={e=>changeRole(e.target.value as Role)} className="input">{(Object.keys(roleLabels) as Role[]).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></Field>
      <div className="mt-5"><div className="mb-3 flex items-center justify-between"><label className="text-sm font-bold">الصلاحيات</label><span className="text-xs text-white/40">{form.permissions.length} محددة</span></div><div className="grid gap-2 sm:grid-cols-2">{allPermissions.map(p=>{const checked=form.permissions.includes(p);return <button key={p} type="button" onClick={()=>togglePermission(p)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-right text-sm transition ${checked?"border-[#d8b06d]/40 bg-[#d8b06d]/10 text-[#f3d59f]":"border-white/[.08] bg-white/[.03] text-white/60"}`}><span>{permissionLabels[p]}</span><span className={`grid size-5 place-items-center rounded-md border ${checked?"border-[#d8b06d] bg-[#d8b06d] text-[#071f2b]":"border-white/20"}`}>{checked&&<Check className="size-3.5"/>}</span></button>})}</div></div>
      <label className="mt-5 flex items-center justify-between rounded-2xl border border-white/[.08] bg-white/[.03] px-4 py-3"><span><span className="block text-sm font-bold">الحساب فعال</span><span className="text-xs text-white/40">إيقافه يمنع الموظف من تسجيل الدخول.</span></span><input type="checkbox" checked={form.active} onChange={e=>setForm(v=>({...v,active:e.target.checked}))} className="size-5"/></label>
      <div className="mt-6 flex gap-3"><button disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#d8b06d] px-5 py-3.5 font-black text-[#071f2b] disabled:opacity-50">{saving?<Loader2 className="size-4 animate-spin"/>:<ShieldCheck className="size-4"/>}{form.id?"حفظ التعديلات":"إنشاء الحساب"}</button><button type="button" onClick={()=>setOpen(false)} className="rounded-2xl border border-white/10 px-5 py-3.5 text-white/65">إلغاء</button></div>
    </form></div>}

    <style jsx global>{`.input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);padding:12px 14px;color:white;outline:none}.input:focus{border-color:rgba(216,176,109,.65);box-shadow:0 0 0 3px rgba(216,176,109,.08)}select.input option{color:#071f2b}`}</style>
  </main>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="mt-4 block"><span className="mb-2 block text-xs font-bold text-white/60">{label}</span>{children}</label>}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-white/[.08] bg-white/[.04] p-4"><div className="text-xs text-white/45">{label}</div><div className="mt-1 text-2xl font-black text-[#efcf96]">{value}</div></div>}
