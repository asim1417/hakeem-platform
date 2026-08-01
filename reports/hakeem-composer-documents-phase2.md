# تقرير المرحلة 2 — مواءمة Composer مع منصة الوثائق (محدّث — جولة الإغلاق)

المرجع: HKM-COMPOSER-DOCUMENTS-004  
PR: [#594](https://github.com/asim1417/hakeem-platform/pull/594) (Stacked)  
الأساس: #593 ← #592  
الفرع: `cursor/composer-documents-da55`

**لا دمج · لا نشر · لا Mark Ready · لا يُدمج قبل #592 ثم #593 · لا مرحلة ثالثة**

التفاصيل الكاملة لجولة التحصين: `reports/hakeem-composer-documents-phase2-closure.md`

---

## قبل → بعد (بعد التحصين)

| قبل | بعد |
|---|---|
| أعلام مشتتة؛ العميل يقرأ DOCUMENTS_V1 فقط | قرار موحّد؛ V2 عميل يكفي بلا اشتراط V1 |
| browser /extraction يكتب READY فوق Job | provenance + preview/fallback؛ doc-node مصدر حقيقة |
| client يمرّر engine/confidence | الخادم يقرر؛ العميل يُتجاهل |
| pageRange معلن بلا تطبيق | تطبيق حقيقي + تحقق + queryHint حتمي |
| أخطاء مرفقات مختلطة (FAILED⊂NOT_READY) | قوائم منفصلة + ترتيب محدد |
| formData قبل الجلسة | جلسة → Content-Length → Rate limit → FormData |
| sync يعيد extractedText القديم | يعيد نص الإكمال الجديد |
| SharePoint يرسل Bearer لـ metadata URL | Graph content / منع SSRF وredirect |

## العقود الجديدة/المحدّثة

- `lib/modules/hakeem-composer/document-flags.ts`
- `lib/modules/attachments/extraction-provenance.ts`
- `lib/modules/attachments/attachment-classify.ts`
- `lib/modules/attachments/read-attachment-pages.ts`
- `lib/modules/attachments/sharepoint-download.ts`
- `lib/modules/attachments/upload-rate-limit.ts`
- صلاحية `ASK_ATTACHMENT_UPLOAD`

## الاختبارات (تُحدَّث بعد التشغيل)

انظر تقرير الإغلاق للأرقام النهائية.
