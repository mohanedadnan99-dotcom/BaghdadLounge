"use client";

import { useEffect, useState } from "react";

type User={employeeId?:number;id?:number;name:string;username:string;role:string;assignedShift:string};
type Shift={id:number;shift_name:string;opened_at:string}|null;
const paymentLabels=[
  ["cash","نقدي"],["electronic","دفع إلكتروني"],["credit","آجل / حساب شركة"],["prepaid","مدفوع مسبقاً"],["voucher","Voucher / قسيمة"],["complimentary","مجاني"]
];

export default function OpsStaffPage(){
  const [user,setUser]=useState<User|null>(null);
  const [shift,setShift]=useState<Shift>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [login,setLogin]=useState({username:"",password:""});
  const [entry,setEntry]=useState({passengerName:"",airline:"",flightNumber:"",origin:"",destination:"",seat:"",paymentType:"cash",billingCompany:"",amountIqd:"",boardingRaw:"",notes:""});

  async function refreshSession(){
    const res=await fetch("/api/ops/session",{cache:"no-store"});
    if(!res.ok){setUser(null);setShift(null);setLoading(false);return}
    const data=await res.json();setUser(data.user);setLoading(false);await refreshShift();
  }
  async function refreshShift(){const res=await fetch("/api/ops/shift",{cache:"no-store"});if(res.ok){const data=await res.json();setShift(data.shift||null)}}
  useEffect(()=>{refreshSession()},[]);

  async function doLogin(e:React.FormEvent){e.preventDefault();setMessage("");const res=await fetch("/api/ops/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(login)});const data=await res.json();if(!res.ok){setMessage(data.message||"فشل تسجيل الدخول");return}setUser(data.user);setLogin({username:"",password:""});setMessage("تم تسجيل الدخول");await refreshShift()}
  async function logout(){await fetch("/api/ops/session",{method:"DELETE"});setUser(null);setShift(null);setMessage("")}
  async function openShift(){setMessage("");const res=await fetch("/api/ops/shift",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});const data=await res.json();if(!res.ok){setMessage(data.message||"تعذر فتح الشفت");return}setShift(data.shift);setMessage("تم فتح الشفت")}
  async function closeShift(){if(!confirm("تأكيد إغلاق الشفت؟"))return;const res=await fetch("/api/ops/shift",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({note:""})});const data=await res.json();if(!res.ok){setMessage(data.message||"تعذر إغلاق الشفت");return}setShift(null);setMessage("تم إغلاق الشفت")}
  async function submitEntry(e:React.FormEvent){e.preventDefault();setMessage("");const res=await fetch("/api/ops/entries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...entry,amountIqd:Number(entry.amountIqd||0),entrySource:entry.boardingRaw.trim()?"scan":"manual"})});const data=await res.json();if(!res.ok){setMessage(data.message||"تعذر تسجيل المسافر");return}setMessage(`تم تسجيل المسافر — ${data.entry.reference}`);setEntry({passengerName:"",airline:"",flightNumber:"",origin:"",destination:"",seat:"",paymentType:"cash",billingCompany:"",amountIqd:"",boardingRaw:"",notes:""})}

  if(loading)return <Shell><div style={card}>جاري تحميل نظام الصالة...</div></Shell>;
  if(!user)return <Shell><div style={{maxWidth:430,margin:"40px auto"}}><form onSubmit={doLogin} style={card}><div style={{color:"#c8a66a",fontWeight:900}}>BAGHDAD LOUNGE</div><h1 style={{margin:"8px 0 4px",fontSize:27}}>تسجيل دخول الموظف</h1><p style={{color:"#94a3b8",marginTop:0}}>كل موظف يدخل بيوزره الخاص قبل فتح الشفت.</p>{message&&<Notice text={message}/>}<Field label="اسم المستخدم"><input required autoCapitalize="none" style={input} value={login.username} onChange={e=>setLogin({...login,username:e.target.value})}/></Field><Field label="كلمة المرور"><input required type="password" style={input} value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></Field><button style={{...button(true),width:"100%"}}>دخول</button></form></div></Shell>;

  return <Shell><div style={{maxWidth:980,margin:"0 auto"}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:16}}><div><div style={{color:"#c8a66a",fontWeight:900}}>BAGHDAD LOUNGE OPERATIONS</div><h1 style={{margin:"5px 0",fontSize:25}}>واجهة باب الصالة</h1><div style={{color:"#94a3b8"}}>{user.name} · {user.assignedShift}</div></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{user.role==="owner"||user.role==="manager"?<a href="/ops/admin" style={{...button(false),textDecoration:"none"}}>لوحة الإدارة</a>:null}<button type="button" onClick={logout} style={button(false)}>تسجيل خروج</button></div></header>
    {message&&<Notice text={message}/>} 
    <section style={{...card,marginBottom:16,display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap"}}><div><div style={{fontWeight:900,fontSize:18}}>الشفت</div>{shift?<div style={{color:"#86efac",marginTop:5}}>مفتوح — {shift.shift_name} — منذ {new Date(shift.opened_at).toLocaleTimeString("ar-IQ",{hour:"2-digit",minute:"2-digit"})}</div>:<div style={{color:"#fca5a5",marginTop:5}}>لا يوجد شفت مفتوح</div>}</div>{shift?<button type="button" onClick={closeShift} style={button(false)}>إغلاق الشفت</button>:<button type="button" onClick={openShift} style={button(true)}>فتح الشفت</button>}</section>

    <form onSubmit={submitEntry} style={{...card,opacity:shift?1:.55,pointerEvents:shift?"auto":"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:12}}><div><h2 style={{margin:0}}>تسجيل دخول مسافر</h2><div style={{color:"#94a3b8",marginTop:5}}>حالياً يدعم الإدخال اليدوي ونص قارئ الباركود؛ ربط الكاميرا/قارئ QR بالمرحلة التالية.</div></div><div style={{padding:"7px 10px",border:"1px solid #334155",borderRadius:10,color:"#cbd5e1"}}>SCAN / MANUAL</div></div>
      <Field label="نص الباركود / Boarding Pass Raw Data (اختياري)"><textarea rows={3} style={{...input,resize:"vertical"}} value={entry.boardingRaw} onChange={e=>setEntry({...entry,boardingRaw:e.target.value})} placeholder="عند استخدام قارئ USB/Bluetooth ينزل النص هنا"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
        <Field label="اسم المسافر"><input required style={input} value={entry.passengerName} onChange={e=>setEntry({...entry,passengerName:e.target.value})}/></Field>
        <Field label="شركة الطيران"><input style={input} value={entry.airline} onChange={e=>setEntry({...entry,airline:e.target.value})}/></Field>
        <Field label="رقم الرحلة"><input style={input} value={entry.flightNumber} onChange={e=>setEntry({...entry,flightNumber:e.target.value})}/></Field>
        <Field label="من"><input style={input} value={entry.origin} onChange={e=>setEntry({...entry,origin:e.target.value})}/></Field>
        <Field label="إلى"><input style={input} value={entry.destination} onChange={e=>setEntry({...entry,destination:e.target.value})}/></Field>
        <Field label="المقعد"><input style={input} value={entry.seat} onChange={e=>setEntry({...entry,seat:e.target.value})}/></Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
        <Field label="طريقة الحساب"><select style={input} value={entry.paymentType} onChange={e=>setEntry({...entry,paymentType:e.target.value})}>{paymentLabels.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
        {entry.paymentType==="credit"?<Field label="الجهة / الشركة المحاسبة"><input required style={input} value={entry.billingCompany} onChange={e=>setEntry({...entry,billingCompany:e.target.value})} placeholder="مثال: الخطوط الجوية العراقية"/></Field>:null}
        <Field label="المبلغ (د.ع)"><input inputMode="numeric" style={input} value={entry.amountIqd} onChange={e=>setEntry({...entry,amountIqd:e.target.value.replace(/\D/g,"")})}/></Field>
      </div>
      <Field label="ملاحظات"><input style={input} value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})}/></Field>
      <button style={{...button(true),width:"100%",fontSize:17,padding:"13px"}}>تأكيد دخول المسافر</button>
    </form>
  </div></Shell>
}

function Shell({children}:{children:React.ReactNode}){return <main dir="rtl" style={{minHeight:"100vh",background:"#07111f",color:"#f8fafc",padding:18,fontFamily:"Arial,sans-serif"}}>{children}</main>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label style={{display:"grid",gap:7,marginBottom:12}}><span style={{color:"#cbd5e1",fontSize:14,fontWeight:700}}>{label}</span>{children}</label>}
function Notice({text}:{text:string}){return <div style={{background:"#111d30",border:"1px solid #8a6f3e",borderRadius:12,padding:"11px 13px",marginBottom:13}}>{text}</div>}
const card:React.CSSProperties={background:"#0d1829",border:"1px solid #1f2d42",borderRadius:18,padding:17};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",background:"#07111f",color:"#f8fafc",border:"1px solid #334155",borderRadius:11,padding:"12px 13px",fontSize:16};
function button(active:boolean):React.CSSProperties{return{border:active?"1px solid #c8a66a":"1px solid #334155",background:active?"#c8a66a":"#111d30",color:active?"#07111f":"#e2e8f0",borderRadius:10,padding:"10px 13px",fontWeight:800,cursor:"pointer"}}
