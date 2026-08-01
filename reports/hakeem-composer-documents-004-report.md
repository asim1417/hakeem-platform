# تقرير المرحلة — HKM-COMPOSER-DOCUMENTS-004

الفرع: `cursor/composer-documents-da55`  
الأساس: `cursor/composer-source-policy-da55` (PR #593)  
Stacked: **لا يُدمج قبل PR #592 ثم PR #593**  
العلم: `HAKEEM_COMPOSER_DOCUMENTS_V1` + `NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1`

---

## 1) ماذا فُحص

Ask كان يمرّر نصًا ephemeral فقط. منصة الوثائق (`extractFile` / `processExtractedText` / OCR Gemini+Tesseract) و`Attachment` موجودة لكن غير موصولة بـ Ask. `extractedText` يبقى null بعد الرفع.

## 2) المصفوفة (ملخص)

| اعتماد | تطوير | Adapter | مواءمة لاحقًا |
|---|---|---|---|
| extractFile, processExtractedText, doc-tool OCR, blob-storage, Attachment | POST Ask orphan بـ LIMITED، `/extraction`، agent-search `attachmentIds`، ComposerAttachment حقول خادمية | MessageAttachmentRef → Attachment.id + معاينة | doc-node/QARI، استعادة جلسة المرفقات |

## 3) ما نُفِّذ

1. جسر `document-bridge.ts` + `complete-extraction.ts`
2. `POST /api/attachments/[id]/extraction`
3. رفع Ask يتيم (`relationType=اسأل`) بصلاحية LIMITED
4. عميل: رفع+إكمال بعد `extractFile` عند `NEXT_PUBLIC_…=1`
5. `agent-search` يحمّل نصوص المرفقات المملوكة عند العلم الخادمي
6. Adapter مراجع الرسائل + إرسال `sources`/`sourcePolicy`/`attachmentIds`
7. توافق خلفي: العلم off أو فشل الرفع → مسار inline السابق

## 4) ما لم يُنفَّذ (متعمد)

إعادة بناء OCR · Docling · استيراد روابط · ربط قضايا · هجين · استشهادات V2 · صوت · دمج مخزن JA

## 5) الاختبارات

| أمر | نتيجة |
|---|---|
| `test:composer-documents` | 20/20 |
| `test:document-inspection` | 84/84 |
| `test:source-policy` | 71/71 |
| `test:source-policy-e2e` | 16/16 |
| `test:hakeem-composer` | 40/40 |
| `test:runtime` | 20/20 |
| `test:intent-gate` | 17/17 |
| `tsc --noEmit` | ناجح |
| `lint` | ناجح |
| `build` | ناجح |

## 6) الملفات

- `lib/modules/hakeem-composer/document-bridge.ts`
- `lib/modules/hakeem-composer/persist-ask-attachment.ts`
- `lib/modules/hakeem-composer/types.ts`
- `lib/modules/attachments/complete-extraction.ts`
- `app/api/attachments/route.ts`
- `app/api/attachments/[id]/extraction/route.ts`
- `app/api/ai/agent-search/route.ts`
- `components/ask/HakeemAskWorkspace.tsx`
- `scripts/test-composer-documents.ts`
- `reports/hakeem-composer-documents-004-*.md`
- `.env.example` / `package.json`

## 7) المخاطر

- العلم معطّل افتراضيًا — يلزم تفعيل صريح للتجربة.
- TRAINEE يرفع Ask فقط (LIMITED)؛ ربط قضية ما زال FULL.
- فشل إكمال الاستخراج يترك Attachment=UPLOADED مع نص محلي في الطلب.
- لا اختبار HTTP حي ضد DB في هذه الجولة.

## 8) Rollback

`HAKEEM_COMPOSER_DOCUMENTS_V1=0` و`NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1=0` → سلوك Ask السابق (document inline).
