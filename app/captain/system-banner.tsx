"use client";
import { useEffect,useState } from "react";
import { BellRing } from "lucide-react";

type Message={id:number;text:string};
export default function CaptainSystemBanner(){
  const [messages,setMessages]=useState<Message[]>([]);
  useEffect(()=>{let live=true;async function load(){try{const r=await fetch("/api/captain/config",{cache:"no-store"});const x=await r.json();if(live&&r.ok)setMessages(x.messages||[])}catch{}}void load();const t=setInterval(load,60000);return()=>{live=false;clearInterval(t)}},[]);
  if(!messages.length)return null;
  return <div dir="rtl" className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-[390px] rounded-2xl border border-amber-200 bg-amber-50/95 p-3 text-amber-900 shadow-lg backdrop-blur">
    <div className="flex items-start gap-2"><BellRing className="mt-0.5 size-4 shrink-0"/><div className="space-y-1 text-right">{messages.map(m=><p key={m.id} className="text-[11px] font-medium leading-5">{m.text}</p>)}</div></div>
  </div>;
}
