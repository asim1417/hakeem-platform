# التقرير الختامي — محرك رصد (Rasd)

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**البيئة:** Cloud Agent (بدون `DATABASE_URL`)

---

## 1. الملخص التنفيذي

تم بناء **محرك رصد** داخل منصة حكيم كطبقة مراقبة ومطابقة وتحديث منضبط للوثائق النظامية السعودية من ثلاثة مصادر رسمية (هيئة الخبراء، المركز الوطني للوثائق والمحفوظات، جريدة أم القرى)، مع منطقة مرحلية، مراجعة بشرية إلزامية افتراضيًا، ولوحة إدارة `/admin/rasd`، وأوامر CLI، وهجرة Prisma، واختبارات fixtures.

**لم يُكتب أي نص قانوني معتمد في مكتبة حكيم.**

---

## 2. الوضع السابق

- مكتبة قانونية عبر `legal_systems` / `legal_articles` / `article_amendments` / `article_versions`.
- مستوردات دفعية (hoqoqi / MOJ / nezams) بلا رصد مستمر.
- لا موصلات BOE/NCAR/UQN، لا جدولة أسبوعية، لا منطقة مرحلية للتحديث النظامي.

انظر: `rasd-recon-report.md`.

---

## 3. المعمارية المنفذة

```
المصادر الرسمية → Connectors (BOE/NCAR/UQN)
  → Snapshots + Fingerprints
  → Parse / Normalize / Identity
  → Staging (monitored_*)
  → Match / Diff / Conflict
  → Review UI/API
  → Apply (ArticleAmendment/ArticleVersion فقط بعد اعتماد)
  → Index refresh (مواد متأثرة فقط — مسار مُجهَّز)
```

المسار الأساسي: `lib/modules/rasd/`.

---

## 4. المصادر

| المصدر | الدور | حالة الوصول من هذه البيئة |
|---|---|---|
| UQN `www.uqn.gov.sa` | إثبات النشر | ✅ متاح (robots + sitemap + قرارات) |
| BOE `laws.boe.gov.sa` | النص المدمج | ❌ TLS reset / غير قابل للجلب الحي هنا |
| NCAR `ncar.gov.sa` | أرشفة وعلاقات | ❌ TLS reset / غير قابل للجلب الحي هنا |

الموصلات جاهزة مع fixtures ووضع `SOURCE_UNREACHABLE` عند الفشل. لا يُستبدل مصدر رسمي بمصدر غير رسمي.

---

## 5. المسح التأسيسي

### أ) Fixtures (مُنفَّذ ومُوثَّق)

الملف: `reports/rasd/baseline-fixtures-run.json`

- الوضع: dry-run + fixtures-only + memory-only
- الحالة: `COMPLETED`
- وثائق مكتشفة: **6**
- صفحات مجلبة: **6**
- تغييرات مرحلية: **6** (`NEW_DOCUMENT`)
- فشل: **0**
- تعارضات في هذا التشغيل: **0** (التعارض BOE×NCAR مغطى في اختبار الوحدة)

### ب) عيّنة حية من أم القرى (جزئية)

الملف: `reports/rasd/live-uqn-sample.json`

- مصدر واحد: UQN
- حد: 3 وثائق
- dry-run: true
- صفحات مجلبة: 3 — وثائق جديدة: 3 — فشل: 0
- **ليس** مسحًا تأسيسيًا كاملًا لكل المصادر/كل الوثائق

### ج) ما لم يُنفَّذ هنا

- مسح حي كامل لـ BOE و NCAR (محجوبان من هذه البيئة)
- مطابقة ضد قاعدة إنتاج حكيم (`DATABASE_URL` غائب)
- تطبيق تحديثات على `legal_*`

---

## 6. نتائج المطابقة

غير قابلة للاحتساب ضد إنتاج حكيم في هذه البيئة.

في وضع fixtures: كل الوثائق ظهرت كـ `NEW_DOCUMENT` / بلا مطابقة إنتاجية.

اختبار المطابقة الوحدوي: `PASS` (`npm run test:rasd`).

---

## 7. التغييرات المكتشفة (أمثلة fixtures)

- نظام المرافعات الشرعية (BOE)
- نسخة معدّلة تضيف مادة وتعدّل مادة 2 (كشف diff في الوحدة)
- نظام ملغى تجريبي (حالة إلغاء)
- وثيقة NCAR بنص مادة ثالثة مختلف (تعارض في الوحدة)
- نظام التعليم العام (عينة UQN محفوظة)

---

## 8. حالة قاعدة حكيم

| المقياس | القيمة |
|---|---|
| نسبة التغطية | N/A — لا اتصال بقاعدة الإنتاج |
| النقص / التكرار / التقادم | يتطلب تشغيل baseline مع `DATABASE_URL` بعد الهجرة |

انظر `reports/rasd/coverage-report.json`.

---

## 9. الاختبارات

```bash
RASD_ENABLED=true npm run test:rasd
# 9 PASS / 0 FAIL

RASD_ENABLED=true npm run test:rasd:integration
# PASS — fixtures baseline dry-run، بدون كتابة legal_articles
```

`npm run typecheck` نجح في مرحلة التسليم السابقة.

---

## 10. الأمان وعدم الكسر

- `RASD_REVIEW_REQUIRED=true` افتراضيًا.
- Feature flags: `RASD_ENABLED` (افتراضي false)، `RASD_SCHEDULER_ENABLED`، إلخ.
- لا حذف لنصوص قانونية قائمة.
- جداول رصد جديدة فقط (هجرة إضافية).
- Audit subject: `RASD`.
- صلاحيات: `RASD_VIEW|REVIEW|APPLY|ADMIN`.
- dry-run افتراضي للأوامر الخطرة في CLI.

---

## 11. القيود

1. BOE/NCAR غير قابلين للوصول من سحابة هذا الوكيل.
2. لا `DATABASE_URL` — لا مطابقة إنتاج ولا إصرار staging في Postgres هنا.
3. المسح التأسيسي الكامل الحي لم يُنفَّذ — فقط fixtures + عيّنة UQN محدودة.
4. OCR لـ PDF المصور مُسجَّل كاحتياج وليس تشغيلًا تلقائيًا للاعتماد.
5. الجدولة الأسبوعية مُجهَّزة عبر `/api/cron/rasd-weekly` + منطق cron؛ لم تُثبت على Vercel Cron في الإنتاج ضمن هذا التشغيل.

---

## 12. خطوات التشغيل (بيئة مصرّح بها)

```bash
# 1) تطبيق الهجرة
npx prisma migrate deploy
# أو: prisma migrate resolve / تطبيق SQL في prisma/migrations/20260727120000_add_rasd_monitoring

# 2) تفعيل الأعلام
RASD_ENABLED=true
RASD_BASELINE_ENABLED=true
RASD_AUTO_FETCH_ENABLED=true
RASD_REVIEW_REQUIRED=true
RASD_SCHEDULER_ENABLED=true   # عند الجاهزية
DATABASE_URL=...              # Neon المصرّح

# 3) مسح تأسيسي آمن
npm run rasd:baseline                 # dry-run + fixtures محليًا
npx tsx scripts/rasd/cli.ts baseline --dry-run --limit 50
# بعد المراجعة: أزل --dry-run فقط للـ staging (ليس للمكتبة المعتمدة)

# 4) اعتماد تحديث
npx tsx scripts/rasd/cli.ts apply-change --id <CHANGE_ID> --dry-run
npx tsx scripts/rasd/cli.ts apply-change --id <CHANGE_ID> --apply

# 5) لوحة الإدارة
/admin/rasd
```

الأدلة: `docs/rasd/OPERATIONS.md`, `ADD_SOURCE.md`, `RECOVERY.md`, `ROLLBACK.md`, `PARSER_REPAIR.md`.

---

## 13. التوصيات

1. تشغيل baseline حي من بيئة شبكة تصل إلى BOE/NCAR مع `DATABASE_URL`.
2. ضبط Vercel Cron على `/api/cron/rasd-weekly` مع `RASD_CRON_SECRET`.
3. ربط إشعارات Resend عبر `RASD_DIGEST_TO`.
4. تحسين مطابقة الأنظمة عبر تعبئة أرقام المراسيم على `legal_systems` أو فهرس أدوات الإصدار.
5. مراقبة صحة الموصلات أسبوعيًا من `/admin/rasd/sources`.

---

## بيان التنفيذ الصريح

| المطلوب | الحالة |
|---|---|
| تقرير الاستكشاف | ✅ `rasd-recon-report.md` |
| Schema + migration | ✅ |
| موصلات BOE/NCAR/UQN | ✅ (UQN حي جزئيًا؛ BOE/NCAR fixtures + unreachable) |
| تطبيع/تحليل/بصمات/فروقات/مطابقة/تعارض | ✅ |
| Baseline قابل للاستئناف (بنية) | ✅ |
| Baseline كامل حي لكل المصادر | ❌ مقيد بالشبكة/قاعدة البيانات |
| لوحة `/admin/rasd` | ✅ |
| مراجعة واعتماد + rollback | ✅ |
| جدولة أسبوعية (كود + مسار cron) | ✅ (لم تُثبت على إنتاج Vercel هنا) |
| إشعارات | ✅ digest ملف/بريد عند التوفر |
| اختبارات | ✅ وحدة + تكامل fixtures |
| توثيق | ✅ |
| عدم كسر المكتبة | ✅ لا كتابة legal_* |

---

## الملفات/الجداول الرئيسية

**هجرة:** `prisma/migrations/20260727120000_add_rasd_monitoring`

**جداول:** `monitoring_sources`, `monitoring_runs`, `source_snapshots`, `monitored_legal_documents`, `monitored_document_versions`, `monitored_provisions`, `legal_document_matches`, `legal_change_detections`, `source_conflicts`, `legal_update_reviews`, `rasd_document_types`, `rasd_run_locks` + قيمة `AuditSubject.RASD`.
