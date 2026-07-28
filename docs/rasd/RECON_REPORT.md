# تقرير استكشاف محرك رصد — Rasd Recon Report

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**المستودع:** `asim1417/hakeem-platform`

---

## 1. الوضع الحالي

منصة حكيم تعمل على **Next.js 14.2** + **TypeScript 5.7** + **Prisma 5.22** + **PostgreSQL / Neon** مع `pgvector`.

المكتبة القانونية الحالية:

| الجدول | الدور |
|---|---|
| `legal_systems` | الأنظمة بالاسم/التصنيف/`eli_slug` — **بدون** مصدر رسمي أو حالة نفاذ أو أداة إصدار على مستوى النظام |
| `legal_articles` | المواد (`content`, `chapter`, `status`, `royalDecree`, `effectiveFrom`) |
| `article_amendments` | سجل أحداث التعديل (نص سابق/لاحق، مرسوم، مراجعة) |
| `article_versions` | نسخ زمنية Akoma-Ntoso-style للنص الساري |
| `legal_graph_nodes/edges` | علاقات لوائح/إجراءات |
| `embeddings` + `search_norm` | فهرسة دلالية ونصية |

**لا يوجد** محرك رصد تشريعي، ولا موصلات BOE/NCAR/UQN، ولا جداول مراقبة، ولا جدولة أسبوعية، ولا منطقة مرحلية للتحديث النظامي.

أقرب ما يمكن إعادة استخدامه:

- `ArticleAmendment` / `ArticleVersion` لتطبيق التحديثات المعتمدة فقط.
- `normalizeArabicText` في `lib/modules/legal-core/arabic-morphology.ts`.
- `auditEvent` + RBAC (`LEGAL_CORE_*`) + FeatureToggle.
- سكربتات استيراد (hoqoqi / MOJ / nezams) كنمط جلب دفعي — **ليست** رصدًا مستمرًا.
- تخزين Azure Blob / SharePoint للقطات الكبيرة.
- `alertsEnabled` + Resend للإشعارات لاحقًا.

---

## 2. الجداول الحالية ذات الصلة

موديلات Prisma ذات الصلة بالرصد (47 موديل إجماليًا):

`LegalSystem`, `LegalArticle`, `ArticleAmendment`, `ArticleVersion`, `LegalRelation`, `LegalGraphNode`, `LegalGraphEdge`, `Embedding`, `AuditEvent`, `FeatureToggle`, `User`, `RoleRecord`, `PermissionRecord`, …

هجرات قانونية مهمة: `20260623120000_add_article_amendments`, `20260625160000_add_article_versions`, `20260703120000_add_legal_graph`, `20260712120000_search_performance_indexes`.

**فجوة حرجة:** `LegalSystem` لا يحمل `sourceUrl` / `instrumentNumber` / `status` / `ummAlQuraIssue` — المطابقة ستعتمد على الاسم + `royalDecree` على المواد + مفتاح هوية مركّب من الرصد.

---

## 3. الفجوات

1. لا سجل مصادر رسمية (`monitoring_sources`).
2. لا تشغيلات مسح / استئناف / قفل تزامن.
3. لا لقطات خام (snapshots) مع بصمات.
4. لا وثائق مرصودة منفصلة عن مكتبة الإنتاج.
5. لا محرك مطابقة/فروقات/تعارضات.
6. لا مسار اعتماد قبل الكتابة في `legal_*`.
7. لا جدولة (لا `node-cron` / GitHub schedule / Vercel cron في المستودع).
8. لا لوحة `/admin/rasd`.
9. لا صلاحيات RBAC مخصّصة لرصد (سيتم إسقاطها على `LEGAL_CORE_*` + أعلام بيئة + أدوار إدارية).
10. BOE و NCAR **غير قابلين للوصول** من بيئة هذا الوكيل (TLS reset / WAF). UQN متاح.

---

## 4. المخاطر

| خطر | التخفيف |
|---|---|
| الكتابة العرضية في نصوص الإنتاج | `RASD_REVIEW_REQUIRED=true` افتراضيًا؛ منطقة مرحلية فقط؛ dry-run افتراضي للأوامر الخطرة |
| كسر البحث/embeddings | التحديث المعتمد يُعيد فهرسة المواد المتأثرة فقط بعد اعتماد صريح |
| حظر المصادر / robots | User-Agent واضح، rate limit، احترام robots.txt، عزل الموصلات |
| تغير HTML للمواقع | إصدار parser + fixtures + درجة ثقة + مراجعة بشرية |
| ازدواجية الحقيقة | رصد ≠ مكتبة؛ لا مصدر حقيقة موازٍ |
| غياب `DATABASE_URL` في بيئة البناء | تنفيذ البنية + اختبارات fixtures؛ أوامر تشغيل للبيئة المصرّح بها |
| BOE/NCAR محجوبان من هذا السحاب | موصلات جاهزة + fixtures + تسجيل `SOURCE_UNREACHABLE`؛ المسح الحي من بيئة مصرّح بها |

---

## 5. خطة التعديل

### المرحلة 1 — الأساس
جداول رصد جديدة + migration + Source Registry + Run Manager + Snapshot store + Audit subject `RASD`.

### المرحلة 2 — الموصلات
`boe` / `ncar` / `uqn` مع rate limit و retry و fixtures.

### المرحلة 3 — التطبيع والتحليل
Arabic/Date normalizer، structure parser، fingerprints، PDF pipeline خفيف (pdfjs موجود).

### المرحلة 4 — المطابقة والمقارنة
Identity key، match engine، diff، conflicts.

### المرحلة 5 — Baseline آمن
مسح تأسيسي قابل للاستئناف؛ لا تحديث إنتاج.

### المرحلة 6 — لوحة `/admin/rasd`

### المرحلة 7 — اعتماد + versioning + rollback

### المرحلة 8 — جدولة أسبوعية + إشعارات + مقاييس

---

## 6. الملفات المتوقع تعديلها / إنشاؤها

```
rasd-recon-report.md
prisma/schema.prisma                          (+ نماذج رصد)
prisma/migrations/20260727120000_add_rasd_monitoring/
lib/modules/rasd/**                           (المحرك كاملًا)
app/admin/rasd/**                             (لوحة الإدارة)
app/api/admin/rasd/**                         (API)
scripts/rasd/**                               (أوامر CLI)
data/rasd/fixtures/**                         (عينات اختبار)
docs/rasd/**                                  (أدلة التشغيل)
reports/rasd/**                               (تقارير تشغيل)
.env.example                                  (+ أعلام RASD_*)
package.json                                  (+ scripts)
components/admin/AdminNav.tsx                 (+ رابط رصد)
lib/modules/auth/role-permissions.ts          (+ RASD_*)
```

---

## 7. المهاجرات المطلوبة

هجرة واحدة رئيسية: `20260727120000_add_rasd_monitoring`

جداول جديدة (لا تعديل جداول المكتبة المركزية):

- `monitoring_sources`
- `monitoring_runs`
- `source_snapshots`
- `monitored_legal_documents`
- `monitored_document_versions`
- `monitored_provisions`
- `legal_document_matches`
- `legal_change_detections`
- `source_conflicts`
- `legal_update_reviews`
- `rasd_document_types` (أنواع وثائق قابلة للإدارة)
- `rasd_run_locks`

توسيع `AuditSubject` بقيمة `RASD` إن أمكن عبر enum migration آمنة.

---

## 8. نقاط التوافق مع معمارية حكيم

- Repository pattern داخل `lib/modules/rasd/`.
- Prisma أولًا؛ لا SQL في المكوّنات.
- العربية + RTL في لوحة الإدارة.
- Claude للمساعدة فقط (اقتراح مطابقة/تلخيص) — ممنوع اعتماد تحديث.
- Feature flags عبر env (+ اختياريًا FeatureToggle UI).
- Audit عبر `auditEvent`.
- تطبيق التحديث المعتمد يكتب فقط عبر `ArticleAmendment`/`ArticleVersion` داخل Transaction.

---

## 9. ما يمكن إعادة استخدامه

| مكوّن | المسار |
|---|---|
| تطبيع عربي أساسي | `arabic-morphology.ts` |
| تدقيق | `audit.ts` |
| RBAC / admin shell | `session.ts`, `AdminPageShell` |
| تخزين ملفات | `blob-storage.ts` |
| PDF | `pdfjs-dist`, `pdf-lib`, `tesseract.js` |
| إصدارات المواد | `article-versions.ts` |
| بريد | `email/send.ts` |
| نمط سكربتات | `scripts/*.ts` عبر `tsx` |

---

## 10. ما يجب بناؤه من جديد

محرك رصد كامل: مصادر، تشغيلات، لقطات، وثائق مرصودة، مواد مرصودة، مطابقة، فروقات، تعارضات، مراجعات، موصلات ثلاثة، جدولة، لوحة، تقارير، CLI، اختبارات fixtures.

---

## 11. نتائج فحص المصادر الرسمية (حي)

### جريدة أم القرى — `www.uqn.gov.sa` ✅ متاح

- `robots.txt`: يسمح لـ `*` مع منع `/*page=` و `/ajax/`؛ يشير إلى `sitemap_0.xml`.
- أقسام مفيدة: `/Decisions`, `/decisions/royal-decrees`, `/decisions/rules-and-regulations`, …, `/Archive`.
- تفاصيل الوثائق: `/decisions-and-regulations/{id}` مع JSON-LD (`NewsArticle`).
- خرائط مواقع شهرية تحت `/sitemaps/{year}/{month}/sitemap_0.xml`.
- لا API JSON رسمي واضح في الصفحة؛ الاعتماد على sitemap + HTML منظم + JSON-LD.

### هيئة الخبراء — `laws.boe.gov.sa` ❌ غير متاح من هذه البيئة

- DNS يحل إلى `66.9.136.215`.
- TLS: `Connection reset by peer` / لا شهادة نظير.
- الموصل سيُبنى بهياكل URL المعروفة + fixtures + حالة `SOURCE_UNREACHABLE`.

### المركز الوطني — `ncar.gov.sa` ❌ غير متاح من هذه البيئة

- DNS: `66.9.128.33`؛ نفس سلوك TLS reset.
- نفس استراتيجية الموصل.

### قاعدة البيانات

- `DATABASE_URL` / `NEON_DATABASE_URL` **غير مضبوطين** في بيئة هذا الوكيل.
- المسح التأسيسي الحي ضد إنتاج حكيم **لن يُدّعى** هنا؛ يُوفَّر أمر تشغيل + وضع fixtures/dry-run.

---

## 12. قرار التنفيذ

لا مانع تقني جوهري يمنع بناء الطبقة داخل المستودع.  
الموانع التشغيلية (BOE/NCAR محجوبان، لا DATABASE_URL) تُوثَّق صراحةً وتُعالَج عبر fixtures + أوامر للبيئة المصرّح بها.

**الخطوة التالية:** المرحلة 1 — Schema + محرك الأساس، دون أي كتابة في نصوص المكتبة المعتمدة.


## Addendum — readiness pass (2026-07-27)

See `docs/rasd/reports/READINESS_VERIFICATION_REPORT.md`. SSRF/RBAC/cron code closed partially; BOE/NCAR still unreachable from Codex; decision remains NOT READY.
