# تقرير المرحلة 2 — مواءمة Composer مع منصة الوثائق

المرجع: HKM-COMPOSER-DOCUMENTS-004  
PR: [#594](https://github.com/asim1417/hakeem-platform/pull/594) (Stacked)  
الأساس: #593 ← #592  
الفرع: `cursor/composer-documents-da55`

**لا دمج · لا نشر · لا Mark Ready · لا يُدمج قبل #592 ثم #593**

---

## قبل → بعد

| قبل | بعد |
|---|---|
| Ask: extractFile → document inline فقط | رفع Attachment + Adapter → doc-node + حالات |
| extractedText=null دائمًا بعد الرفع | إكمال عبر process/extraction + processExtractedText |
| read_attachment يقرأ ctx.document فقط | بالمعرّف + ملكية + تحذيرات PARTIAL/NOT_READY |
| بلا SHA/magic على الرفع المحلي | خلف ATTACHMENTS_V2 |
| لا ربط doc-node بـ Ask | queue/sync عبر `/process` |

## قرارات

- **اعتماد:** processExtractedText، extractFile، doc-node engines، Attachment، mime-sniff  
- **تطوير:** رفع آمن، Adapter، حالات، read_attachment، agent-search sync  
- **Adapter:** MessageAttachmentRef، metadata.pages (بدل جدول Pages الآن)  
- **مواءمة:** جسر DOCUMENTS_V1 كـ legacy/Fallback  

## العقود/المسارات الجديدة

- `lib/modules/attachments/document-processing-adapter.ts`
- `lib/modules/attachments/secure-upload.ts`
- `POST/GET /api/attachments/[id]/process`
- `POST /api/attachments/[id]/extraction` (الجسر السابق)
- أعلام: `HAKEEM_COMPOSER_ATTACHMENTS_V2` · `HAKEEM_DOCUMENT_PROCESSING_V2` · `HAKEEM_DOC_NODE_CALLBACK_V1`

## Job sync

Polling خادمي عبر sync في `/process` وagent-search. Webhook HMAC مؤجّل خلف `HAKEEM_DOC_NODE_CALLBACK_V1`.

## الاختبارات

| أمر | نتيجة |
|---|---|
| test:composer-attachments-v2 | 22/22 |
| test:composer-documents | 20/20 |
| test:attachments-regression | 28/28 |
| test:document-inspection | 84/84 |
| test:doc-node | 7/7 |
| test:source-policy | 71/71 |
| test:hakeem-composer | 40/40 |
| test:source-policy-e2e | 16/16 |
| test:runtime / intent-gate | ناجح |
| tsc / lint / build | ناجح |

## ما لم يُنفَّذ (متعمد)

Webhook موقّع كامل · جدول AttachmentPage · بحث هجين · استشهادات V2 · صوت · ربط قضايا · OCR جديد · Dashboard جديد

## Rollback

انظر `docs/document-platform/phase2-rollback.md`
