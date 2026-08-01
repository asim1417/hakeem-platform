# تقرير إغلاق تحصين — Composer Documents Phase 2 (PR #594)

**التاريخ:** 2026-08-01  
**الفرع:** `cursor/composer-documents-da55`  
**PR:** [#594](https://github.com/asim1417/hakeem-platform/pull/594)  
**الحالة:** تحصين مكتمل للاختبار — **لا Mark Ready · لا دمج · لا نشر · لا مرحلة ثالثة**

---

## 1. توحيد الأعلام

- مصدر القرار: `lib/modules/hakeem-composer/document-flags.ts`
- `isComposerAttachmentClientPersistEnabled()` = `NEXT_PUBLIC_ATTACHMENTS_V2` **أو** `NEXT_PUBLIC_DOCUMENTS_V1`
- V2 **لا يشترط** DOCUMENTS_V1
- `alignClientServerDocumentFlags()` يمنع `enforceV2` عندما يبدو العميل V2 والخادم Legacy
- DOCUMENTS_V1 توافق خلفي فقط

## 2. مصدر الحقيقة بين browser وdoc-node

| شرط | المصدر النهائي |
|---|---|
| `DOCUMENT_PROCESSING_V2` + doc-node متاح/نشط | **doc-node**؛ المتصفح معاينة فقط |
| doc-node غير متاح أو المعالجة معطّلة | `CLIENT_FALLBACK` / `CLIENT_UNVERIFIED` مع سبب |
| اكتمال doc-node لاحقًا | ترقية/استبدال مسموح لـ Job الحالي فقط |

## 3. Provenance

```
SERVER_LOCAL | SERVER_GEMINI | SERVER_QARI | CLIENT_PREVIEW | CLIENT_FALLBACK
```

الخادم يحدد: extractionEngine، provider، model، confidence، verificationStatus.  
`POST /extraction` يتجاهل engine/confidence من العميل ويقيّد Ask + حد النص.

## 4. منع السباق

- `decideClientExtractionWrite` / `decideServerJobWrite`
- `docNodeJobId` + `docNodeGeneration` / `docNodeCompletedGeneration`
- Job قديم بعد forceReprocess → رفض `STALE_JOB_ID`
- المعاينة في `metadata.clientPreviewText` دون كتابة `extractedText` النهائي

## 5. pageRange الحقيقي

- `read-attachment-pages.ts` + تحميل `metadata.pages` في AgentContext
- تحقق from/to صحيحين وضمن المستند
- إرجاع pageNumber/text/status/confidence/warning
- queryHint حتمي بسيط (بلا هجين)
- بلا صفحات → نص مجمّع + تحذير دون ادّعاء رقم صفحة
- `auditedPageReads` في السياق (أرقام فقط)

## 6. ترتيب أخطاء المرفقات

قوائم: missing / forbidden / pending / failed / quarantined / partial / ready  
`hasAttachmentReference` ≠ `hasReadyAttachmentContent`  

ترتيب attached-only:  
1 FORBIDDEN → 2 REQUIRES_ATTACHMENT → 3 QUARANTINED → 4 PROCESSING_FAILED → 5 NOT_READY → PARTIAL مسموح

## 7. المصادقة وRate Limit

ترتيب POST `/api/attachments`:  
جلسة → Content-Length مبكر → Rate limit → FormData → صلاحية → تحقق بايتات  

**قرار موثّق:** `ATTACHMENTS_LIMITED` = عرض/تنزيل.  
رفع Ask = `ASK_ATTACHMENT_UPLOAD` (FULL يغطيها عبر RBAC).

## 8. حماية SharePoint

- `sharepoint-download.ts`: بناء Graph `/content` من storageKey
- رفض webUrl العام مع Authorization
- `fetchWithAuthNoExternalRedirect` يمنع redirect خارج allowlist
- لا SSRF عبر metadata.storageUrl

## 9. الاختبارات ونتائجها

| أمر | نتيجة |
|---|---|
| test:document-flags | 19/19 |
| test:extraction-race | 32/32 |
| test:composer-attachments-contract | 13/13 |
| test:composer-attachments-v2 | 24/24 |
| test:composer-documents | 20/20 |
| test:attachments-regression | 28/28 |
| test:document-inspection | 84/84 |
| test:doc-node | 7/7 |
| test:source-policy | 71/71 |
| test:source-policy-e2e | 16/16 |
| test:hakeem-composer | 40/40 |
| test:intent-gate | 17/17 |
| test:runtime | 20/20 |
| tsc --noEmit | ✅ |
| lint | تحذيرات قديمة فقط (لا حجب) |
| build | ✅ |

## 10. ما اختُبر حيًا وما اختُبر بعقود

| حي / بيئة كاملة | عقود / mocks / فحص مصدر |
|---|---|
| — لا HTTP حي لـ Vercel+DB+doc-node في هذه الجولة | مصفوفة الأعلام، السباق، الصفحات، التصنيف، SharePoint URL، rate limit، read_attachment، regression مصدر المسارات |
| doc-node unit (خدمات محلية) | محاكاة دورة upload→queue→sync→read كعقد |

**صراحة:** ليست اختبارات End-to-End متصفحية حية.

## 11. المخاطر المتبقية

- بدون DB اختبارية حية: مسارات Prisma في complete/sync لم تُثبت تكامليًا على بيانات حقيقية هنا
- Webhook HMAC ما زال مؤجّلًا (polling)
- TRAINEE يحتاج منح `ASK_ATTACHMENT_UPLOAD` في بيئات DB قديمة (البذرة محدّثة؛ قد يلزم seed/migrate صلاحيات)
- queryHint حتمي بسيط — ليس بحثًا هجينًا
- Content-Length قد يغيب عن بعض الوكلاء؛ التحقق الحقيقي بعد البايتات يبقى

## 12. الملفات المعدّلة (أبرزها)

- `lib/modules/hakeem-composer/document-flags.ts` (جديد)
- `lib/modules/attachments/extraction-provenance.ts` (جديد)
- `lib/modules/attachments/attachment-classify.ts` (جديد)
- `lib/modules/attachments/read-attachment-pages.ts` (جديد)
- `lib/modules/attachments/sharepoint-download.ts` (جديد)
- `lib/modules/attachments/upload-rate-limit.ts` (جديد)
- `lib/modules/attachments/complete-extraction.ts`
- `lib/modules/attachments/document-processing-adapter.ts`
- `lib/modules/attachments/blob-storage.ts`
- `lib/modules/hakeem-composer/document-bridge.ts` / `persist-ask-attachment.ts`
- `lib/modules/hakeem-agent/tools.ts` / `runtime.ts`
- `app/api/attachments/route.ts` / `[id]/extraction/route.ts`
- `app/api/ai/agent-search/route.ts`
- `lib/modules/auth/role-permissions.ts` / `rbac.ts` / `role-admin.ts`
- `components/ask/HakeemAskWorkspace.tsx` / `AdminUsersManager.tsx`
- اختبارات + docs + هذا التقرير

---

**خارج النطاق (متعمد):** Webhook HMAC كامل · جدول Pages · هجين · embeddings · استشهادات V2 · صوت · قضايا كاملة · OCR جديد · Dashboard
