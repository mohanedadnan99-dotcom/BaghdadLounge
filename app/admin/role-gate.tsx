"use client";
import { useEffect, useState } from "react";
import EnterpriseAdminV2 from "./enterprise-v2";

type Role="owner"|"manager"|"reception"|"accountant";
function readRole(token:string):Role|null{
  try{
    const raw=token.split(".")[0];if(!raw)return null;
    const base64=raw.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(raw.length/4)*4,"=");
    const data=JSON.parse(atob(base64)) as {role?:string};
    return ["owner","manager","reception","accountant"].includes(String(data.role))?data.role as Role:null;
  }catch{return null}
}
export default function AdminRoleGate(){
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let stopped=false;
    const route=()=>{
      const token=sessionStorage.getItem("mainAdminToken")||"";
      if(!token){if(!stopped)setReady(true);return}
      const role=readRole(token);
      if(role==="reception"){
        sessionStorage.setItem("receptionAdminToken",token);
        location.replace("/reception");return;
      }
      if(role==="accountant"){
        sessionStorage.setItem("accountingAdminToken",token);
        location.replace("/admin/accounting");return;
      }
      if(!stopped)setReady(true);
    };
    route();const timer=setInterval(route,300);
    return()=>{stopped=true;clearInterval(timer)};
  },[]);
  if(!ready)return <main className="grid min-h-screen place-items-center bg-[#071f2b] text-white"><div className="text-sm text-white/60">جاري فتح مساحة العمل المناسبة...</div></main>;
  return <EnterpriseAdminV2/>;
}
