"use client";

import { useMemo, useState } from "react";

const initialEmployees = [
  { id: 1, name: "موظف الاستقبال 1", username: "reception1", shift: "الصباحي", role: "موظف استقبال", active: true },
  { id: 2, name: "مشرف الشفت", username: "shiftlead", shift: "المسائي", role: "مشرف شفت", active: true },
];

const initialActivity = [
  { id: "BL-260830-000184", passenger: "محمد أحمد", airline: "الخطوط الجوية العراقية", payment: "آجل / شركة", employee: "موظف الاستقبال 1", shift: "الصباحي", time: "16:24" },
  { id: "BL-260830-000183", passenger: "علي حسن", airline: "الملكية الأردنية", payment: "نقدي", employee: "موظف الاستقبال 1", shift: "الصباحي", time: "16:19" },
  { id: "BL-260830-000182", passenger: "سارة كريم", airline: "الخطوط الجوية القطرية", payment: "إلكتروني", employee: "مشرف الشفت", shift: "المسائي", time: "16:11" },
];

export default function OpsHomePage() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [activity, setActivity] = useState(initialActivity);
  const [view, setView] = useState<"dashboard" | "employees">("dashboard");
  const [form, setForm] = useState({ name: "", username: "", password: "", shift: "الصباحي", role: "موظف استقبال" });

  const totals = useMemo(() => ({
    passengers: activity.length,
    cash: activity.filter((x) => x.payment === "نقدي").length,
    credit: activity.filter((x) => x.payment.includes("شركة")).length,
    electronic: activity.filter((x) => x.payment === "إلكتروني").length,
  }), [activity]);

  function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) return;
    setEmployees((prev) => [...prev, { id: Date.now(), name: form.name.trim(), username: form.username.trim(), shift: form.shift, role: form.role, active: true }]);
    setForm({ name: "", username: "", password: "", shift: "الصباحي", role: "موظف استقبال" });
  }

  function toggleEmployee(id: number) {
    setEmployees((prev) => prev.map((employee) => employee.id === id ? { ...employee, active: !employee.active } : employee));
  }

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#08111f", color: "#f8fafc", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#c8a66a", fontWeight: 700, letterSpacing: 1 }}>BAGHDAD LOUNGE</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 30 }}>Operations System</h1>
            <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>نظام التشغيل المعزول للصالة — متابعة لايف، موظفين، شفتات وصلاحيات</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setView("dashboard")} style={buttonStyle(view === "dashboard")}>الداشبورد</button>
            <button onClick={() => setView("employees")} style={buttonStyle(view === "employees")}>الموظفين والصلاحيات</button>
          </div>
        </header>

        {view === "dashboard" ? (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 22 }}>
              <Stat title="المسافرين اليوم" value={totals.passengers} />
              <Stat title="نقدي" value={totals.cash} />
              <Stat title="آجل / شركات" value={totals.credit} />
              <Stat title="دفع إلكتروني" value={totals.electronic} />
              <Stat title="الموظفين النشطين" value={employees.filter((e) => e.active).length} />
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>الحركات المباشرة</h2>
                  <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>آخر عمليات دخول المسافرين والمسح عند باب الصالة</p>
                </div>
                <span style={{ color: "#86efac", fontWeight: 700 }}>LIVE</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
                  <thead>
                    <tr>{["رقم العملية", "المسافر", "شركة الطيران", "الحساب", "الموظف", "الشفت", "الوقت"].map((x) => <th key={x} style={thStyle}>{x}</th>)}</tr>
                  </thead>
                  <tbody>
                    {activity.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.passenger}</td><td style={tdStyle}>{row.airline}</td><td style={tdStyle}>{row.payment}</td><td style={tdStyle}>{row.employee}</td><td style={tdStyle}>{row.shift}</td><td style={tdStyle}>{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, .8fr) minmax(0, 1.2fr)", gap: 18 }}>
            <form onSubmit={addEmployee} style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>إضافة موظف</h2>
              <Field label="اسم الموظف"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="اسم المستخدم"><input style={inputStyle} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              <Field label="كلمة المرور"><input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              <Field label="الشفت"><select style={inputStyle} value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}><option>الصباحي</option><option>المسائي</option><option>الليلي</option></select></Field>
              <Field label="الصلاحية"><select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>موظف استقبال</option><option>مشرف شفت</option><option>محاسب</option><option>مدير</option></select></Field>
              <button type="submit" style={{ ...buttonStyle(true), width: "100%", marginTop: 8 }}>إضافة الموظف</button>
            </form>

            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>الموظفين الحاليين</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {employees.map((employee) => (
                  <div key={employee.id} style={{ border: "1px solid #233044", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{employee.name}</div>
                      <div style={{ color: "#94a3b8", marginTop: 5 }}>@{employee.username} · {employee.shift} · {employee.role}</div>
                    </div>
                    <button type="button" onClick={() => toggleEmployee(employee.id)} style={buttonStyle(employee.active)}>{employee.active ? "نشط" : "موقوف"}</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div style={cardStyle}><div style={{ color: "#94a3b8", fontSize: 14 }}>{title}</div><div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{value}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 7, marginBottom: 13 }}><span style={{ color: "#cbd5e1", fontSize: 14 }}>{label}</span>{children}</label>;
}

const cardStyle: React.CSSProperties = { background: "#0d1728", border: "1px solid #1f2b3d", borderRadius: 18, padding: 18 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "#08111f", color: "#f8fafc", border: "1px solid #334155", borderRadius: 10, padding: "12px 13px", fontSize: 16 };
const thStyle: React.CSSProperties = { textAlign: "right", color: "#94a3b8", fontWeight: 600, padding: "12px 10px", borderBottom: "1px solid #253247" };
const tdStyle: React.CSSProperties = { padding: "13px 10px", borderBottom: "1px solid #182437", whiteSpace: "nowrap" };
function buttonStyle(active: boolean): React.CSSProperties { return { border: active ? "1px solid #c8a66a" : "1px solid #334155", background: active ? "#c8a66a" : "#111c2d", color: active ? "#08111f" : "#e2e8f0", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }; }
