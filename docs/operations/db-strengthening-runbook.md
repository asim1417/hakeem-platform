# دليل رفع قوّة قاعدة الأنظمة — التعديلات والتحديثات (Runbook)

> الهدف: قاعدةٌ كاملةٌ ومحدَّثة بكل التعديلات والنفاذ. كل ما يكتب في القاعدة **يُشغَّل على Neon بيدك** (لا وصول للوكيل)، وكلّه **idempotent** وآمن للتكرار، ويبدأ بتجربةٍ قبل التطبيق.

## المبدأ
«إضافة التعديلات» طبقتان: **(أ)** بنيَنة التعديلات المضمَّنة أصلًا في نصّ المواد القائمة (تعمل **الآن** بلا انتظار)، و**(ب)** تدفّق تحديثاتٍ جديدة من المصادر الرسميّة (تحتاج #631 + Cron — لاحقًا).

---

## القسم أ — يعمل الآن على الـ 15,902 مادة القائمة (لا يعتمد على #631)

نفّذ بالترتيب. ابدأ دائمًا بالتشخيص، وكل خطوةٍ **تجربة ثم تطبيق**.

### 0) تشخيص (قراءة فقط) — لتعرف نقطة البداية
```
npx tsx scripts/diagnose-authority-data.ts
```
يعدّ التعديلات/الإصدارات/المراسيم الحاليّة. المتوقّع: **article_amendments = 0** (لا منتِج قبل هذا العمل).

### 1) تعبئة مراجع المراسيم (يغذّي المُستخرِج)
```
npx tsx scripts/backfill-decrees.ts            # تجربة
npx tsx scripts/backfill-decrees.ts --apply    # تطبيق (يملأ LegalArticle.royalDecree فقط)
```

### 2) اشتقاق النسخة الأولى لكل مادة (أساس التسلسل الزمنيّ)
```
CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/derive-article-versions.ts           # تجربة
CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/derive-article-versions.ts --apply    # تطبيق
```

### 3) ⭐ استخراج التعديلات (الجديد — البند المفقود) → يملأ `article_amendments`
عبر Actions: **«Extract Article Amendments (data)»**
- تجربة: `mode = dry` (قراءة فقط — يُظهر كم حدثًا سيُنشأ + عيّنة).
- تطبيق: `mode = apply` + `CONFIRM_RUNTIME_DB_ALIGNMENT = NEON_RUNTIME_CONFIRMED` (+ `limit=0` للكل).

أو محليًّا:
```
npx tsx scripts/extract-amendments.ts                                                      # تجربة
CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/extract-amendments.ts --apply
```
يُنشئ صفوف `ArticleAmendment` بمصدر «extractor» وحالة «needs_review». **لا اختلاق**: لا يُنشأ حدثٌ إلا بفعل تعديل صريح + أداةٍ نظاميّة (٩ اختبارات تُثبت ذلك، منها اختبارا «عدم الاختلاق»). لا يلمس نصّ المادة.

### 4) وسم النفاذ (سارٍ/معدّل/ملغى) + الحقول المعياريّة
عبر Actions: **«Activate Normative Tagging (data)»** → `limit = 0`. (قواعديّ، بلا شبكة، idempotent.)

### 5) إثبات السريان (يختم `law_as_of_date`)
عبر Actions: **«Prove domain-pack currentness»** → اكتب `NEON_RUNTIME_CONFIRMED` (+ تاريخ اختياريّ). يرفع بوابات JDS للنفاذ الحقيقيّ.

### 6) المراجعة البشريّة
صفوف `needs_review` تُراجَع عبر مركز المراجعة الموجود. (المستخرِج محافظ، لكن العزو القانونيّ يتطلّب اعتمادًا بشريًّا.)

---

## القسم ب — التحديثات الجديدة من المصادر الرسميّة (يحتاج الأساس)

| # | الخطوة | الحالة |
|---|---|---|
| ٧ | ادمج **#635** ثم شغّله (هجرة طبقة الوحدات على Neon) | جاهز |
| ٨ | ادمج **#631** (الالتقاط الكامل + خطّ أم القرى) | جاهز بعد ٧ |
| ٩ | أستأنف **#634** (المرحلة ٢: نموذج الأثر والزمنيّة) | بعد ٨ |
| ١٠ | المرحلة ٣: جلب التحديثات دوريًّا (Cron + `CRON_SECRET`) | خادميّ |

> ملاحظة: القسم (أ) لا ينتظر القسم (ب). يمكن رفع قوّة القاعدة اليوم بالخطوات ٠→٦، ثم يضيف القسم (ب) التحديثات المستقبليّة.

---

## أدوات هذا العمل (PR الحاليّ)
- `lib/modules/legal-core/amendment-extractor.ts` — المُستخرِج (نقيّ، ٩/٩ اختبارات).
- `scripts/extract-amendments.ts` — الكاتب المُقفَل (idempotent، تجربة أوّلًا).
- `.github/workflows/extract-amendments.yml` — زرّ التشغيل المُقفَل على Neon.
- `npm run test:amendment-extractor` · `npm run extract:amendments`.
