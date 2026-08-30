"use client";
import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";

declare global{interface Window{ZXingBrowser?:any}}

function setNative(el:HTMLInputElement|HTMLTextAreaElement|null,value:string){
  if(!el)return;
  const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,"value")?.set?.call(el,value);
  el.dispatchEvent(new Event("input",{bubbles:true}));
  el.dispatchEvent(new Event("change",{bubbles:true}));
}
function rawField(){
  const labels=Array.from(document.querySelectorAll("label"));
  return labels.find(l=>l.textContent?.includes("نص الباركود"))?.querySelector("textarea") as HTMLTextAreaElement|null;
}
async function loadZxing(){
  if(window.ZXingBrowser)return window.ZXingBrowser;
  await new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector('script[data-ops-zxing="1"]') as HTMLScriptElement|null;
    if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("ZXing load failed")),{once:true});return}
    const s=document.createElement("script");s.src="https://unpkg.com/@zxing/browser@0.2.1/umd/zxing-browser.min.js";s.async=true;s.dataset.opsZxing="1";s.onload=()=>resolve();s.onerror=()=>reject(new Error("ZXing load failed"));document.head.appendChild(s);
  });
  if(!window.ZXingBrowser)throw new Error("ZXing unavailable");
  return window.ZXingBrowser;
}

export default function OpsScanFallback(){
  const pathname=usePathname();
  const [status,setStatus]=useState("");
  useEffect(()=>{
    if(pathname!=="/ops")return;
    const onChange=async(ev:Event)=>{
      const input=ev.target as HTMLInputElement;
      if(!(input instanceof HTMLInputElement)||input.type!=="file"||!input.files?.[0])return;
      if("BarcodeDetector" in window)return;
      const file=input.files[0];
      if(!file.type.startsWith("image/")&&file.type!=="application/pdf")return;
      ev.stopImmediatePropagation();
      setStatus("جاري قراءة الباركود بالقارئ الاحتياطي...");
      try{
        const ZX=await loadZxing();
        const reader=new ZX.BrowserMultiFormatReader();
        let text="";
        if(file.type.startsWith("image/")){
          const url=URL.createObjectURL(file);
          try{const result=await reader.decodeFromImageUrl(url);text=String(result?.getText?.()||result?.text||"")}finally{URL.revokeObjectURL(url)}
        }else{
          const pdfjs=await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc="https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";
          const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
          const pages=Math.min(pdf.numPages,3);
          for(let i=1;i<=pages&&!text;i++){
            setStatus(`جاري فحص صفحة ${i} من ${pages} بالقارئ الاحتياطي...`);
            const page=await pdf.getPage(i);const viewport=page.getViewport({scale:2.4});
            const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            const ctx=canvas.getContext("2d");if(!ctx)continue;
            await page.render({canvasContext:ctx,viewport,canvas}).promise;
            try{const result=await reader.decodeFromCanvas(canvas);text=String(result?.getText?.()||result?.text||"")}catch{}
          }
        }
        if(!text)throw new Error("not found");
        const field=rawField();if(!field)throw new Error("field unavailable");
        setNative(field,text.trim());
        setStatus("تمت قراءة الباركود وتعبئة معلومات المسافر بنجاح.");
        try{navigator.vibrate?.(100)}catch{}
      }catch(err){
        console.error("ops fallback scan",err);
        setStatus("ما قدرت أقرأ الباركود من الملف. جرّب صورة أوضح، PDF الأصلي، أو القارئ الخارجي.");
      }
    };
    document.addEventListener("change",onChange,true);
    return()=>document.removeEventListener("change",onChange,true);
  },[pathname]);
  if(pathname!=="/ops"||!status)return null;
  return <div dir="rtl" style={{position:"fixed",right:14,bottom:14,zIndex:120,maxWidth:420,background:"#0d1829",color:"#f8fafc",border:"1px solid #c8a66a",borderRadius:14,padding:"11px 13px",boxShadow:"0 12px 30px rgba(0,0,0,.4)",fontWeight:800}}>{status}</div>;
}
