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
