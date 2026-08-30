"use client";
import { useEffect,useRef } from "react";
import { usePathname } from "next/navigation";

function fieldByLabel(text:string){
  const labels=Array.from(document.querySelectorAll("label"));
  return labels.find(l=>l.textContent?.includes(text))?.querySelector("input,select,textarea") as HTMLInputElement|HTMLSelectElement|null;
}
function setNative(el:HTMLInputElement|HTMLSelectElement|null,value:string){
  if(!el)return;
  const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
  setter?.call(el,value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement?"change":"input",{bubbles:true}));
}
export default function OpsPricingBridge(){
  const pathname=usePathname();const timer=useRef<number|null>(null);const lastCompany=useRef<string>("__init__");
  useEffect(()=>{
    if(pathname!=="/ops")return;
    async function apply(company=""){
      try{
        const r=await fetch(`/api/ops/pricing?action=resolve&company=${encodeURIComponent(company)}`,{cache:"no-store"});if(!r.ok)return;
        const d=await r.json();const p=d.pricing;if(!p)return;
        setNative(fieldByLabel("المبلغ"),String(p.priceIqd??40000));
        setNative(fieldByLabel("طريقة الحساب"),String(p.paymentType||"cash"));
        const amount=fieldByLabel("المبلغ");if(amount){amount.readOnly=!p.allowManualOverride;amount.title=p.source==="company"?`سعر ${p.companyName}`:"السعر العام";}
      }catch{}
    }
    const tick=()=>{
      const companyEl=fieldByLabel("الجهة / الشركة");const company=String(companyEl?.value||"").trim();
      if(company!==lastCompany.current){lastCompany.current=company;apply(company)}
      const amount=fieldByLabel("المبلغ");if(amount&&!amount.value)apply(company);
    };
    apply("");timer.current=window.setInterval(tick,500);
    return()=>{if(timer.current)window.clearInterval(timer.current)};
  },[pathname]);
  return null;
}
