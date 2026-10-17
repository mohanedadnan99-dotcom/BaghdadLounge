import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BookOpenText, Building2, CircleHelp, ClipboardCheck, DoorOpen, FileText, KeyRound, LifeBuoy, MonitorCog, PlaneTakeoff, ShieldCheck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "دليل الاستخدام | Lounge Baghdad",
  description: "دليل مبسط لاستخدام نظام إدارة وتشغيل صالات لاونج بغداد.",
  robots: { index: false, follow: false },
};

const sections = [
  {
    number: "01", title: "إدارة الشركة", icon: MonitorCog, href: "/admin",
    subtitle: "للمدير والإدارة المخوّلة",
    items: [
      "افتح لوحة الإدارة وسجّل الدخول ببيانات الحساب الذي تم تفعيله لك.",
      "تابع الطلبات الجديدة والطلبات الجارية، وحدّد الأولوية والحالة والملاحظات عند الحاجة.",
      "استخدم تقارير الإيرادات والحجوزات والشركات لمراجعة النشاط اليومي.",
      "لإضافة مستخدمين إداريين، افتح الموظفون والصلاحيات من لوحة الإدارة؛ هذه العملية تتطلب صلاحية مالك."
    ]
  },
  {
    number: "02", title: "موظف الصالة والشفت", icon: PlaneTakeoff, href: "/ops",
    subtitle: "تسجيل المسافرين وإدارة حركة الصالة",
    items: [
      "سجّل الدخول بحساب الموظف المخصص للصالة والشفت، ثم افتح الشفت وفق التعليمات الظاهرة.",
      "اقرأ البوردنك بالقارئ، أو بالكاميرا، أو أدخل بيانات المسافر يدوياً عندما تتعذر القراءة.",
      "تحقق من الاسم والرحلة وشركة الطيران والصالة وحدد طريقة الدفع الصحيحة قبل حفظ العملية.",
      "تابع حالة المسافر داخل الصالة، وعند تبديل الشفت استخدم إجراء تسليم الشفت وسجل النقد والملاحظات."
    ]
  },
  {
    number: "03", title: "الاستقبال والطلبات", icon: DoorOpen, href: "/reception",
    subtitle: "متابعة الطلبات الواردة",
    items: [
      "سجّل الدخول بحساب الاستقبال المخصص لك.",
      "راجع الطلبات الجديدة وبيانات العميل والشركة والصالة والأولوية.",
      "حدّث حالة الطلب بالتسلسل المناسب: جديد، تم الاستلام، قيد التنفيذ، مكتمل أو ملغي.",
      "فعّل التنبيهات الصوتية على الجهاز المسموح به عند الحاجة، وتحقق من الطلبات المتأخرة."
    ]
  },
  {
    number: "04", title: "بوابة الكباتن", icon: Users, href: "/captain",
    subtitle: "إدخال طلبات الشركات",
    items: [
      "يسجّل الكابتن الدخول بحسابه المخصص من الإدارة.",
      "يختار الصالة، ويُدخل معلومات المسافر وعدد المسافرين والحقائب والعربات وفق النموذج.",
      "يدقق رقم التواصل وبيانات الطلب قبل الإرسال، ثم يحتفظ برقم الطلب الظاهر بعد التأكيد.",
      "تُدار حسابات الكباتن والتفعيل والإيقاف من الإدارة المختصة."
    ]
  },
];

const faqs = [
  ["نسيت كلمة المرور؟", "تواصل مع مسؤول النظام أو المدير المخوّل لإعادة تعيينها. لا ترسل كلمة المرور في مجموعات عامة."],
  ["الباركود لا يعمل؟", "تحقق من صلاحيات الكاميرا أو اتصال قارئ USB، واستخدم الإدخال اليدوي. دوّن المشكلة وأبلغ الدعم الفني."],
  ["الإنترنت انقطع؟", "اتبع رسالة حالة الاتصال داخل لوحة الشفت؛ لا تفترض مزامنة أي عملية حتى تؤكد ظهور حالة نجاح المزامنة."],
  ["سجل مالي غير صحيح؟", "لا تُغيّر العملية دون مرجع. راجع طريقة الدفع وتسعيرة شركة الطيران وسجّل سبب أي تعديل."],
  ["هل يمكن حذف البيانات التجريبية؟", "إجراء تصفير التسليم مخصص للمالك فقط، وهو حذف نهائي لسجلات محددة. لا تستخدمه بعد بدء التشغيل الفعلي."],
];

export default function HelpPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f6] text-[#15323e]">
      <section className="bg-[#092936] text-white">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d6ae70]/40 bg-[#d6ae70]/10 px-4 py-2 text-xs font-bold text-[#e7c58f]"><BookOpenText className="size-4" /> دليل الموظفين والإدارة</span>
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/85 hover:bg-white/10">الصفحة الرئيسية <ArrowLeft className="size-4" /></Link>
          </div>
          <p className="mt-10 text-xs font-semibold tracking-[.22em] text-[#d6ae70]" dir="ltr">LOUNGE BAGHDAD · OPERATIONS GUIDE</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">دليل استخدام نظام إدارة صالات VIP</h1>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-white/65 sm:text-base">صفحة مرجعية مختصرة لموظفي الصالة والاستقبال والكباتن والإدارة. يتطلب كل قسم حساباً مُفعّلاً وصلاحيات مناسبة. هذه الصفحة لا تنشئ حسابات ولا تعرض كلمات مرور.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-xl bg-[#d6ae70] px-5 py-3 text-sm font-bold text-[#102c37] hover:bg-[#ebca95]">الدخول للإدارة <ArrowLeft className="size-4" /></Link>
            <Link href="/ops" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10">لوحة الشفت <ArrowLeft className="size-4" /></Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-[#e9ddc7] p-2 text-[#856024]"><ClipboardCheck className="size-5" /></span><div><p className="text-xs font-semibold text-[#8a6b3e]">البدء السريع</p><h2 className="text-xl font-black">اختر لوحة العمل المناسبة</h2></div></div>
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map(({number,title,icon:Icon,href,subtitle,items}) => (
            <article key={number} className="rounded-[24px] border border-[#dce4e6] bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf1f3] text-[#174a5a]"><Icon className="size-5" /></span>
                <span dir="ltr" className="text-sm font-bold tracking-[.2em] text-[#b28a50]">{number}</span>
              </div>
              <h3 className="text-xl font-black">{title}</h3>
              <p className="mt-1 text-xs text-[#72828a]">{subtitle}</p>
              <ol className="mt-5 space-y-3">{items.map((item,i)=><li key={i} className="flex gap-3 text-sm leading-7 text-[#48606b]"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#eef1ed] text-xs font-bold text-[#4e6e63]">{i+1}</span><span>{item}</span></li>)}</ol>
              <Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#103a4b] px-4 py-3 text-sm font-bold text-white hover:bg-[#1d5368]">فتح اللوحة <ArrowLeft className="size-4" /></Link>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        <div className="rounded-[26px] border border-[#ded8c9] bg-[#fffaf1] p-6 sm:p-8">
          <div className="flex items-center gap-3"><ShieldCheck className="size-6 text-[#a57a3d]" /><h2 className="text-xl font-black">أول يوم تشغيل</h2></div>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[#4e5d61] md:grid-cols-2">
            <p>١. تحقق من اسم الصالة والشفت والحساب والصلاحيات.</p><p>٢. جرّب حفظ عملية اختبارية مع التأكد من عدم خلطها بالإيرادات الفعلية.</p>
            <p>٣. تأكد من تحديث التقارير وحالة المزامنة والإشعارات المتفق عليها.</p><p>٤. تحقق من وسيلة التواصل مع الدعم قبل استقبال المسافرين.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="mb-6 flex items-center gap-3"><CircleHelp className="size-6 text-[#997340]" /><h2 className="text-xl font-black">حل المشاكل الشائعة</h2></div>
        <div className="space-y-3">{faqs.map(([q,a])=><div key={q} className="rounded-2xl border border-[#e0e6e7] bg-white px-5 py-4"><p className="font-bold">{q}</p><p className="mt-1 text-sm leading-7 text-[#526873]">{a}</p></div>)}</div>
      </section>
      <footer className="bg-[#092936] px-5 py-8 text-center text-xs leading-7 text-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4">
          <Link href="/ops/admin" className="hover:text-white"><Building2 className="ml-1 inline size-4" /> إدارة التشغيل</Link>
          <Link href="/admin/employees" className="hover:text-white"><KeyRound className="ml-1 inline size-4" /> حسابات الإدارة</Link>
          <Link href="/reception" className="hover:text-white"><LifeBuoy className="ml-1 inline size-4" /> الاستقبال</Link>
        </div>
        <p className="mt-3">Lounge Baghdad · Internal user guidance · لا يحتوي على بيانات دخول سرية</p>
      </footer>
    </main>
  );
}
