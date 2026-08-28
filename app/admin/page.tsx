"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgePercent, Building2, ChevronLeft, CircleDollarSign, Clock3, Download, Eye, Filter,
  LayoutDashboard, Loader2, LogOut, RefreshCw, Search, ShieldCheck, TicketCheck, UsersRound, X,
  BarChart3, BriefcaseBusiness, Phone, Luggage, Armchair, MapPin, CalendarDays
} from "lucide-react";

type Tab="dashboard"|"bookings"|"reports"|"captains"|"companies"|"promos";
type Booking={
  id:number; reference:string; customer_name:string; phone:string; airline:string|null; flight_number:string;
  trip_type:string; transport:string; booking_date:string; booking_time:string; passengers:number; bags:number;
  payment_method:string; payment_status:string; total_iqd:number; promo_code:string|null; discount_iqd:number;
  status:string; created_at:string; source?:"customer"|"captain"; company?:string|null; lounge?:string|null; carts?:number|null;
};
type Company={name:string;captains:number;promos:number;promo_uses:number};
type Overview={stats:{bookings_today:number;new_bookings:number;completed_today:number;passengers_today:number;revenue_today:number};captains:{total:number;active:number};promos:{total:number;active:number;uses:number};recent:Booking[];companies:Company[]};

type FilterState={search:string;status:string;source:string;company:string;lounge:string};
const initialFilters:FilterState={search:"",status:"all",source:"all",company:"all",lounge:"all"};

const statusMap:Record<string,{label:string;className:string}>={
  new:{label:"جديد",className:"bg-amber-50 text-amber-700"},
  received:{label:"تم الاستلام",className:"bg-sky-50 text-sky-700"},
  in_progress:{label:"قيد التنفيذ",className:"bg-violet-50 text-violet-700"},
  completed:{label:"مكتمل",className:"bg-emerald-50 text-emerald-700"},
  cancelled:{label:"ملغي",className:"bg-red-50 text-red-700"}
};
const money=(n:number)=>new Intl.NumberFormat("ar-IQ").format(Number(n||0))+" د.ع";
const dateTime=(v:string)=>new Intl.DateTimeFormat("ar-IQ",{timeZone:"Asia/Baghdad",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v));

export default function AdminControlCenter(){
  const [token,setToken]=useState("");
  const [login,setLogin]=useState({username:"",password:""});
  const [tab,setTab]=useState<Tab>("dashboard");
  const [overview,setOverview]=useState<Overview|null>(null);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [selected,setSelected]=useState<Booking|null>(null);
  const [filters,setFilters]=useState<FilterState>(initialFilters);
  const [showFilters,setShowFilters]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{const saved=sessionStorage.getItem("mainAdminToken")||"";if(saved){setToken(saved);void loadAll(saved)}},[]);
  async function api(path:string,options:RequestInit={},useToken=token){return fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{}),...(useToken?{Authorization:`Bearer ${useToken}`}:{})}})}
  async function loadAll(useToken=token){
    setLoading(true);setMessage("");
    try{
      const [a,b]=await Promise.all([api("/api/admin/overview",{},useToken),api("/api/admin/bookings",{},useToken)]);
      if(a.status===401||b.status===401){logout();return}
      const ax=await a.json(),bx=await b.json();
      if(!a.ok)throw new Error(ax.message||"تعذر تحميل لوحة الإدارة");
      if(!b.ok)throw new Error(bx.message||"تعذر تحميل الطلبات");
      setOverview(ax);setBookings(bx.bookings||[]);
    }catch(e){setMessage(e instanceof Error?e.message:"حدث خطأ")}finally{setLoading(false)}
  }
  async function doLogin(e:FormEvent){
    e.preventDefault();setLoading(true);setMessage("");
    try{const r=await api("/api/captain/admin/login",{method:"POST",body:JSON.stringify(login)},"");const x=await r.json();if(!r.ok){setMessage(x.message||"تعذر تسجيل الدخول");return}setToken(x.token);sessionStorage.setItem("mainAdminToken",x.token);await loadAll(x.token)}finally{setLoading(false)}
  }
  async function changeStatus(id:number,status:string){
    const r=await api("/api/admin/bookings",{method:"PATCH",body:JSON.stringify({id,status})});const x=await r.json();
    if(!r.ok){setMessage(x.message||"تعذر تحديث الطلب");return}
    setBookings(v=>v.map(b=>b.id===id?{...b,status}:b));
    setOverview(v=>v?{...v,recent:v.recent.map(b=>b.id===id?{...b,status}:b)}:v);
    setSelected(v=>v?.id===id?{...v,status}:v);
  }
  function logout(){setToken("");sessionStorage.removeItem("mainAdminToken");setOverview(null);setBookings([]);setSelected(null)}

  const newCount=useMemo(()=>bookings.filter(b=>b.status==="new").length,[bookings]);
  const companies=useMemo(()=>Array.from(new Set(bookings.map(b=>b.company).filter(Boolean) as string[])).sort(),[bookings]);
  const lounges=useMemo(()=>Array.from(new Set(bookings.map(b=>b.lounge).filter(Boolean) as string[])).sort(),[bookings]);
  const filtered=useMemo(()=>bookings.filter(b=>{
    const q=filters.search.trim().toLowerCase();
    const hay=[b.reference,b.customer_name,b.phone,b.company||"",b.lounge||"",b.flight_number||""].join(" ").toLowerCase();
    if(q&&!hay.includes(q))return false;
    if(filters.status!=="all"&&b.status!==filters.status)return false;
    if(filters.source!=="all"&&b.source!==filters.source)return false;
    if(filters.company!=="all"&&b.company!==filters.company)return false;
    if(filters.lounge!=="all"&&b.lounge!==filters.lounge)return false;
    return true;
  }),[bookings,filters]);

  const captainReport=useMemo(()=>{
    const map=new Map<string,{name:string;company:string;orders:number;passengers:number;last:string}>();
    bookings.filter(b=>b.source==="captain").forEach(b=>{const key=`${b.customer_name}|${b.company||""}`;const old=map.get(key)||{name:b.customer_name,company:b.company||"—",orders:0,passengers:0,last:b.created_at};old.orders++;old.passengers+=Number(b.passengers||0);if(new Date(b.created_at)>new Date(old.last))old.last=b.created_at;map.set(key,old)});
    return Array.from(map.values()).sort((a,b)=>b.orders-a.orders);
  },[bookings]);
  const companyReport=useMemo(()=>{
    const map=new Map<string,{name:string;orders:number;passengers:number;captains:Set<string>}>();
    bookings.filter(b=>b.source==="captain"&&b.company).forEach(b=>{const name=b.company!;const old=map.get(name)||{name,orders:0,passengers:0,captains:new Set<string>()};old.orders++;old.passengers+=Number(b.passengers||0);old.captains.add(b.customer_name);map.set(name,old)});
    return Array.from(map.values()).sort((a,b)=>b.orders-a.orders);
  },[bookings]);

  function exportCSV(){
    const rows=[["reference","type","name","company","lounge","phone","passengers","bags","carts","status","created_at"],...filtered.map(b=>[b.reference,b.source==="captain"?"captain":"customer",b.customer_name,b.company||"",b.lounge||"",b.phone,String(b.passengers),String(b.bags),String(b.carts||0),b.status,b.created_at])];
    const csv="\uFEFF"+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`lounge-orders-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }

  if(!token)return <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,#1f5670_0%,#113f57_34%,#092a3c_100%)] px-5 py-12 text-white"><div className="mx-auto max-w-sm"><div className="mb-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#d8b06d] text-[#123f58]"><ShieldCheck className="size-8"/></div><p className="mt-5 text-[10px] tracking-[.2em] text-white/45">LOUNGE BAGHDAD CONTROL CENTER</p><h1 className="mt-2 text-2xl font-semibold">مركز إدارة لاونج بغداد</h1><p className="mt-2 text-sm text-white/60">الدخول مخصص للإدارة</p></div><form onSubmit={doLogin} className="rounded-[28px] bg-white p-5 text-slate-900 shadow-2xl"><label className="text-xs font-medium text-slate-500">اسم المستخدم</label><input value={login.username} onChange={e=>setLogin({...login,username:e.target.value})} dir="ltr" className="mt-2 h-14 w-full rounded-2xl border bg-[#f7f9fa] px-4 outline-none focus:border-[#2b7289]" placeholder="admin"/><label className="mt-4 block text-xs font-medium text-slate-500">كلمة المرور</label><input value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} dir="ltr" type="password" className="mt-2 h-14 w-full rounded-2xl border bg-[#f7f9fa] px-4 outline-none focus:border-[#2b7289]" placeholder="••••••"/>{message&&<p className="mt-3 text-center text-sm text-red-600">{message}</p>}<button disabled={loading} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#123f58] font-semibold text-white">{loading?<Loader2 className="size-5 animate-spin"/>:<ShieldCheck className="size-5"/>}دخول لوحة الإدارة</button></form></div></main>;

  return <main dir="rtl" className="min-h-screen bg-[#f3f6f7] pb-24 text-[#173448]">
    <header className="sticky top-0 z-20 bg-[#103e56] text-white shadow-sm"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><button onClick={logout} className="grid size-10 place-items-center rounded-full bg-white/10"><LogOut className="size-5"/></button><div className="text-right"><p className="text-[9px] tracking-[.18em] text-white/45">CONTROL CENTER</p><h1 className="mt-1 text-lg font-semibold">مركز إدارة لاونج بغداد</h1></div></div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5">
      {message&&<div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}
      <div className="flex items-center justify-between"><button onClick={()=>loadAll()} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm"><RefreshCw className={`size-4 ${loading?"animate-spin":""}`}/>تحديث</button><div><p className="text-xs text-slate-400">ملخص التشغيل</p><h2 className="mt-1 text-xl font-semibold">اليوم</h2></div></div>

      {tab==="dashboard"&&<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card icon={<TicketCheck/>} label="طلبات اليوم" value={overview?.stats.bookings_today||0}/><Card icon={<Clock3/>} label="طلبات جديدة" value={overview?.stats.new_bookings||0} accent/><Card icon={<UsersRound/>} label="المسافرون اليوم" value={overview?.stats.passengers_today||0}/><Card icon={<CircleDollarSign/>} label="قيمة حجوزات الزبائن" value={money(overview?.stats.revenue_today||0)} small/></div>
        <section className="rounded-[24px] border border-[#e0e8ec] bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><button onClick={()=>setTab("bookings")} className="flex items-center gap-1 text-xs text-[#2b7289]">عرض الكل<ChevronLeft className="size-4"/></button><div><p className="text-xs text-slate-400">آخر النشاطات</p><h3 className="mt-1 font-semibold">أحدث الطلبات</h3></div></div><div className="space-y-3">{(overview?.recent||[]).map(b=><BookingRow key={`${b.source}-${b.id}`} b={b} onStatus={changeStatus} onOpen={setSelected}/>) }{!overview?.recent?.length&&<Empty text="ماكو طلبات لحد الآن"/>}</div></section>
        <div className="grid gap-3 sm:grid-cols-3"><Quick title="الكباتن" value={`${overview?.captains.active||0} فعال من ${overview?.captains.total||0}`} icon={<UsersRound/>} onClick={()=>setTab("captains")}/><Quick title="التقارير" value={`${captainReport.length} كابتن عنده نشاط`} icon={<BarChart3/>} onClick={()=>setTab("reports")}/><Quick title="الخصومات" value={`${overview?.promos.active||0} رمز فعال`} icon={<BadgePercent/>} onClick={()=>setTab("promos")}/></div>
      </>}

      {tab==="bookings"&&<section>
        <SectionTitle title="إدارة الطلبات" sub={`${filtered.length} ظاهر من ${bookings.length} — ${newCount} جديد`}/>
        <div className="mb-3 flex gap-2"><div className="relative flex-1"><Search className="absolute right-3 top-3.5 size-4 text-slate-400"/><input value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder="ابحث برقم الطلب، الاسم، الهاتف، الشركة..." className="h-11 w-full rounded-xl border border-[#dfe7ea] bg-white pr-10 pl-3 text-sm outline-none focus:border-[#2b7289]"/></div><button onClick={()=>setShowFilters(!showFilters)} className={`grid size-11 place-items-center rounded-xl border ${showFilters?"border-[#2b7289] bg-[#eaf2f5] text-[#2b7289]":"border-[#dfe7ea] bg-white text-slate-500"}`}><Filter className="size-4"/></button><button onClick={exportCSV} className="grid size-11 place-items-center rounded-xl border border-[#dfe7ea] bg-white text-slate-500"><Download className="size-4"/></button></div>
        {showFilters&&<div className="mb-4 grid gap-2 rounded-[20px] border border-[#e0e8ec] bg-white p-3 sm:grid-cols-4"><Select value={filters.status} onChange={v=>setFilters({...filters,status:v})} options={[["all","كل الحالات"],...Object.entries(statusMap).map(([k,v])=>[k,v.label])]}/><Select value={filters.source} onChange={v=>setFilters({...filters,source:v})} options={[["all","كل المصادر"],["captain","طلبات الكباتن"],["customer","حجوزات الزبائن"]]}/><Select value={filters.company} onChange={v=>setFilters({...filters,company:v})} options={[["all","كل الشركات"],...companies.map(x=>[x,x])]}/><Select value={filters.lounge} onChange={v=>setFilters({...filters,lounge:v})} options={[["all","كل الصالات"],...lounges.map(x=>[x,x])]}/><button onClick={()=>setFilters(initialFilters)} className="sm:col-span-4 h-10 rounded-xl bg-[#f4f7f8] text-xs text-slate-500">مسح كل الفلاتر</button></div>}
        <div className="space-y-3">{filtered.map(b=><BookingRow key={`${b.source}-${b.id}`} b={b} onStatus={changeStatus} onOpen={setSelected}/>) }{!filtered.length&&<Empty text="ماكو نتائج تطابق البحث أو الفلاتر"/>}</div>
      </section>}

      {tab==="reports"&&<section><SectionTitle title="تقارير التشغيل" sub="ملخص تلقائي من طلبات الكباتن المحفوظة"/>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Card icon={<BriefcaseBusiness/>} label="شركات عندها نشاط" value={companyReport.length}/><Card icon={<UsersRound/>} label="كباتن عندهم نشاط" value={captainReport.length}/><Card icon={<TicketCheck/>} label="طلبات الكباتن" value={bookings.filter(b=>b.source==="captain").length}/><Card icon={<UsersRound/>} label="مسافرين عبر الكباتن" value={bookings.filter(b=>b.source==="captain").reduce((s,b)=>s+Number(b.passengers||0),0)}/></div>
        <div className="grid gap-4 lg:grid-cols-2"><ReportTable title="أكثر الكباتن نشاطاً" rows={captainReport.slice(0,10).map((r,i)=>({name:r.name,sub:r.company,value:`${r.orders} طلب · ${r.passengers} مسافر`,rank:i+1}))}/><ReportTable title="أكثر الشركات نشاطاً" rows={companyReport.slice(0,10).map((r,i)=>({name:r.name,sub:`${r.captains.size} كابتن`,value:`${r.orders} طلب · ${r.passengers} مسافر`,rank:i+1}))}/></div>
      </section>}

      {tab==="captains"&&<section><SectionTitle title="الكباتن" sub={`${overview?.captains.active||0} حساب فعال`}/><a href="/captain/admin" className="mb-4 flex items-center justify-between rounded-[22px] bg-[#123f58] p-4 text-white"><ChevronLeft/><div className="text-right"><div className="font-semibold">إدارة حسابات الكباتن</div><div className="mt-1 text-xs text-white/60">إنشاء، تعديل، إيقاف وحذف الحسابات</div></div></a><InfoGrid items={[["إجمالي الكباتن",overview?.captains.total||0],["الحسابات الفعالة",overview?.captains.active||0],["كباتن عندهم طلبات",captainReport.length]]}/></section>}

      {tab==="companies"&&<section><SectionTitle title="الشركات" sub="مجمعة تلقائياً من الحسابات والطلبات والخصومات"/><div className="grid gap-3 sm:grid-cols-2">{(overview?.companies||[]).map(c=>{const report=companyReport.find(x=>x.name===c.name);return <article key={c.name} className="rounded-[22px] border border-[#e0e8ec] bg-white p-4"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-[#edf4f6] text-[#2b7289]"><Building2 className="size-5"/></span><div className="text-right"><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-xs text-slate-400">شركة شريكة</p></div></div><div className="mt-4 grid grid-cols-4 gap-2"><Mini label="الكباتن" value={c.captains}/><Mini label="الطلبات" value={report?.orders||0}/><Mini label="المسافرون" value={report?.passengers||0}/><Mini label="البرومو" value={c.promos}/></div></article>})}{!overview?.companies?.length&&<Empty text="ماكو شركات مضافة حالياً"/>}</div></section>}

      {tab==="promos"&&<section><SectionTitle title="خصومات الشركات" sub={`${overview?.promos.uses||0} استخدام مسجل`}/><a href="/prmos" className="mb-4 flex items-center justify-between rounded-[22px] bg-[#123f58] p-4 text-white"><ChevronLeft/><div className="text-right"><div className="font-semibold">إدارة رموز الخصم</div><div className="mt-1 text-xs text-white/60">إنشاء وتعديل وتفعيل ومتابعة الرموز</div></div></a><InfoGrid items={[["إجمالي الرموز",overview?.promos.total||0],["الرموز الفعالة",overview?.promos.active||0],["مرات الاستخدام",overview?.promos.uses||0]]}/></section>}
    </div>

    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto grid max-w-2xl grid-cols-6"><Nav active={tab==="dashboard"} icon={<LayoutDashboard/>} label="الرئيسية" onClick={()=>setTab("dashboard")}/><Nav active={tab==="bookings"} icon={<TicketCheck/>} label="الطلبات" badge={newCount} onClick={()=>setTab("bookings")}/><Nav active={tab==="reports"} icon={<BarChart3/>} label="التقارير" onClick={()=>setTab("reports")}/><Nav active={tab==="captains"} icon={<UsersRound/>} label="الكباتن" onClick={()=>setTab("captains")}/><Nav active={tab==="companies"} icon={<Building2/>} label="الشركات" onClick={()=>setTab("companies")}/><Nav active={tab==="promos"} icon={<BadgePercent/>} label="الخصومات" onClick={()=>setTab("promos")}/></div></nav>

    {selected&&<DetailsModal b={selected} onClose={()=>setSelected(null)} onStatus={changeStatus}/>} 
  </main>
}

function Card({icon,label,value,accent=false,small=false}:{icon:React.ReactNode;label:string;value:string|number;accent?:boolean;small?:boolean}){return <div className={`rounded-[22px] border p-4 ${accent?"border-[#d8b06d]/50 bg-[#fffaf0]":"border-[#e0e8ec] bg-white"}`}><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-xl ${accent?"bg-[#d8b06d]/20 text-[#9b6b20]":"bg-[#edf4f6] text-[#2b7289]"}`}>{icon}</span><span className={`font-semibold ${small?"text-base":"text-2xl"}`}>{value}</span></div><p className="mt-3 text-[11px] text-slate-400">{label}</p></div>}
function BookingRow({b,onStatus,onOpen}:{b:Booking;onStatus:(id:number,status:string)=>void;onOpen:(b:Booking)=>void}){const s=statusMap[b.status]||statusMap.new;const captain=b.source==="captain";return <article className={`rounded-[20px] border bg-white p-4 ${captain?"border-[#b9d8e1]":"border-[#e2e9ec]"}`}><div className="flex items-start justify-between gap-3"><div className="flex gap-2"><button onClick={()=>onOpen(b)} className="grid size-9 place-items-center rounded-xl bg-[#edf4f6] text-[#2b7289]"><Eye className="size-4"/></button><span className={`h-fit rounded-full px-2.5 py-1 text-[10px] font-medium ${s.className}`}>{s.label}</span></div><div className="min-w-0 text-right">{captain&&<span className="mb-1 inline-flex rounded-full bg-[#e7f2f5] px-2 py-1 text-[9px] font-semibold text-[#2b7289]">طلب كابتن</span>}<div className="flex items-center justify-end gap-2"><span className="font-[var(--font-latin)] text-xs text-slate-400">{b.reference}</span><h4 className="truncate font-semibold">{b.customer_name}</h4></div><p className="mt-1 text-xs text-slate-400">{captain?`${b.company||"بدون شركة"} · ${b.lounge||"صالة غير محددة"}`:`${b.flight_number||"بدون رقم رحلة"} · ${b.trip_type==="departure"?"مغادرة":"استقبال"}`}</p></div></div><div className={`mt-3 grid ${captain?"grid-cols-4":"grid-cols-3"} gap-2`}><Mini label="المسافرون" value={b.passengers}/>{captain?<><Mini label="الحقائب" value={b.bags}/><Mini label="العربات" value={b.carts||0}/><Mini label="المسافر" value={b.phone.slice(-4)}/></>:<><Mini label="الموعد" value={String(b.booking_date).slice(5,10)}/><Mini label="الحساب" value={money(b.total_iqd)}/></>}</div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{Object.entries(statusMap).map(([key,v])=><button key={key} onClick={()=>onStatus(b.id,key)} disabled={b.status===key} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] ${b.status===key?"bg-[#123f58] text-white":"bg-[#f2f6f7] text-slate-500"}`}>{v.label}</button>)}</div></article>}
function DetailsModal({b,onClose,onStatus}:{b:Booking;onClose:()=>void;onStatus:(id:number,status:string)=>void}){const captain=b.source==="captain";return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}><div onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]"><div className="flex items-start justify-between"><button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-[#f3f6f7]"><X className="size-4"/></button><div className="text-right">{captain&&<span className="inline-flex rounded-full bg-[#e7f2f5] px-2.5 py-1 text-[10px] font-semibold text-[#2b7289]">طلب كابتن</span>}<h2 className="mt-2 text-xl font-semibold">{b.customer_name}</h2><p className="mt-1 font-[var(--font-latin)] text-xs text-slate-400">{b.reference}</p></div></div><div className="mt-5 grid grid-cols-2 gap-2"><Detail icon={<Phone/>} label={captain?"رقم المسافر":"الهاتف"} value={b.phone}/><Detail icon={<UsersRound/>} label="المسافرون" value={String(b.passengers)}/><Detail icon={<Luggage/>} label="الحقائب" value={String(b.bags)}/><Detail icon={<CalendarDays/>} label="وقت الإنشاء" value={dateTime(b.created_at)}/>{captain&&<><Detail icon={<BriefcaseBusiness/>} label="الشركة" value={b.company||"غير مضافة"}/><Detail icon={<MapPin/>} label="الصالة" value={b.lounge||"غير محددة"}/><Detail icon={<Armchair/>} label="العربات" value={String(b.carts||0)}/></>}{!captain&&<><Detail icon={<TicketCheck/>} label="رقم الرحلة" value={b.flight_number||"—"}/><Detail icon={<CircleDollarSign/>} label="الإجمالي" value={money(b.total_iqd)}/><Detail icon={<BadgePercent/>} label="رمز الخصم" value={b.promo_code||"بدون"}/></>}</div><div className="mt-5"><p className="mb-2 text-xs font-medium text-slate-500">حالة الطلب</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(statusMap).map(([key,v])=><button key={key} onClick={()=>onStatus(b.id,key)} className={`rounded-xl px-3 py-3 text-[10px] font-medium ${b.status===key?"bg-[#123f58] text-white":v.className}`}>{v.label}</button>)}</div></div></div></div>}
function Detail({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-2xl bg-[#f7f9fa] p-3"><div className="flex items-center justify-end gap-2 text-slate-400"><span className="text-[10px]">{label}</span><span className="[&>svg]:size-3.5">{icon}</span></div><div className="mt-2 break-words text-right text-sm font-semibold text-[#153f57]">{value}</div></div>}
function ReportTable({title,rows}:{title:string;rows:{name:string;sub:string;value:string;rank:number}[]}){return <div className="rounded-[22px] border border-[#e0e8ec] bg-white p-4"><h3 className="mb-3 font-semibold">{title}</h3><div className="space-y-2">{rows.map(r=><div key={`${r.name}-${r.rank}`} className="flex items-center justify-between rounded-xl bg-[#f7f9fa] p-3"><span className="grid size-8 place-items-center rounded-xl bg-white text-xs font-semibold text-[#2b7289]">{r.rank}</span><div className="min-w-0 flex-1 px-3 text-right"><div className="truncate text-sm font-semibold">{r.name}</div><div className="mt-1 text-[10px] text-slate-400">{r.sub}</div></div><div className="text-left text-[10px] font-medium text-[#153f57]">{r.value}</div></div>)}{!rows.length&&<Empty text="ماكو بيانات كافية للتقرير"/>}</div></div>}
function Select({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:string[][]}){return <select value={value} onChange={e=>onChange(e.target.value)} className="h-11 rounded-xl border border-[#dfe7ea] bg-[#fafcfc] px-3 text-xs outline-none focus:border-[#2b7289]">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>}
function Quick({title,value,icon,onClick}:{title:string;value:string;icon:React.ReactNode;onClick:()=>void}){return <button onClick={onClick} className="flex items-center justify-between rounded-[20px] border border-[#e0e8ec] bg-white p-4 text-right"><ChevronLeft className="size-4 text-slate-300"/><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf4f6] text-[#2b7289]">{icon}</span><div><div className="font-semibold">{title}</div><div className="mt-1 text-xs text-slate-400">{value}</div></div></div></button>}
function Nav({active,icon,label,onClick,badge=0}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void;badge?:number}){return <button onClick={onClick} className={`relative flex flex-col items-center gap-1 py-1 text-[8px] sm:text-[9px] ${active?"text-[#123f58]":"text-slate-400"}`}><span className={`grid size-8 place-items-center rounded-xl ${active?"bg-[#eaf2f5]":""}`}>{icon}</span>{label}{badge>0&&<span className="absolute right-[18%] top-0 min-w-4 rounded-full bg-red-500 px-1 text-[8px] leading-4 text-white">{badge}</span>}</button>}
function Mini({label,value}:{label:string;value:string|number}){return <div className="rounded-xl bg-[#f7f9fa] px-2 py-2 text-center"><div className="truncate text-xs font-semibold text-[#153f57]">{value}</div><div className="mt-1 text-[9px] text-slate-400">{label}</div></div>}
function SectionTitle({title,sub}:{title:string;sub:string}){return <div className="mb-4"><p className="text-xs text-slate-400">{sub}</p><h2 className="mt-1 text-xl font-semibold">{title}</h2></div>}
function Empty({text}:{text:string}){return <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">{text}</div>}
function InfoGrid({items}:{items:[string,string|number][]}){return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(([l,v])=><div key={l} className="rounded-[20px] border border-[#e0e8ec] bg-white p-4 text-center"><div className="text-2xl font-semibold text-[#153f57]">{v}</div><div className="mt-1 text-[10px] text-slate-400">{l}</div></div>)}</div>}
