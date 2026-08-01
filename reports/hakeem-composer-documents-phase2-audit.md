# فحص المرحلة 2 — مواءمة HakeemComposer مع منصة الوثائق

المرجع: HKM-COMPOSER-DOCUMENTS-004  
التاريخ: 2026-08-01  
الفرع: `cursor/composer-documents-da55` (Stacked فوق #593)  
PRs: #592 OPEN · #593 OPEN · #594 OPEN (هذا الفرع)

---

## 1) مسارات مفحوصة

### Ask الحالي (قبل/جزئيًا بعد #594)
```
HakeemComposer → extractFile → document inline → agent-search → read_attachment(ctx.document)
→ MessageAttachmentRef (inline أو Attachment.id خلف DOCUMENTS_V1)
```
البايتات: لا تُحفظ دائمًا إلا عند تفعيل جسر الرفع. الاستخراج غالبًا متصفح. لا Job خلفي.

### Attachment
```
POST /api/attachments → MIME من file.type → Blob/SP/metadata-only → UPLOADED · extractedText=null
```
حد حجم: غير موجود على الرفع المحلي · SHA/magic: موجودان في import-url فقط · لا بدء Job.

### منصة الوثائق / doc-node
```
POST /api/jobs → local|gemini|qari → processExtractedText → GET /api/jobs/{id}?text=1
```
إغلاق المتصفح لا يوقف Job على خدمة Node. يُستأنف من القرص.

---

## 2) مصفوفة القرارات

| القدرة | الحالة | القرار | السبب |
|---|---|---|---|
| processExtractedText | إنتاجي | **اعتماد** | دماغ موحّد |
| extractFile / OCR متصفح | إنتاجي | **اعتماد + Fallback خصوصية** | ليس السجل الدائم |
| doc-node engines/jobs | إنتاجي | **اعتماد + Adapter** | معالجة ثقيلة خارج Vercel |
| Attachment + status enums | موجود ناقص الربط | **تطوير** | ملء نص/حالات/Job |
| mime-sniff + SHA (import-url) | موجود | **مواءمة → رفع Ask** | لا تكرار منطق |
| blob-storage upload | إنتاجي | **تطوير** downloadBytes | ناقص للـ Adapter |
| read_attachment | ctx.document فقط | **تطوير** | بالمعرّف + ملكية |
| MessageAttachmentRef | JSON مرحلي | **Adapter** | ids حقيقية |
| AttachmentPage table | غير موجود | **Adapter عبر metadata.pages** | بدون migration إلزامية الآن؛ مقترح لاحقًا |
| Cookie doc-platform workspace | منفصل | **لا اعتماد كسجل Ask** | ليس ملكية مستخدم Ask |

---

## 3) فجوات تُغلق في هذا التنفيذ

1. Document Processing Adapter → doc-node + fallback آمن  
2. رفع آمن (حجم، magic, SHA, dedup ملكية) خلف ATTACHMENTS_V2  
3. حالات QUEUED→…→READY/PARTIAL/FAILED عبر مزامنة Job  
4. read_attachment({ attachmentIds }) مع effectivePolicy  
5. Feature flags: ATTACHMENTS_V2 · DOCUMENT_PROCESSING_V2 · DOC_NODE_CALLBACK_V1 (polling أولًا)  
6. صفحات في metadata.pages  
7. توافق legacy inline خلف الأعلام  

---

## 4) اختبارات الأساس (قبل التوسيع)

| أمر | نتيجة |
|---|---|
| test:document-inspection | 84/84 |
| test:attachments-regression | 28/28 |
| test:doc-node | 7/7 |
| test:composer-documents | 20/20 |
| test:source-policy | 71/71 |
| test:hakeem-composer | 40/40 |

لا مانع خطير — يُبدأ التنفيذ التراكمي.
