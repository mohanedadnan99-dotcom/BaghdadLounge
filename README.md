# مدينة J8JI — واجهة مجموعة J8JI

الواجهة الرئيسية لـ **j8ji.com**: مدينة ليلية، كل بناية شركة وتفتح موقعها.

- الصفحة: `public/index.html` (ملف واحد، بدون مكتبات)
- الشركات والروابط: مصفوفة `COMPANIES` بأول السكربت
- النشر: Cloudflare Worker باسم `j8ji-group` (`npx wrangler deploy`)

خريطة الدومينات:
| الدومين | الموقع |
|---|---|
| j8ji.com / www | هذي الواجهة (j8ji-group) |
| vip.j8ji.com | J8JI VIP SERVICE (worker: j8ji) |
| naqsh.j8ji.com | نقش · دعوات رقمية (worker: naqsh) |
| sirr.j8ji.com | متجر سر |
| radar.j8ji.com | رادار العراق |
| shkomaku.j8ji.com | شكو ماكو |
| lounge.j8ji.com | لاونج بغداد |

إحدى خدمات مجموعة J8JI · تطوير مهند العدنان
