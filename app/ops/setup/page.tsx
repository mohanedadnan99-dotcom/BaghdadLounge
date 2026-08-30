"use client";

import { useState } from "react";

export default function OpsSetupPage() {
  const [form, setForm] = useState({ username: "admin", password: "" });
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/ops/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "تعذر إعداد الحساب");
        return;
      }
      setDone(true);
      setMessage("تم إنشاء حساب المالك بنجاح. افتح نظام التشغيل وسجّل بنفس البيانات.");
    } catch {
      setMessage("تعذر الاتصال بالنظام");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#07111f", color: "#f8fafc", display: "grid", placeItems: "center", padding: 20, fontFamily: "Arial,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 430, background: "#0d1829", border: "1px solid #24344a", borderRadius: 20, padding: 22 }}>
        <div style={{ color: "#c8a66a", fontWeight: 800, marginBottom: 6 }}>BAGHDAD LOUNGE</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 25 }}>إعداد حساب المالك</h1>
        <p style={{ color: "#94a3b8", lineHeight: 1.7, marginTop: 0 }}>هذه الصفحة مخصصة للنسخة التجريبية فقط. أدخل اليوزر والباسورد الذي تريدهما ثم افتح نظام /ops.</p>

        <form onSubmit={submit}>
          <label style={{ display: "grid", gap: 7, marginBottom: 14 }}>
            <span>اسم المستخدم</span>
            <input required minLength={3} autoCapitalize="none" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={input} />
          </label>
          <label style={{ display: "grid", gap: 7, marginBottom: 14 }}>
            <span>كلمة المرور</span>
            <input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={input} />
          </label>
          <button disabled={loading} style={button}>{loading ? "جاري الحفظ..." : done ? "تم الإعداد" : "حفظ الحساب"}</button>
        </form>

        {message && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#111d30", color: done ? "#86efac" : "#f8fafc" }}>{message}</div>}
        {done && <a href="/ops" style={{ ...button, textDecoration: "none", textAlign: "center", marginTop: 12, display: "block" }}>فتح نظام التشغيل</a>}
      </div>
    </main>
  );
}

const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "#07111f", color: "#f8fafc", border: "1px solid #334155", borderRadius: 11, padding: "12px 13px", fontSize: 17 };
const button: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #c8a66a", background: "#c8a66a", color: "#07111f", borderRadius: 11, padding: "12px 14px", fontSize: 16, fontWeight: 800, cursor: "pointer" };
