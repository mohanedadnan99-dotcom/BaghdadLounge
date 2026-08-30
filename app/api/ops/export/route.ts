import { neon } from "@neondatabase/serverless";
import { adminSessionFromRequest } from "@/lib/admin-auth";
import { opsSessionFromRequest } from "@/lib/lounge-ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function connectionString(){const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!value)throw new Error("DATABASE_URL is not configured");return value}
function allowed(request:Request){const ops=opsSessionFromRequest(request);if(ops&&(ops.role==="owner"||ops.role==="manager"||ops.role==="accountant"))return true;const admin=adminSessionFromRequest(request);return admin?.role==="owner"}
function csv(value:unknown){const s=String(value??"").replaceAll('"','""');return `"${s}"`}

export async function GET(request:Request){
  if(!allowed(request))return new Response("غير مصرح",{status:401});
  try{
    const db=neon(connectionString());
    const rows=await db`
      SELECT e.reference,e.created_at,
        COALESCE(u.lounge_name,'لاونج بغداد') lounge_name,
        s.shift_name,u.name employee_name,u.username employee_username,
        e.passenger_name,e.airline,e.flight_number,e.origin,e.destination,e.seat,e.travel_class,
        e.payment_type,e.billing_company,e.amount_iqd,e.entry_source,e.notes,e.boarding_raw
      FROM ops_entries e
      JOIN ops_employees u ON u.id=e.employee_id
      JOIN ops_shifts s ON s.id=e.shift_id
      ORDER BY e.created_at DESC
    `;
    const headers=["رقم العملية","التاريخ والوقت","الصالة","الشفت","الموظف","يوزر الموظف","اسم المسافر","شركة الطيران","رقم الرحلة","من","إلى","المقعد","الدرجة","طريقة الحساب","الشركة/الجهة","المبلغ د.ع","مصدر الإدخال","ملاحظات","بيانات الباركود"];
    const lines=[headers.map(csv).join(",")];
    for(const r of rows as any[])lines.push([r.reference,r.created_at,r.lounge_name,r.shift_name,r.employee_name,r.employee_username,r.passenger_name,r.airline,r.flight_number,r.origin,r.destination,r.seat,r.travel_class,r.payment_type,r.billing_company,r.amount_iqd,r.entry_source,r.notes,r.boarding_raw].map(csv).join(","));
    const body="\uFEFF"+lines.join("\r\n");
    return new Response(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=baghdad-lounge-ops.csv","Cache-Control":"no-store"}})
  }catch(error){console.error("ops export",error);return new Response("تعذر إنشاء التقرير",{status:500})}
}
