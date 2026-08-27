# Lounge Baghdad

موقع حجز صالة لاونج بغداد في مطار بغداد الدولي، مبني باستخدام Next.js وجاهز للنشر على Vercel.

## التشغيل
```bash
npm install
npm run dev
```

انسخ `.env.example` إلى `.env.local` وأضف مفاتيح Telegram وWayl وNeon. لا ترفع ملف البيئة إلى GitHub.

## متغيرات البيئة
- `TELEGRAM_BOT_TOKEN`: توكن البوت.
- `TELEGRAM_CHAT_ID`: معرف كروب Telegram.
- `WAYL_API_KEY`: مفتاح Wayl السري.
- `WAYL_WEBHOOK_SECRET`: مفتاح توقيع إشعارات Wayl.
- `DATABASE_URL`: رابط Neon Postgres.
- `NEXT_PUBLIC_SITE_URL`: رابط الموقع العام.
- `OPENAI_API_KEY`: مفتاح OpenAI لقراءة صور وملفات PDF للتذاكر تلقائياً.
- `OPENAI_TICKET_MODEL`: النموذج المستخدم لاستخراج البيانات (الافتراضي `gpt-5.6`).

ميزة قراءة التذكرة تقبل JPG وPNG وWebP وPDF بحجم أقصى 10MB. تتم المعالجة من السيرفر ولا يُحفظ الملف في قاعدة بيانات الحجز.
