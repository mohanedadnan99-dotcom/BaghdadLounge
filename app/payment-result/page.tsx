import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
export default async function PaymentResult({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#090909] px-5"><div className="w-full max-w-lg border border-[#c9a55c]/30 bg-[#10100f] p-8 text-center sm:p-12"><CheckCircle2 className="mx-auto text-[#c9a55c]" size={58}/><p className="mt-6 text-xs text-[#c9a55c]">تمت العودة من بوابة الدفع</p><h1 className="mt-3 text-2xl">شكراً لاختيارك لاونج بغداد</h1><p className="mt-4 text-sm leading-7 text-[#8d8982]">سيقوم فريقنا بمراجعة حالة الدفع والتواصل معك لتأكيد الحجز.</p>{reference&&<div className="mt-6 border border-dashed border-white/15 px-4 py-3 font-[var(--font-latin)] text-[#dabb75]">{reference}</div>}<Link href="/" className="mt-7 inline-block bg-[#c9a55c] px-7 py-3 text-sm font-semibold text-black">العودة للرئيسية</Link></div></main>;
}
