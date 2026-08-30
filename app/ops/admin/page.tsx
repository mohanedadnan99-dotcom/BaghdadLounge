"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee={id:number;name:string;username:string;role:string;assignedShift:string;loungeName:string;permissions:string[];active:boolean};
type Activity={id:number;reference:string;passenger_name:string;airline:string;flight_number:string;payment_type:string;billing_company:string;amount_iqd:number|string;employee_name:string;shift_name:string;created_at:string};
type Summary={passengers:number;cash:number;electronic:number;credit:number;complimentary:number;cash_iqd:number|string;activeEmployees:number};
type LoungeStatus={loungeName:string;currentSupervisor:string;username:string;role:string;shiftName:string;openedAt:string;passengers:number;cash:number;electronic:number;credit:number;complimentary:number;totalIqd:number|string;cashIqd:number|string;activeEmployees:number};

const roleLabels:Record<string,string>={owner:"مالك",manager:"مدير",reception:"موظف استقبال",supervisor:"مسؤول شفت",accountant:"محاسب"};
const paymentLabels:Record<string,string>={cash:"نقدي",electronic:"إلكتروني",credit:"آجل / شركة",complimentary:"مجاني",prepaid:"مدفوع مسبقاً",voucher:"Voucher"};
const loungeNames=["لاونج بغداد","عراق لاونج"];

export default function OpsAdminPage(){
  const [view,setView]=useState<"dashboard"|"employees">("dashboard");
  const [summary,setSummary]=useState<Summary>({passengers:0,cash:0,electronic:0,credit:0,complimentary:0,cash_iqd:0,activeEmployees:0});
  const [activity,setActivity]=useState<Activity[]>([]);
  const [lounges,setLounges]=useState<LoungeStatus[]>([]);
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [employeeFilter,setEmployeeFilter]=useState("الكل");
  const [form,setForm]=useState({name:"",username:"",password:"",role:"reception",assignedShift:"الصباحي",loungeName:"لاونج بغداد"});

  const loadDashboard=useCallback(async()=>{
    const res=await fetch("/api/ops/admin",{cache:"no-store"});
    if(!res.ok){setMessage(res.status===403?"صلاحية المالك مطلوبة":"تعذر تحميل الداشبورد");setLoading(false);return}
    const data=await res.json();
    setSummary(data.summary||{});
    setActivity(data.activity||[]);
    setLounges(data.lounges||[]);
    setLoading(false);
  },[]);

  const loadEmployees=useCallback(async()=>{
    const res=await fetch("/api/ops/admin?action=employees",{cache:"no-store"});
    if(!res.ok)return;
    const data=await res.json();
    setEmployees(data.employees||[]);
  },[]);

  useEffect(()=>{loadDashboard();loadEmployees();const timer=setInterval(loadDashboard,5000);return()=>clearInterval(timer)},[loadDashboard,loadEmployees]);

  async function addEmployee(e:React.FormEvent){
    e.preventDefault();setMessage("");
    const res=await fetch("/api/ops/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const data=await res.json();
    if(!res.ok){setMessage(data.message||"تعذر إضافة الموظف");return}
    setForm({name:"",username:"",password:"",role:"reception",assignedShift:"الصباحي",loungeName:"لاونج بغداد"});
    setMessage("تمت إضافة الموظف بنجاح");
    await loadEmployees();await loadDashboard();
  }

  async function patchEmployee(employee:Employee,patch:Record<string,unknown>){
    const res=await fetch("/api/ops/admin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:employee.id,...patch})});
    const data=await res.json();
    if(!res.ok){setMessage(data.message||"تعذر حفظ الموظف");return}
    setMessage("تم حفظ التعديل");
    await loadEmployees();await loadDashboard();
  }

  const filteredEmployees=useMemo(()=>employeeFilter==="الكل"?employees:employees.filter(e=>e.loungeName===employeeFilter),[employees,employeeFilter]);

  return <main dir="rtl" style={{minHeight:"100vh",background:"linear-gradient(180deg,#06101d 0%,#081526 100%)",color:"#f8fafc",padding:16,fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:1380,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:22,padding:"8px 2px"}}>
        <div>
          <div style={{color:"#c8a66a",fontWeight:900,letterSpacing:.5,fontSize:13}}>BAGHDAD LOUNGE OPERATIONS SYSTEM</div>
          <h1 style={{margin:"7px 0 5px",fontSize:"clamp(25px,4vw,34px)"}}>لوحة قيادة الصالات</h1>
          <div style={{color:"#94a3b8"}}>متابعة لاونج بغداد وعراق لاونج على مدار 24 ساعة</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={button(view==="dashboard")} onClick={()=>setView("dashboard")}>الداشبورد</button>
          <button style={button(view==="employees")} onClick={()=>setView("employees")}>الموظفين والصلاحيات</button>
          <a href="/ops" style={{...button(false),textDecoration:"none"}}>واجهة الموظف</a>
        </div>
      </header>

      {message&&<div style={{...card,marginBottom:14,borderColor:"#8a6f3e",background:"#151d29"}}>{message}</div>}

      {view==="dashboard"?<>
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:16,marginBottom:18}}>
          {loungeNames.map(name=>{
            const status=lounges.find(x=>x.loungeName===name);
            const isOpen=Boolean(status?.shiftName);
            return <div key={name} style={{...card,padding:0,overflow:"hidden",borderColor:isOpen?"#2f6048":"#334155"}}>
              <div style={{padding:"18px 18px 16px",background:"linear-gradient(135deg,rgba(200,166,106,.12),rgba(13,24,41,.25))",borderBottom:"1px solid #1f2d42"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
                  <div><div style={{color:"#c8a66a",fontWeight:900,fontSize:20}}>{name}</div><div style={{color:"#94a3b8",fontSize:13,marginTop:4}}>الحالة التشغيلية الحالية</div></div>
                  <span style={{border:`1px solid ${isOpen?"#3f7d5e":"#475569"}`,background:isOpen?"rgba(34,197,94,.1)":"rgba(148,163,184,.08)",color:isOpen?"#86efac":"#cbd5e1",borderRadius:999,padding:"7px 10px",fontSize:12,fontWeight:900}}>{isOpen?"الشفت مفتوح":"لا يوجد شفت"}</span>
                </div>
                <div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"end"}}>
                  <div><div style={eyebrow}>مسؤول الشفت الحالي</div><div style={{fontSize:24,fontWeight:950,marginTop:5}}>{status?.currentSupervisor||"لا يوجد شفت مفتوح"}</div><div style={{color:"#cbd5e1",fontSize:13,marginTop:6}}>{status?.shiftName?`${status.shiftName} · ${roleLabels[status.role]||status.role}`:"بانتظار تسجيل دخول مسؤول الشفت"}</div></div>
                  {status?.openedAt&&<div style={{textAlign:"left"}}><div style={eyebrow}>بدأ</div><div style={{fontWeight:900,marginTop:5}}>{new Date(status.openedAt).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}</div></div>}
                </div>
              </div>
              <div style={{padding:16}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  <MiniStat title="المسافرين" value={status?.passengers||0}/>
                  <MiniStat title="الموظفين" value={status?.activeEmployees||0}/>
                  <MiniStat title="المجموع" value={`${formatIqd(status?.totalIqd||0)}`}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:8}}>
                  <PaymentStat title="نقدي" value={status?.cash||0}/><PaymentStat title="إلكتروني" value={status?.electronic||0}/><PaymentStat title="آجل" value={status?.credit||0}/><PaymentStat title="مجاني" value={status?.complimentary||0}/>
                </div>
              </div>
            </div>
          })}
        </section>

        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:18}}>
          <Stat title="إجمالي المسافرين اليوم" value={summary.passengers}/><Stat title="نقدي" value={summary.cash}/><Stat title="إلكتروني" value={summary.electronic}/><Stat title="آجل / شركات" value={summary.credit}/><Stat title="مجاني" value={summary.complimentary}/><Stat title="الموظفين النشطين" value={summary.activeEmployees}/>
        </section>

        <section style={card}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:12}}><div><h2 style={{margin:0}}>الحركات المباشرة</h2><div style={{color:"#94a3b8",marginTop:5}}>تحديث تلقائي كل 5 ثواني</div></div><span style={{color:"#86efac",fontWeight:900,border:"1px solid #2f6048",padding:"6px 10px",borderRadius:999}}>LIVE</span></div>
          {loading?<div style={{color:"#94a3b8"}}>جاري التحميل...</div>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}><thead><tr>{["العملية","المسافر","شركة الطيران","الرحلة","الحساب","الجهة","الموظف","الشفت","الوقت"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{activity.length?activity.map(row=><tr key={row.id}><td style={td}>{row.reference}</td><td style={td}>{row.passenger_name}</td><td style={td}>{row.airline||"—"}</td><td style={td}>{row.flight_number||"—"}</td><td style={td}>{paymentLabels[row.payment_type]||row.payment_type}</td><td style={td}>{row.billing_company||"—"}</td><td style={td}>{row.employee_name}</td><td style={td}>{row.shift_name}</td><td style={td}>{new Date(row.created_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}</td></tr>):<tr><td colSpan={9} style={{...td,textAlign:"center",color:"#94a3b8"}}>ماكو عمليات دخول مسجلة بعد</td></tr>}</tbody></table></div>}
        </section>
      </>:<>
        <section style={{display:"grid",gridTemplateColumns:"minmax(300px,420px) 1fr",gap:16,alignItems:"start"}}>
          <form onSubmit={addEmployee} style={{...card,position:"sticky",top:16}}>
            <div style={{marginBottom:16}}><div style={{color:"#c8a66a",fontWeight:900,fontSize:13}}>STAFF CONTROL</div><h2 style={{margin:"6px 0 4px"}}>إضافة موظف</h2><div style={{color:"#94a3b8",fontSize:13}}>حدد الصالة والشفت والصلاحية من البداية</div></div>
            <Field label="اسم الموظف"><input required style={input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
            <Field label="اسم المستخدم"><input required style={input} autoCapitalize="none" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></Field>
            <Field label="كلمة المرور"><input required minLength={6} type="password" style={input} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="الصالة"><select style={input} value={form.loungeName} onChange={e=>setForm({...form,loungeName:e.target.value})}><option>لاونج بغداد</option><option>عراق لاونج</option></select></Field>
              <Field label="الشفت"><select style={input} value={form.assignedShift} onChange={e=>setForm({...form,assignedShift:e.target.value})}><option>الصباحي</option><option>المسائي</option><option>الليلي</option></select></Field>
            </div>
            <Field label="الصلاحية"><select style={input} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="reception">موظف استقبال</option><option value="supervisor">مسؤول شفت</option><option value="accountant">محاسب</option><option value="manager">مدير</option><option value="owner">مالك</option></select></Field>
            <button style={{...button(true),width:"100%",padding:"13px 14px"}}>إضافة الموظف</button>
          </form>

          <section style={card}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}><div><h2 style={{margin:0}}>الموظفين والصلاحيات</h2><div style={{color:"#94a3b8",marginTop:5,fontSize:13}}>إدارة التوزيع على الصالات والشفتات</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["الكل",...loungeNames].map(name=><button type="button" key={name} onClick={()=>setEmployeeFilter(name)} style={button(employeeFilter===name)}>{name}</button>)}</div></div>
            <div style={{display:"grid",gap:12}}>{filteredEmployees.length?filteredEmployees.map(employee=><div key={employee.id} style={{border:"1px solid #253247",background:"#0a1422",borderRadius:16,padding:15,display:"grid",gap:12}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}><div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><div style={{fontWeight:950,fontSize:18}}>{employee.name}</div><span style={{fontSize:11,border:"1px solid #3b475a",borderRadius:999,padding:"4px 7px",color:"#cbd5e1"}}>{roleLabels[employee.role]||employee.role}</span></div><div style={{color:"#94a3b8",marginTop:5}}>@{employee.username} · {employee.loungeName}</div></div><button type="button" onClick={()=>patchEmployee(employee,{active:!employee.active})} style={button(employee.active)}>{employee.active?"نشط":"موقوف"}</button></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:8}}>
                <label style={{display:"grid",gap:5}}><span style={smallLabel}>الصالة</span><select style={smallInput} value={employee.loungeName||"لاونج بغداد"} onChange={e=>patchEmployee(employee,{loungeName:e.target.value})}><option>لاونج بغداد</option><option>عراق لاونج</option></select></label>
                <label style={{display:"grid",gap:5}}><span style={smallLabel}>الشفت</span><select style={smallInput} value={employee.assignedShift} onChange={e=>patchEmployee(employee,{assignedShift:e.target.value})}><option>الصباحي</option><option>المسائي</option><option>الليلي</option></select></label>
                <label style={{display:"grid",gap:5}}><span style={smallLabel}>الصلاحية</span><select style={smallInput} value={employee.role} onChange={e=>patchEmployee(employee,{role:e.target.value})}><option value="reception">موظف استقبال</option><option value="supervisor">مسؤول شفت</option><option value="accountant">محاسب</option><option value="manager">مدير</option><option value="owner">مالك</option></select></label>
              </div>
            </div>):<div style={{color:"#94a3b8",padding:16,textAlign:"center"}}>ماكو موظفين ضمن هذا الفلتر</div>}</div>
          </section>
        </section>
        <style>{`@media(max-width:860px){section[style*="420px"]{grid-template-columns:1fr!important}form[style*="sticky"]{position:static!important}}`}</style>
      </>}
    </div>
  </main>
}

function formatIqd(value:number|string){const n=Number(value||0);return `${new Intl.NumberFormat("ar-IQ").format(n)} د.ع`}
function Stat({title,value}:{title:string;value:number|string}){return <div style={card}><div style={eyebrow}>{title}</div><div style={{fontSize:27,fontWeight:950,marginTop:7}}>{String(value)}</div></div>}
function MiniStat({title,value}:{title:string;value:number|string}){return <div style={{background:"#091321",border:"1px solid #1c2a3d",borderRadius:12,padding:10,minWidth:0}}><div style={{color:"#8291a6",fontSize:11}}>{title}</div><div style={{fontWeight:950,marginTop:5,fontSize:14,overflow:"hidden",textOverflow:"ellipsis"}}>{String(value)}</div></div>}
function PaymentStat({title,value}:{title:string;value:number|string}){return <div style={{textAlign:"center",borderTop:"1px solid #1c2a3d",paddingTop:9}}><div style={{color:"#8291a6",fontSize:11}}>{title}</div><div style={{fontWeight:900,marginTop:4}}>{String(value)}</div></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label style={{display:"grid",gap:7,marginBottom:12}}><span style={{color:"#cbd5e1",fontSize:14}}>{label}</span>{children}</label>}
const card:React.CSSProperties={background:"#0d1829",border:"1px solid #1f2d42",borderRadius:18,padding:17,boxShadow:"0 12px 35px rgba(0,0,0,.12)"};
const eyebrow:React.CSSProperties={color:"#94a3b8",fontSize:12,fontWeight:700};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",background:"#07111f",color:"#f8fafc",border:"1px solid #334155",borderRadius:11,padding:"12px 13px",fontSize:16,outline:"none"};
const smallInput:React.CSSProperties={...input,padding:"9px 10px",fontSize:14};
const smallLabel:React.CSSProperties={color:"#94a3b8",fontSize:12};
const th:React.CSSProperties={textAlign:"right",color:"#94a3b8",fontWeight:700,padding:"11px 9px",borderBottom:"1px solid #253247",whiteSpace:"nowrap"};
const td:React.CSSProperties={padding:"12px 9px",borderBottom:"1px solid #18263a",whiteSpace:"nowrap"};
function button(active:boolean):React.CSSProperties{return{display:"inline-block",border:active?"1px solid #c8a66a":"1px solid #334155",background:active?"#c8a66a":"#111d30",color:active?"#07111f":"#e2e8f0",borderRadius:10,padding:"10px 13px",fontWeight:900,cursor:"pointer"}}
