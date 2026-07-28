# PR-2 Known Limitations

1. **لا دعم لروابط تتطلب تسجيل دخول** (401/403 → فشل واضح).
2. **لا Google Drive / OneDrive / SharePoint / Dropbox / Box** في هذه المرحلة (كاشف يؤجّلها برسالة واضحة).
3. **DNS rebinding:** طبقات متعددة بدون socket IP pinning الكامل — انظر pr2-security-model.md.
4. **SharePoint storage backend** ما زال يقرأ الملف من القرص مرة للـ Graph PUT (قيد Graph، ليس مسار التنزيل).
5. **Rate limit** في ذاكرة العملية — غير مشترك بين نسخ Vercel؛ يُفضَّل Redis لاحقًا.
6. **لا OCR/استخراج** في import — الحالة `UPLOADED` بعد التخزين (متوافق مع PR-1).
7. **DOCX:** يعتمد على وجود إشارات OOXML في الرأس أو `file-type` عند التحميل الديناميكي.
8. **Vercel maxDuration** لمسار import مضبوط على 60s — ملفات قريبة من الحد قد تتطلب عاملًا خارجيًا لاحقًا.
