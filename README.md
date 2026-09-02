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
- `OPS_SHEETS_WEBHOOK_URL`: رابط Web App المنشور من Google Apps Script لمزامنة سجل العمليات.
- `OPS_SHEETS_WEBHOOK_TOKEN`: رمز سري مشترك بين النظام وGoogle Apps Script.

ميزة قراءة التذكرة تقبل JPG وPNG وWebP وPDF بحجم أقصى 10MB. تتم المعالجة من السيرفر ولا يُحفظ الملف في قاعدة بيانات الحجز.

## ربط سجل العمليات مع Google Sheet

1. أنشئ مشروعاً في Google Apps Script والصق محتوى `docs/google-sheets-webhook.gs`.
2. من إعدادات المشروع أضف Script Property باسم `OPS_SYNC_TOKEN` وقيمة عشوائية قوية.
3. انشر المشروع كـ Web app بخيار التنفيذ باسم مالك الملف والسماح بالوصول إلى `Anyone`؛ التوكن يمنع الطلبات غير المصرح بها.
4. أضف رابط النشر إلى `OPS_SHEETS_WEBHOOK_URL` ونفس التوكن إلى `OPS_SHEETS_WEBHOOK_TOKEN` في بيئة Production على Vercel، ثم أعد النشر.
5. افتح مركز المالك > `Google Sheet` واضغط `إعادة مزامنة الكل` لترحيل العمليات المعلقة.

الـWebhook يستخدم رقم العملية لمنع تكرار الصف: إذا وصل نفس الرقم مرة ثانية، يُحدّث الصف الموجود بدلاً من إضافة نسخة أخرى.
