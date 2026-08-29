"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { AlertTriangle,ArrowLeft,BarChart3,BrainCircuit,Building2,Clock3,Gauge,Plane,RefreshCcw,Target,TrendingDown,TrendingUp,Users } from "lucide-react";

type Data=any;
const iq=(v:any)=>Number(v||0).toLocaleString('en-US')+' د.ع';
const dayNames=['','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'];
function tone(s:string){return s==='critical'?'border-red-200 bg-red-50 text-red-900':s==='warning'?'border-amber-200 bg-amber-50 text-amber-900':s==='positive'?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-sky-200 bg-sky-50 text-sky-900'}
function Trend({value}:{value:number}){const up=value>=0;return <span className={`inline-flex items-center gap-1 text-xs font-bold ${up?'text-emerald-700':'text-red-700'}`}>{up?<TrendingUp className="size-3.5"/>:<TrendingDown className="size-3.5"/>}{Math.abs(value||0)}%</span>}

export default function IntelligencePage(){
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[err,setErr]=useState(''),[rev,setRev]=useState(''),[pax,setPax]=useState('');
 function getToken(){return typeof window!=='undefined'?(sessionStorage.getItem('mainAdminToken')||''):''}
 async function load(){const token=getToken();if(!token){location.replace('/admin');return}setLoading(true);setErr('');try{const r=await fetch('/api/admin/intelligence',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(r.status===401||r.status===403){sessionStorage.removeItem('mainAdminToken');location.replace('/admin');return}if(!r.ok)throw new Error(j.message||'تعذر التحميل');setData(j);setRev(String(j.targets?.revenueIqd||''));setPax(String(j.targets?.passengers||''))}catch(e:any){setErr(e.message||'تعذر التحميل')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function save(key:string,value:string){const token=getToken();if(!token){location.replace('/admin');return}const r=await fetch('/api/admin/intelligence',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({key,value:Number(value||0)})});const j=await r.json();if(r.status===401||r.status===403&&j.message==='غير مصرح'){sessionStorage.removeItem('mainAdminToken');location.replace('/admin');return}if(!r.ok){alert(j.message||'تعذر الحفظ');return}await load()}
 const topCompany=useMemo(()=>data?.companies?.[0], [data]);const topLounge=useMemo(()=>data?.lounges?.[0],[data]);
 return <main dir="rtl" className="min-h-screen bg-[#f3f0e9] text-[#142431]">
   <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-7">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] bg-[#0b2532] p-5 text-white shadow-xl">
      <div><div className="mb-2 flex items-center gap-2 text-[#e5bd79]"><BrainCircuit className="size-5"/><span className="text-sm font-bold">EXECUTIVE INTELLIGENCE</span></div><h1 className="text-2xl font-black md:text-3xl">مركز الذكاء الإداري والقرارات</h1><p className="mt-2 max-w-3xl text-sm text-white/70">تحليل مباشر للتشغيل والإيراد والنمو والمخاطر، مبني على بيانات الطلبات والشركات والفواتير.</p></div>
      <div className="flex gap-2"><button onClick={load} className="rounded-2xl bg-white/10 p-3 hover:bg-white/20"><RefreshCcw className="size-5"/></button><Link href="/admin" className="inline-flex items-center gap-2 rounded-2xl bg-[#e2b66f] px-4 py-3 font-bold text-[#102b38]">الرجوع للأدمن <ArrowLeft className="size-4"/></Link></div>
    </header>
    {err&&<div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{err}</div>}
    {loading&&!data?<div className="rounded-3xl bg-white p-10 text-center shadow-sm">جاري تحليل البيانات...</div>:data&&<>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <K icon={<Plane/>} title="طلبات اليوم" value={data.kpis.todayOrders} sub={`${data.kpis.todayPassengers} مسافر`}/>
        <K icon={<Users/>} title="مسافرو الشهر" value={data.kpis.monthPassengers} trend={data.kpis.passengersGrowthPercent}/>
        <K icon={<BarChart3/>} title="إيراد الشهر" value={iq(data.kpis.monthRevenueIqd)} trend={data.kpis.revenueGrowthPercent}/>
        <K icon={<Gauge/>} title="توقع نهاية الشهر" value={iq(data.forecast.revenueIqd)} sub={`${data.forecast.passengers} مسافر متوقع`}/>
        <K icon={<AlertTriangle/>} title="قرارات تحتاج انتباه" value={data.decisions.filter((x:any)=>x.severity==='critical'||x.severity==='warning').length} sub={`${data.decisions.length} قرار وتحليل`}/>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
       <div className="rounded-[28px] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><BrainCircuit className="size-5 text-[#b5792d]"/><h2 className="text-xl font-black">مركز القرارات</h2></div><div className="grid gap-3">{data.decisions.length?data.decisions.map((d:any,i:number)=><div key={i} className={`rounded-2xl border p-4 ${tone(d.severity)}`}><div className="font-black">{d.title}</div><div className="mt-1 text-sm opacity-80">{d.detail}</div><div className="mt-2 text-sm font-bold">الإجراء المقترح: {d.action}</div></div>):<div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">ماكو إنذارات مهمة حالياً.</div>}</div></div>
       <div className="space-y-5">
        <div className="rounded-[28px] bg-[#173b49] p-5 text-white shadow-sm"><div className="flex items-center gap-2 text-[#edc37e]"><Target className="size-5"/><h2 className="font-black">الأهداف الشهرية</h2></div><div className="mt-4 space-y-4"><TargetBox title="هدف الإيراد" value={data.targets.revenueIqd?iq(data.targets.revenueIqd):'غير محدد'} current={data.forecast.revenueTargetProgress} forecast={data.forecast.revenueForecastProgress}/><TargetBox title="هدف المسافرين" value={data.targets.passengers||'غير محدد'} current={data.forecast.passengerTargetProgress} forecast={data.forecast.passengerForecastProgress}/></div><div className="mt-5 grid gap-2"><input value={rev} onChange={e=>setRev(e.target.value)} inputMode="numeric" placeholder="هدف الإيراد بالدينار" className="rounded-xl bg-white/10 px-3 py-2 outline-none placeholder:text-white/40"/><button onClick={()=>save('monthly_revenue_target',rev)} className="rounded-xl bg-[#e2b66f] px-3 py-2 font-bold text-[#17303a]">حفظ هدف الإيراد</button><input value={pax} onChange={e=>setPax(e.target.value)} inputMode="numeric" placeholder="هدف عدد المسافرين" className="mt-2 rounded-xl bg-white/10 px-3 py-2 outline-none placeholder:text-white/40"/><button onClick={()=>save('monthly_passenger_target',pax)} className="rounded-xl bg-white px-3 py-2 font-bold text-[#17303a]">حفظ هدف المسافرين</button></div></div>
        <div className="rounded-[28px] bg-white p-5 shadow-sm"><h2 className="font-black">أقوى أداء حالياً</h2><div className="mt-4 space-y-3"><Mini icon={<Building2/>} title={topCompany?.company_name||'لا توجد بيانات شركات'} value={topCompany?`${topCompany.pax_now} مسافر — ${iq(topCompany.estimated_revenue)}`:''}/><Mini icon={<Plane/>} title={topLounge?.lounge_name||'لا توجد بيانات صالات'} value={topLounge?`${topLounge.pax_now} مسافر — ${topLounge.orders_now} طلب`:''}/></div></div>
       </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
       <div className="rounded-[28px] bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">أداء الشركات</h2><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-right text-slate-500"><th className="p-3">الشركة</th><th className="p-3">المسافرون</th><th className="p-3">الشهر السابق</th><th className="p-3">النمو</th><th className="p-3">إيراد تشغيلي تقديري</th></tr></thead><tbody>{data.companies.slice(0,12).map((c:any)=><tr key={c.company_name} className="border-b border-slate-100"><td className="p-3 font-bold">{c.company_name}</td><td className="p-3">{c.pax_now}</td><td className="p-3">{c.pax_prev}</td><td className="p-3"><Trend value={c.growth_percent}/></td><td className="p-3">{iq(c.estimated_revenue)}</td></tr>)}</tbody></table></div></div>
       <div className="rounded-[28px] bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">أداء الصالات</h2><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-sm"><thead><tr className="border-b text-right text-slate-500"><th className="p-3">الصالة</th><th className="p-3">الطلبات</th><th className="p-3">المسافرون</th><th className="p-3">السابق</th><th className="p-3">النمو</th></tr></thead><tbody>{data.lounges.slice(0,12).map((l:any)=><tr key={l.lounge_name} className="border-b border-slate-100"><td className="p-3 font-bold">{l.lounge_name}</td><td className="p-3">{l.orders_now}</td><td className="p-3">{l.pax_now}</td><td className="p-3">{l.pax_prev}</td><td className="p-3"><Trend value={l.growth_percent}/></td></tr>)}</tbody></table></div></div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
       <div className="rounded-[28px] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Clock3 className="size-5"/><h2 className="font-black">ساعات الضغط — آخر 90 يوم</h2></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{data.peakHours.map((h:any)=><div key={h.hour} className="rounded-2xl bg-[#edf3f4] p-4 text-center"><div className="text-lg font-black">{String(h.hour).padStart(2,'0')}:00</div><div className="text-xs text-slate-500">{h.orders} طلب</div></div>)}</div></div>
       <div className="rounded-[28px] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><BarChart3 className="size-5"/><h2 className="font-black">أيام الضغط — آخر 90 يوم</h2></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{data.peakWeekdays.map((d:any)=><div key={d.dow} className="rounded-2xl bg-[#f6efe3] p-4 text-center"><div className="font-black">{dayNames[d.dow]}</div><div className="text-xs text-slate-500">{d.orders} طلب</div></div>)}</div></div>
      </section>
    </>}
   </div>
 </main>
}
function K({icon,title,value,sub,trend}:{icon:any,title:string,value:any,sub?:string,trend?:number}){return <div className="rounded-[24px] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#eef2ef] text-[#31524f]">{icon}</span>{typeof trend==='number'&&<Trend value={trend}/>}</div><div className="text-sm text-slate-500">{title}</div><div className="mt-1 text-2xl font-black">{value}</div>{sub&&<div className="mt-1 text-xs text-slate-500">{sub}</div>}</div>}
function TargetBox({title,value,current,forecast}:{title:string,value:any,current:any,forecast:any}){return <div className="rounded-2xl bg-white/8 p-4"><div className="text-sm text-white/60">{title}</div><div className="mt-1 font-black">{value}</div><div className="mt-2 flex justify-between text-xs"><span>المنجز {current==null?'—':current+'%'}</span><span>المتوقع {forecast==null?'—':forecast+'%'}</span></div></div>}
function Mini({icon,title,value}:{icon:any,title:string,value:string}){return <div className="flex items-center gap-3 rounded-2xl bg-[#f5f2eb] p-4"><div className="grid size-10 place-items-center rounded-xl bg-white">{icon}</div><div><div className="font-black">{title}</div><div className="text-xs text-slate-500">{value}</div></div></div>}
