# تقرير إكمال الجاهزية التشغيلية — PR #511

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/511  
**هل حُوِّل Draft→Ready؟** لا  
**القرار:** **NOT READY**

---

## 0) إجابة مباشرة على سؤال التنفيذ

الأمر السابق («إكمال الجاهزية…») **لم يكن منفّذًا** عند السؤال.  
هذه الجولة نفّذت إغلاقًا جزئيًا للموانع على نفس الفرع، دون دمج ودون Ready.

---

## 1) بيئة Preview المستخدمة

| البند | القيمة |
|---|---|
| الاسم | `local-postgres-rasd_preview` |
| النوع | PostgreSQL 16 محلي معزول + pgvector |
| Neon Preview URL | **غير متوفر** في أسرار هذه البيئة (`DATABASE_URL`/`NEON_*` للإنتاج unset) |
| هل هي إنتاج حكيم؟ | **لا** |

### نتيجة migration

| الخطوة | النتيجة |
|---|---|
| `prisma validate` | ✅ |
| `prisma migrate deploy` من قاعدة فارغة | ❌ يفشل على الهجرة الأولى التاريخية (`legal_articles` غير موجودة قبل شجرة الهجرات) — فجوة تاريخية سابقة للـPR |
| `prisma db push` على `rasd_preview` | ✅ schema كامل متزامن |
| إعادة تطبيق SQL لهجرة رصد | ✅ idempotent (IF NOT EXISTS) |
| `prisma migrate status` بعد resolve | Database schema is up to date |
| كتابة جداول رصد | ✅ (seed/run/change) |
| apply/rollback على Preview المحلي | ✅ `allPass` |

---

## 2) SSRF remediation

**الحالة: CLOSED (مختبر وحديًا)**

- طبقة مركزية: `lib/modules/rasd/connectors/url-guard.ts`
- `rasdFetch` يعيد فحص كل redirect يدويًا، HTTPS فقط، allowlist، منع userinfo/IP/منافذ غير 443، حد حجم 8MiB، timeout، بدون cookies/authorization
- اختبارات رفض: localhost / 127.0.0.1 / 169.254.169.254 / file / ftp / نطاق خارجي / userinfo / منفذ 8443 → DENY
- `https://www.uqn.gov.sa/` → ALLOW

---

## 3) RBAC

**الحالة: CLOSED (مصفوفة + بوابات خادم)**

- صفحات `/admin/rasd*` → `RASD_VIEW`
- GET APIs → `RASD_VIEW`
- reviews POST → `RASD_REVIEW`
- runs POST / sources PATCH / rollback → `RASD_ADMIN`
- apply POST → `RASD_APPLY`
- `scripts/rasd/test-rasd-rbac.ts` → PASS لأدوار TRAINEE/LAWYER/TRAINER/SYSTEM_ADMIN

ملاحظة: `SYSTEM_ADMIN`/`SUPER_ADMIN` يتجاوزان المصفوفة عبر `canUser` كما في منصة حكيم أصلًا.

---

## 4) Cron

**الحالة: PARTIALLY CLOSED**

- `vercel.json` يسجّل جدولة أسبوعية
- المساران: `/api/cron/rasd/weekly` و`/api/cron/rasd-weekly`
- الجدول: `0 0 * * 6` UTC = السبت 03:00 Asia/Riyadh (UTC+3، بلا DST) — موثّق في `docs/rasd/CRON.md`
- حماية سر + timingSafeEqual + تخطي Preview ما لم `RASD_ALLOW_PREVIEW_CRON=true` + `RASD_SCHEDULER_ENABLED`
- weekly يبقى `dryRun: true` (لا اعتماد تلقائي)
- **لم يُختبر على Vercel الحقيقي** من هذه البيئة

---

## 5–7) نتائج المصادر (حي)

من `docs/rasd/reports/live-source-probe.json` (بعد إصلاح فهرس UQN):

| المصدر | DNS | TCP | TLS | HTTP | وثائق (حد 10) |
|---|---|---|---|---|---|
| BOE | OK | OK | **FAIL ECONNRESET** | FAIL | 0 |
| NCAR | OK | OK | **FAIL ECONNRESET** | FAIL | 0 |
| UQN | OK | OK | OK | 200 | **10/10 قرارات** |

GitHub Actions workflow موجود (`.github/workflows/rasd-source-health.yml`) لكن **لا يمكن تشغيله قبل وجوده على default branch** (`gh workflow run` → 404).  
لذلك: **لم يُثبت نجاح BOE/NCAR من بيئة نشر بعد.**

تصنيف الموصلات: BOE/NCAR = **DEGRADED/UNREACHABLE من بيئة Codex الحالية**؛ الخطة البديلة موثقة (Vercel/GHA) وغير مُثبتة النجاح بعد.

---

## 8) المقارنة مع حكيم Preview

`docs/rasd/reports/preview-live-compare.json`

- مكتبة Preview المحلية تحتوي نظامًا تجريبيًا واحدًا فقط (`نظام تحقق رصد التجريبي`)
- فُحصت **10 وثائق UQN حية**
- exact/probable/ambiguous = **0**
- noMatch = **10**
- parser anomalies (تحذيرات) = **4**

هذه أرقام حقيقية للمقارنة ضد Preview المحلي الحالي — **وليست** تغطية مكتبة إنتاج حكيم (لا نسخة Neon مستوردة).

---

## 9) apply/rollback

على `rasd_preview`: ✅  
`docs/rasd/reports/preview-db-apply-rollback.json` (نسخ من verify-apply-rollback)

- منع قبل الاعتماد ✅
- نسخة جديدة + حفظ السابقة ✅
- rollback يستعيد الحالية ✅
- Audit قد يفشل FK إن لم يوجد المستخدم (يُبلع) — متبقٍ جزئيًا

---

## 10) الاختبارات

| الأمر | النتيجة |
|---|---|
| `test:rasd` | 12 PASS |
| `test:rasd-rbac` | PASS |
| `typecheck` | PASS |
| `build` | PASS |
| `lint` | غير حاسم (لا ESLint config؛ سابق للـPR) |
| Neon production compare | لم يُنفَّذ |

---

## 11) المشاكل المتبقية (OPEN)

1. BOE/NCAR غير ناجحين من أي بيئة نشر مُثبتة.
2. لا Neon Preview سحابي؛ البديل محلي فقط.
3. `migrate deploy` من صفر يفشل بسبب فجوة تاريخية في شجرة الهجرات (قبل رصد).
4. Cron غير مُتحقق على Vercel الحي.
5. مقارنة مكتبة حقيقية (dump حكيم) غير متاحة.
6. Workflow GHA غير قابل للتشغيل حتى يُدمج/يُنسخ إلى default branch.

---

## 12) جدول الموانع

| المانع | الحالة |
|---|---|
| Preview DB + migration | **PARTIALLY CLOSED** (db push + rasd SQL؛ ليس Neon؛ migrate deploy من فارغ فاشل تاريخيًا) |
| SSRF | **CLOSED** |
| RBAC | **CLOSED** |
| Cron registration/protection | **PARTIALLY CLOSED** |
| UQN live | **CLOSED** (10/10) |
| BOE live from deploy env | **OPEN** |
| NCAR live from deploy env | **OPEN** |
| مقارنة حية مع بيانات حكيم غنية | **PARTIALLY CLOSED** (Preview محلي فقير: 10 noMatch) |
| apply/rollback على Preview | **CLOSED** (محلي) |
| عدم الكتابة في الإنتاج | **CLOSED** |

---

## 13) القرار

### NOT READY

سبب حاكم: لم يتحقق شرط «BOE وNCAR ناجحان من بيئة نشر واحدة على الأقل»؛ والخطة البديلة (GHA/Vercel) لم تُثبت نجاحًا بعد. كذلك لا توجد مقارنة ضد نسخة غنية من مكتبة حكيم.
