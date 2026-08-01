# تقرير إغلاق تحصين — Composer Documents Phase 2 (PR #594)

**التاريخ:** 2026-08-01 (جولة الإغلاق النهائي المحدود)  
**الفرع:** `cursor/composer-documents-da55`  
**PR:** [#594](https://github.com/asim1417/hakeem-platform/pull/594)  
**الحالة:** تحصين مكتمل — **لا Mark Ready · لا دمج · لا نشر · لا مرحلة ثالثة**

---

## 1. الفرق بين Local extraction وServer processing

| الحقل | المعنى |
|---|---|
| `localExtractionStatus` | نجاح/فشل `extractFile` في المتصفح فقط |
| `serverProcessingStatus` | `UPLOADED` / `QUEUED` / `EXTRACTING` / `READY`… من الخادم |
| `serverVerificationStatus` | `PREVIEW_ONLY` / `CLIENT_UNVERIFIED` / `SERVER_VERIFIED` |
| `status` (واجهة) | **مشتق** عبر `deriveComposerAttachmentStatus` — لا يُختزل إلى `ready` عند نجاح محلي + مرفق خادمي معلّق |

**قاعدة الإرسال (V2 + PROCESSING):**  
مع `serverAttachmentId` → `attachmentIds` فقط، **بلا** `document` inline.  
`CLIENT_PREVIEW` / Pending → الخادم يعيد `ATTACHMENT_NOT_READY`؛ النص المحلي لا يتجاوز ذلك.

## 2. متى يُسمح بـ CLIENT_FALLBACK

فقط عندما يقرر الخادم:

- `DOCUMENT_PROCESSING_V2` معطّل، **أو**
- doc-node غير مضبوط (`DOC_NODE_URL` / `DOC_TOOL_URL` فارغ)

عندها: `CLIENT_UNVERIFIED` + كتابة نص مسموحة.  
لاحقًا يمكن لـ doc-node الترقية إن وصل.  
`CLIENT_PREVIEW` = عرض فقط في `metadata.clientPreviewText` — **لا يدخل إجابة النموذج**.

## 3. إنفاذ محاذاة الأعلام في Runtime

- ترويسة: `x-hakeem-attachments-version: 2` (+ حقل `attachmentsVersion`)
- `decideAttachmentsRuntime` / `decideAgentSearchAttachmentsMode` في:
  - `POST /api/attachments`
  - `POST /api/attachments/[id]/extraction`
  - `POST /api/ai/agent-search`
- **CLIENT_V2_SERVER_LEGACY** → `409` قبل إنشاء attachmentId يبدو V2
- **SERVER_V2_CLIENT_LEGACY** → لا ادّعاء V2 للعميل؛ ids تُفرض خادميًا إن وُجدت وإلا legacy document

## 4. منع تسريب Graph token

`fetchGraphContentFollowingRedirects`:

1. الطلب الأول إلى `graph.microsoft.com` **فقط** يحمل `Authorization`
2. `302/303` إلى `*.sharepoint.com` → يُتبع **بلا** token
3. redirect خارجي / HTTP downgrade / حلقات → رفض

## 5. نوع Rate Limiter

| مزود | متى |
|---|---|
| `InMemoryAttachmentUploadRateLimiter` | تطوير/اختبارات — **ليس حماية إنتاج** |
| `PrismaAttachmentUploadRateLimiter` | خلف `HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED=1` + جدول `generic_rate_limit_windows` |

**إنتاج:** بدون الموزّع → `RATE_LIMITER_NOT_PRODUCTION_READY` ورفض مسار V2 (`assertAttachmentsV2RateLimitReady`).  
سكربت: `scripts/apply-generic-rate-limit-windows.ts`.

## 6. ما اختُبر حيًا وما اختُبر بعقود

| حي / بيئة كاملة | عقود / mocks |
|---|---|
| — لا HTTP حي لـ Vercel+DB+doc-node | قبول الإغلاق 29 · أعلام · سباق · Graph redirect traces · memory limiter · send-policy |
| build / tsc / lint | document-inspection · doc-node · source-policy · composer |

**صراحة:** ليست اختبارات End-to-End متصفحية حية.

## 7. نتائج الاختبارات (جولة الإغلاق النهائي)

| أمر | نتيجة |
|---|---|
| test:composer-attachments-closure | 29/29 |
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
| tsc / lint / build | ✅ |

## 8. المخاطر المتبقية

- جدول `generic_rate_limit_windows` يحتاج apply قبل تفعيل الموزّع في الإنتاج
- بلا DB حية: مسارات Prisma للـ limiter الموزّع لم تُثبت تكامليًا هنا
- صلاحية `ASK_ATTACHMENT_UPLOAD` قد تحتاج seed على بيئات قديمة
- لا Webhook HMAC · لا هجين · لا مرحلة ثالثة

## 9. الملفات الجديدة/المعدّلة (أبرزها)

- `attachment-send-policy.ts` · `attachments-version.ts`
- `upload-rate-limit.ts` (واجهة + memory/prisma)
- `sharepoint-download.ts` (Auth على Graph فقط)
- `HakeemAskWorkspace.tsx` · مسارات attachments / extraction / agent-search
- `prisma` + `apply-generic-rate-limit-windows.ts`
- `scripts/test-composer-attachments-closure.ts`
