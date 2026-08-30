"use client";

import { useCallback, useEffect, useState } from "react";

type Employee={id:number;name:string;username:string;role:string;assignedShift:string;permissions:string[];active:boolean};
type Activity={id:number;reference:string;passenger_name:string;airline:string;flight_number:string;payment_type:string;billing_company:string;amount_iqd:number|string;employee_name:string;shift_name:string;created_at:string};
type Summary={passengers:number;cash:number;electronic:number;credit:number;complimentary:number;cash_iqd:number|string;activeEmployees:number};

const roleLabels:Record<string,string>={owner:"مالك",manager:"مدير",reception:"موظف استقبال",supervisor:"مشرف شفت",accountant:"محاسب"};
const paymentLabels:Record<string,string>={cash:"نقدي",electronic:"إلكتروني",credit:"آجل / شركة",complimentary:"مجاني",prepaid:"مدفوع مسبقاً",voucher:"Voucher"};

export default function OpsAdminPage(){
  const [view,setView]=useState<"dashboard"|"employees">("dashboard");
  const [summary,setSummary]=useState<Summary>({passengers:0,cash:0,electronic:0,credit:0,complimentary:0,cash_iqd:0,activeEmployees:0});
  const [activity,setActivity]=useState<Activity[]>([]);
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [form,setForm]=useState({name:"",username:"",password:"",role:"reception",assignedShift:"الصباحي"});

  const loadDashboard=useCallback(async()=>{
    const res=await fetch("/api/ops/admin",{cache:"no-store"});
    if(!res.ok){setMessage(res.status===403?"سجّل دخولك من لوحة الإدارة بحساب المالك أولاً":"تعذر تحميل الداشبورد");setLoading(false);return}
    const data=await res.json();setSummary(data.summary||summary);setActivity(data.activity||[]);setLoading(false);
  },[]);
  const loadEmployees=useCallback(async()=>{
    const res=await fetch("/api/ops/admin?action=employees",{cache:"no-store"});if(!res.ok)return;const data=await res.json();setEmployees(data.employees||[]);
  },[]);
  useEffect(()=>{loadDashboard();loadEmployees();const timer=setInterval(loadDashboard,5000);return()=>clearInterval(timer)},[loadDashboard,loadEmployees]);

  async function addEmployee(e:React.FormEvent){
    e.preventDefault();setMessage("");
    const res=await fetch("/api/ops/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const data=await res.json();if(!res.ok){setMessage(data.message||"تعذر إضافة الموظف");return}setForm({name:"",username:"",password:"",role:"reception",assignedShift:"الصباحي"});setMessage("تمت إضافة الموظف");await loadEmployees();await loadDashboard();
  }
  async function toggleEmployee(employee:Employee){
    const res=await fetch("/api/ops/admin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:employee.id,active:!employee.active})});
    const data=await res.json();if(!res.ok){setMessage(data.message||"تعذر حفظ الموظف");return}await loadEmployees();await loadDashboard();
  }

  return <main dir="rtl" style={{minHeight:"100vh",background:"#07111f",color:"#f8fafc",padding:20,fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:1280,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",marginBottom:22}}>
        <div><div style={{color:"#c8a66a",fontWeight:800}}>BAGHDAD LOUNGE</div><h1 style={{margin:"6px 0",fontSize:28}}>Owner Operations Dashboard</h1><div style={{color:"#94a3b8"}}>متابعة مباشرة لنظام دخول الصالة والشفتات والموظفين</div></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={button(view==="dashboard")} onClick={()=>setView("dashboard")}>الداشبورد</button><button style={button(view==="employees")} onClick={()=>setView("employees")}>الموظفين والصلاحيات</button><a href="/ops" style={{...button(false),textDecoration:"none"}}>واجهة الموظف</a></div>
      </header>
      {message&&<div style={{...card,marginBottom:14,borderColor:"#8a6f3e"}}>{message}</div>}
      {view==="dashboard"?<>
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:12,marginBottom:18}}>
          <Stat title="المسافرين اليوم" value={summary.passengers}/><Stat title="نقدي" value={summary.cash}/><Stat title="إلكتروني" value={summary.electronic}/><Stat title="آجل / شركات" value={summary.credit}/><Stat title="مجاني" value={summary.complimentary}/><Stat title="الموظفين النشطين" value={summary.activeEmployees}/>
        </section>
        <section style={card}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:12}}><div><h2 style={{margin:0}}>الحركات المباشرة</h2><div style={{color:"#94a3b8",marginTop:5}}>تتحدث تلقائياً كل 5 ثواني</div></div><span style={{color:"#86efac",fontWeight:800}}>LIVE</span></div>
          {loading?<div style={{color:"#94a3b8"}}>جاري التحميل...</div>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}><thead><tr>{["العملية","المسافر","شركة الطيران","الرحلة","الحساب","الجهة","الموظف","الشفت","الوقت"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{activity.length?activity.map(row=><tr key={row.id}><td style={td}>{row.reference}</td><td style={td}>{row.passenger_name}</td><td style={td}>{row.airline||"—"}</td><td style={td}>{row.flight_number||"—"}</td><td style={td}>{paymentLabels[row.payment_type]||row.payment_type}</td><td style={td}>{row.billing_company||"—"}</td><td style={td}>{row.employee_name}</td><td style={td}>{row.shift_name}</td><td style={td}>{new Date(row.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}</td></tr>):<tr><td colSpan={9} style={{...td,textAlign:"center",color:"#94a3b8"}}>ماكو عمليات دخول مسجلة بعد</td></tr>}</tbody></table></div>}
        </section>
      </>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(310px,1fr))",gap:16}}>
        <form onSubmit={addEmployee} style={card}><h2 style={{marginTop:0}}>إضافة موظف شفت</h2><Field label="اسم الموظف"><input required style={input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="اسم المستخدم"><input required style={input} autoCapitalize="none" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></Field><Field label="كلمة المرور"><input required minLength={6} type="password" style={input} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field><Field label="الشفت"><select style={input} value={form.assignedShift} onChange={e=>setForm({...form,assignedShift:e.target.value})}><option>الصباحي</option><option>المسائي</option><option>الليلي</option></select></Field><Field label="الصلاحية"><select style={input} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="reception">موظف استقبال</option><option value="supervisor">مشرف شفت</option><option value="accountant">محاسب</option><option value="manager">مدير</option><option value="owner">مالك</option></select></Field><button style={{...button(true),width:"100%"}}>إضافة الموظف</button></form>
        <section style={card}><h2 style={{marginTop:0}}>الموظفين الحاليين</h2><div style={{display:"grid",gap:10}}>{employees.length?employees.map(employee=><div key={employee.id} style={{border:"1px solid #253247",borderRadius:14,padding:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><div style={{fontWeight:800}}>{employee.name}</div><div style={{color:"#94a3b8",marginTop:5}}>@{employee.username} · {employee.assignedShift} · {roleLabels[employee.role]||employee.role}</div></div><button type="button" onClick={()=>toggleEmployee(employee)} style={button(employee.active)}>{employee.active?"نشط":"موقوف"}</button></div>):<div style={{color:"#94a3b8"}}>ماكو موظفين مضافين بعد</div>}</div></section>
      </div>}
    </div>
  </main>
}

function Stat({title,value}:{title:string;value:number|string}){return <div style={card}><div style={{color:"#94a3b8",fontSize:14}}>{title}</div><div style={{fontSize:29,fontWeight:900,marginTop:7}}>{String(value)}</div></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label style={{display:"grid",gap:7,marginBottom:12}}><span style={{color:"#cbd5e1",fontSize:14}}>{label}</span>{children}</label>}
const card:React.CSSProperties={background:"#0d1829",border:"1px solid #1f2d42",borderRadius:18,padding:17};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",background:"#07111f",color:"#f8fafc",border:"1px solid #334155",borderRadius:11,padding:"12px 13px",fontSize:16};
const th:React.CSSProperties={textAlign:"right",color:"#94a3b8",fontWeight:700,padding:"11px 9px",borderBottom:"1px solid #253247",whiteSpace:"nowrap"};
const td:React.CSSProperties={padding:"12px 9px",borderBottom:"1px solid #18263a",whiteSpace:"nowrap"};
function button(active:boolean):React.CSSProperties{return{display:"inline-block",border:active?"1px solid #c8a66a":"1px solid #334155",background:active?"#c8a66a":"#111d30",color:active?"#07111f":"#e2e8f0",borderRadius:10,padding:"10px 13px",fontWeight:800,cursor:"pointer"}}
