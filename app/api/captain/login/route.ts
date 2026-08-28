import { createCaptainSession } from "@/lib/captain-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const captains = [
  { username: "mohaned", password: "123456", name: "مهند", company: "", phone: "07745551999" },
  { username: "ashaq", password: "123456", name: "إسحاق", company: "لاونج بغداد", phone: "" },
  { username: "m", password: "123456", name: "مهند عدنان محمد", company: "تكسي المميز", phone: "07745551999" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase();
    const captain = captains.find((item) => item.username === username && item.password === body.password);
    if (!captain) {
      return Response.json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    const sessionToken = createCaptainSession({
      username: captain.username,
      name: captain.name,
      company: captain.company,
      phone: captain.phone,
    });
    return Response.json(
      { captain: { name: captain.name, company: captain.company }, sessionToken },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
