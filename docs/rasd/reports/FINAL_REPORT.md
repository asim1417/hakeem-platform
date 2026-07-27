# التقرير الختامي المحدّث — تحقق تشغيلي صارم لـ PR #511

**التاريخ:** 2026-07-27  
**الفرع:** `cursor/rasd-legislative-monitoring-97b5`  
**الـPR:** https://github.com/asim1417/hakeem-platform/pull/511  
**قرار الدمج:** **NOT READY**

> **تحديث جاهزية لاحق:** نُفّذت جولة إغلاق موانع (SSRF/RBAC/cron/UQN). التفاصيل في `READINESS_VERIFICATION_REPORT.md`. القرار ما زال **NOT READY** بسبب BOE/NCAR وغياب Neon Preview السحابي.


> لم يُدمج الـPR ولم يُحوَّل إلى Ready for Review.

---

## 1. ما بُني فعليًا

محرك رصد staging داخل حكيم:

- `lib/modules/rasd/**` — موصلات، تطبيع، تحليل، مطابقة، فروقات، تعارض، مسح، مراجعة، اعتماد، rollback، جدولة، تقارير
- هجرة `prisma/migrations/20260727120000_add_rasd_monitoring`
- لوحة `/admin/rasd/*`
- API `/api/admin/rasd/*` + `/api/cron/rasd-weekly`
- CLI `scripts/rasd/cli.ts`
- أعلام `RASD_*` وRBAC catalog `RASD_VIEW|REVIEW|APPLY|ADMIN`

### جدول مراجعة التغييرات (ملخص)

| الملف / المجموعة | سبب التعديل | ضروري؟ | أثر على وظائف حكيم الحالية؟ | الخطورة | نتيجة المراجعة |
|---|---|---|---|---|---|
| `lib/modules/rasd/**` | محرك الرصد | نعم | لا مباشرة (معزول بعلم) | متوسطة | مقبول مع فجوات أمان (SSRF/صلاحيات) |
| `prisma/schema.prisma` + migration | جداول staging + `AuditSubject.RASD` | نعم | إضافي فقط إن طُبقت الهجرة | متوسطة | آمن إن طُبقت على Preview أولًا |
| `app/admin/rasd/**` | لوحة الإدارة | نعم | لا | منخفضة | محمية بـ `/admin` + `ADMIN_REPORTS_VIEW` (ليس `RASD_*`) |
| `app/api/admin/rasd/**` | API إدارة | نعم | لا | متوسطة | gated لكن بمفاتيح صلاحية خاطئة نسبيًا |
| `app/api/cron/rasd-weekly` | جدولة | نعم | لا إن بقي معطلًا | متوسطة | سر مطلوب؛ لا vercel.json؛ لا preview guard |
| `scripts/rasd/**` | CLI/اختبارات | نعم | لا | منخفضة | يعمل |
| `components/admin/AdminNav.tsx` | رابط رصد | نعم | تنقّل إداري فقط | منخفضة | OK |
| `lib/modules/auth/role-permissions.ts` + `role-admin.ts` | صلاحيات RASD | نعم | يوسع catalog | منخفضة | معرفّة لكن غير موصولة للبوابات |
| `components/AdminUsersManager.tsx` | تسميات RASD + CRLF→LF | جزئيًا | عرض صلاحيات فقط | منخفضة | ليس إعادة منطق؛ إعادة أسطر + 4 تسميات |
| `.gitignore` | تجاهل snapshots/reports | نعم | لا | منخفضة | OK (+ تغيير نهايات أسطر) |
| `.env.example` | توثيق أعلام RASD | نعم | لا | منخفضة | OK |
| `package.json` | سكربتات rasd | نعم | لا | منخفضة | OK |
| `data/rasd/fixtures/**` | fixtures | نعم للاختبار | لا | منخفضة | OK |
| `docs/rasd/**` | توثيق/تقارير | نعم | لا | منخفضة | OK |
| `rasd-recon-report.md` | استكشاف | نعم | لا | منخفضة | OK |

---

## 2. ما تم اختباره على fixtures

| الاختبار | النتيجة |
|---|---|
| `npm run test:rasd` | **9 PASS / 0 FAIL** |
| `npm run test:rasd:integration` | **PASS** (6 وثائق، dry-run، memory، بدون كتابة legal_*) |
| كشف فرق مادة مضافة/معدّلة بين BOE fixtures | PASS |
| تعارض BOE×NCAR في الوحدة | PASS |

**تحذير حاكم:** نتائج fixtures ليست أرقام رصد حقيقية.

---

## 3. ما تم اختباره حيًا

### تشخيص TLS (أوامر فعلية)

الملفات: `docs/rasd/reports/tls-diagnosis.json`, `tls-diagnosis-raw.txt`

| المصدر | DNS | TCP:443 | TLS handshake | HTTP | الخلاصة |
|---|---|---|---|---|---|
| `laws.boe.gov.sa` | `66.9.136.215` | OK | **RESET بعد ClientHello** (TLS1.2/1.3/default، curl، Node) | لا | حظر شبكة/WAF على مسار هذه البيئة؛ ليس مشكلة User-Agent |
| `ncar.gov.sa` | `66.9.128.33` | OK | **نفس نمط RESET** | لا | نفس الفئة |
| `www.uqn.gov.sa` | `212.138.183.159` | OK | TLSv1.3 شهادة DigiCert `*.uqn.gov.sa` | **200** | متاح |

IP عامة لبيئة الوكيل (مرصودة): حوالي AWS `3.217.89.139` / `184.72.144.40`.

لا تحايل على CAPTCHA/WAF.

### مسح حي محدود (dry/memory، بلا مقارنة حكيم)

الملف: `docs/rasd/reports/live-verification-probe.json`

| المصدر | المطلوب | النتيجة |
|---|---|---|
| UQN | 10 وثائق | **10 مكتشفة، 10 مجلبة بنجاح، 0 أخطاء جلب** |
| BOE | 10 وثائق | **فشل discover/health: fetch failed / ECONNRESET** |
| NCAR | 10 وثائق | **فشل discover/health: fetch failed / ECONNRESET** |

لكل وثيقة UQN ناجحة سُجّل: source, URL, identifier, title, hashes, parseConfidence, provisions, warnings.  
`matchCandidateInHakeem` و`matchScore` = null لأن `DATABASE_URL` للإنتاج غير متوفر.

ملاحظة جودة: كثير من وثائق UQN حملت تحذير `instrument number not extracted` رغم ظهور رقم المرسوم في العنوان أحيانًا — فجوة parser تحتاج إصلاحًا لاحقًا (خارج نطاق هذا التحقق إن لم تُطلب إصلاحات).

---

## 4. ما تم اختباره ضد قاعدة حكيم

**لا شيء ضد إنتاج Neon.**

- `DATABASE_URL` / `NEON_DATABASE_URL` في بيئة الوكيل: **غير مضبوطين**.
- لذلك: **لا أرقام مقارنة حية** ضد مكتبة حكيم الإنتاجية.

### بديل معزول (ليس إنتاجًا)

أُنشئت قاعدة محلية `rasd_verify` على PostgreSQL 16 + pgvector:

- `prisma validate` ✅
- `prisma db push` على القاعدة المعزولة ✅ (مزامنة schema بما فيها جداول رصد)
- `prisma migrate status` أظهر 22 هجرة غير مطبّقة على القاعدة الفارغة (متوقع قبل deploy)
- اختبار اعتماد/rollback على بيانات تجريبية فقط: **allPass=true**  
  الملف: `docs/rasd/reports/apply-rollback-isolated.json`

أوامر التشغيل على Neon Preview بعد توفير السرّ (دون طباعة السر):

```bash
# Preview DB فقط — لا إنتاج
export DATABASE_URL="<NEON_PREVIEW_URL>"
npx prisma migrate status
npx prisma migrate deploy   # على Preview فقط بعد مراجعة
RASD_ENABLED=true RASD_BASELINE_ENABLED=true RASD_AUTO_FETCH_ENABLED=true \
  RASD_REVIEW_REQUIRED=true RASD_FIXTURES_ONLY=false \
  npx tsx scripts/rasd/cli.ts baseline --dry-run --limit 10 --source BOE,NCAR,UQN
```

---

## 5. ما لم يمكن اختباره

1. مسح حي لـ BOE/NCAR من هذه البيئة.
2. مقارنة read-only حية مع إنتاج حكيم.
3. أرقام التغطية/الفجوات الحقيقية للمكتبة.
4. `prisma migrate deploy` على Neon Preview/إنتاج (لا بيانات اتصال مصرّح بها هنا).
5. تشغيل Vercel Cron فعليًا (لا `vercel.json`، ولا إثبات جدولة منصّة).
6. `next lint` الحقيقي (لا يوجد config ESLint؛ الأمر فتح معالج إعداد تفاعلي).

---

## 6. سبب كل تعذر

| التعذر | السبب المثبت |
|---|---|
| BOE/NCAR | بعد اتصال TCP ناجح يُرسل ClientHello ثم يُغلق الاتصال (ECONNRESET) من الطرف المقابل/المسار؛ مستقل عن UA |
| مقارنة حكيم | غياب `DATABASE_URL` في بيئة الوكيل |
| Cron على Vercel | لا تسجيل cron في المستودع |
| Lint | غياب إعداد ESLint في المشروع |

---

## 7. نتائج المصادر الثلاثة

### UQN — نجاح جزئي حي
- health 200
- 10/10 جلب في الفحص المحدود
- snapshots محلية تحت `data/rasd/snapshots/` (gitignored)

### BOE — فشل حي هنا
- موصل موجود + fixtures تعمل في الاختبارات
- الحي: unreachable من هذه البيئة

### NCAR — فشل حي هنا
- موصل موجود + fixtures تعمل في الاختبارات
- الحي: unreachable من هذه البيئة

---

## 8. نتائج المقارنة الحقيقية

| السؤال | الرقم الحقيقي |
|---|---|
| وثائق رسمية فُحصت حيًا بنجاح | **10 (UQN فقط)** |
| تطابق قطعي في حكيم | **N/A — لا DB إنتاج** |
| تطابق محتمل | **N/A** |
| غير موجودة في حكيم | **N/A** |
| أقدم في حكيم | **N/A** |
| اختلافات metadata/نص | **N/A** |
| تعارض مصادر حي | **0 مقاس حيًا** (BOE/NCAR لم يُجلبا) |
| Parser anomaly | تحذيرات استخراج أداة في UQN (انظر التقرير الحي) |
| تحتاج مراجعة بشرية | كل نتائج الرصد افتراضيًا تحت `RASD_REVIEW_REQUIRED=true` |

---

## 9. نتائج فحص الأمان

| البند | النتيجة |
|---|---|
| أسرار في الكود | لم تُرصد مفاتيح مضمّنة لرصد |
| حماية `/admin/rasd` | تحت `/admin` + Clerk؛ صلاحية الصفحة `ADMIN_REPORTS_VIEW` |
| حماية API | موجودة، لكن تستخدم `ADMIN_REPORTS_VIEW`/`LEGAL_CORE_ADMIN` وليس `RASD_*` |
| SSRF allowlist | **ناقص** — `redirect:follow` بلا قيد نطاق |
| حد حجم الاستجابة | **ناقص** |
| Path traversal في loadSnapshot | كامن إن استُخدم مسار مطلق |
| Timeouts | موجودة (~8–20s) |
| Rate limit | موجود داخل العملية |
| Cron secret | مطلوب؛ مقارنة غير timing-safe؛ لا preview guard |
| Audit على apply/review | يُستدعى لكن فشل FK إن لم يوجد المستخدم (يُبلع بـ catch) — لوحظ في الاختبار المعزول |
| تنفيذ محتوى المصدر | لا يوجد eval لمحتوى المصدر |

---

## 10. نتائج build / typecheck / الاختبارات

| الأمر | الخروج |
|---|---|
| `npm run typecheck` | **0** |
| `npx prisma validate` | **0** |
| `npm run build` | **0** (يشمل `/admin/rasd*` و`/api/cron/rasd-weekly`) |
| `npm run test:rasd` | **0** |
| `npm run test:rasd:integration` | **0** |
| `npm run lint` | غير حاسم (معالج إعداد تفاعلي؛ لا config) |

فشل سابق vs فشل PR: لا فشل typecheck/build مرتبط برصد في هذا التشغيل.

---

## 11. نتيجة اختبار migration

- على قاعدة معزولة محلية: schema sync عبر `db push` نجح بما فيها جداول رصد.
- `migrate deploy` على Neon Preview/إنتاج: **لم يُنفَّذ** (لا اتصال مصرّح).
- التوصية: Preview أولًا ثم إنتاج.

---

## 12. نتيجة اختبار الاعتماد والـrollback

على `rasd_verify` فقط (`docs/rasd/reports/apply-rollback-isolated.json`):

- منع التطبيق قبل الاعتماد: ✅
- اعتماد ثم dry-run ثم apply: ✅
- إنشاء `article_amendments` + نسخة جديدة مع إبقاء القديمة وإغلاق `effective_to`: ✅
- rollback يغلق نسخة رصد ويعيد السابقة كحالية ويوسم التعديل `rolled_back`: ✅
- لا مساس بإنتاج حكيم: ✅ (قاعدة محلية معزولة)

ملاحظة: سجلات `audit_logs` لم تُكتب بسبب FK على `actorId` لمستخدم غير موجود (الأخطاء مُلتقطة).

---

## 13. مخاطر الدمج

1. BOE/NCAR غير مُثبتين حيًا من مسار نشر معروف في هذا التحقق.
2. لا مقارنة حية مع مكتبة حكيم.
3. SSRF محتمل عبر جلب URLs مكتشفة.
4. صلاحيات `RASD_*` غير مفعّلة على البوابات.
5. لا تسجيل Vercel Cron؛ خطر تشغيل غير مقصود إن أُضيف لاحقًا بلا حراسة Preview.
6. جودة استخراج أداة الإصدار من UQN ضعيفة جزئيًا.
7. قفل التشغيل غير ذري بالكامل (TOCTOU).

---

## 14. التوصية

### **NOT READY**

الأسباب الحاكمة:

1. لم تنجح المصادر الثلاثة حيًا في بيئة التحقق، ولا يوجد إثبات تشغيل ناجح لـ BOE/NCAR من بيئة النشر بعد.
2. لم تُنفَّذ مقارنة حية ضد قاعدة حكيم.
3. توجد فجوات أمان متوسطة قبل الاعتماد التشغيلي.

شروط التحويل لاحقًا إلى READY WITH CONDITIONS على الأقل:

1. نجاح `rasd:health` + baseline dry-run لـ BOE وNCAR وUQN من runner مصرّح.
2. `migrate status/deploy` على Neon Preview ثم dry-run مقارنة بأرقام حقيقية.
3. إغلاق أو تخفيف SSRF (allowlist نطاقات رسمية) وربط بوابات `RASD_*`.
4. إضافة `vercel.json` cron مع حماية Preview + سر.

---

## أوامر نُفذت فعليًا (مختصر)

```text
git fetch / gh pr view 511
DNS/dig/TCP/openssl/curl/Node fetch → BOE, NCAR, UQN
RASD_* live probe UQN limit=10 + BOE/NCAR attempts
apt install postgresql + postgresql-16-pgvector
prisma validate / db push على rasd_verify
scripts/rasd/verify-apply-rollback-isolated.ts
npm run typecheck && prisma validate && test:rasd && test:rasd:integration && build
```
