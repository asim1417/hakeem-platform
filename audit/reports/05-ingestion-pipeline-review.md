# 05 — مراجعة خطّ الاستيراد والمعالجة

## مصادر الإدخال (مؤكَّدة)
| المسار | المصدر | الوجهة |
|---|---|---|
| `import-hoqoqi-sql.ts` | ملفّ `.sql.zip` (hoqoqi) | `legal_systems`, `legal_articles` |
| `import-judgments-sql.ts` | `ahkam_moj.sql.gz` | `judicial_cases` + روابط |
| `migrate-judgments.ts` | Hostinger MySQL (عيّنة 200) | `judicial_cases` (**متكرّر/قديم**) |
| `import-moj-regs.ts` | `data/moj-regs.json` | أنظمة + مواد |
| `import-fiqh-from-turath.ts` | turath.io API | `fiqh_sources`, `fiqh_texts` |
| `seed-legal-library.ts` (`db:seed`) | `legal_articles_export.json` | مواد (9 أنظمة/1981) |
| `moj-fetch-*.mjs`, `nezams/*.py` | بوّابات حكومية | **ملفّات JSON/sqlite فقط، لا قاعدة** |

## تقييم لكل مسار (مختصر — الجدول الكامل في تدقيق الأدلّة)
| المسار | تحقّق النوع | منع التكرار | سجلّ أخطاء | Idempotent | Txn-safe | إسناد مُخزَّن | تقييم |
|---|---|---|---|---|---|---|---|
| hoqoqi | نعم | `createMany skipDuplicates` على الفريد | retry×5 + checkpoint | ✅ | ❌ لا `$transaction` | داخل `keywords[]` فقط | 3.5 |
| judgments-sql | نعم | `sourceId @unique` | retry (ضعيف) + لكل صفّ | ✅ | ❌ | **أعمدة حقيقية جيّدة** | 4 |
| moj-regs | ضعيف | upsert + skipDuplicates | أعلى-مستوى فقط | ✅ | ❌ | `keywords[]` | 3.5 |
| fiqh-turath | نعم | **`create()` بلا قيد** | أعلى-مستوى | ❌ **يكرّر عند الإعادة** | ❌ | جيّد | 2.5 |
| seed-legal-library | نعم | upsert على الفريد | أعلى-مستوى | ✅ | ❌ | **بلا وسم مصدر** | 3 |

## النتائج
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| ING-001 | High | **لا أعمدة مصدر/رابط/hash على المواد؛** الإسناد مُهرَّب في `keywords[]` (`source:hoqoqi_sql`…)، وبذرة المكتبة بلا وسم إطلاقًا | `import-hoqoqi-sql.ts:372`, `seed-legal-library.ts:163-173` |
| ING-002 | High | **لا content_hash في أي مستورِد** → تكرار نصّ لنفس (lawName,articleNumber) يُبتلع بصمت (يبقى الأول)، والمختلف يُخزَّن مرّتين | grep؛ الدمج يعتمد المفتاح البنيوي فقط |
| ING-003 | High | **`import-fiqh-from-turath` غير idempotent:** `FiqhText.create` بلا قيد فريد → تكرار الكوربوس عند كل تشغيل؛ و`textNormalized` لا يُملأ | `import-fiqh-from-turath.ts:56-79`; schema:687-709 |
| ING-004 | Medium | **لا `$transaction`** في أي مستورِد → حالة جزئية عند التعطّل (حالة+روابط منفصلة) | grep `$transaction`=0؛ `import-judgments-sql.ts:439-480` |
| ING-005 | Medium | **`withRetry` ميّت لأخطاء الصفوف** في مستورِد الأحكام: catch داخلي يبتلع الخطأ ويعدّه فشلًا دائمًا لا مؤقّتًا | `import-judgments-sql.ts:427-496` |
| ING-006 | Medium | **محلّل SQL يدويّ هشّ** في hoqoqi: `;` داخل نصّ قد يبتر الجملة ويُسقط صفوفًا؛ وعمود محتوى مُختار heuristically عبر 7 أسماء — إن غاب الاسم تُسقَط المادة بصمت | `import-hoqoqi-sql.ts:185,277-283,358` |
| ING-007 | Low | نصّ HTML الخام لا يُحفَظ في مسارَي fiqh/moj-fetch (يُخزَّن المُنظَّف فقط) | `turath-client.ts:79`; `moj-fetch-regs.mjs:37-46` |
| ING-008 | Low | مساران متكرّران للأحكام (`migrate-judgments` مقابل `import-judgments-sql`) يدعوان للتباعد | `package.json` |

## ملاحظة إيجابية مهمّة
- **فصل النصّ الأصلي عن نصّ البحث صحيح:** التطبيع العربي يُطبَّق على عمود `search_norm` منفصل عبر
  `backfill-search-norm.ts:38-44`، ويبقى `content` الأصلي سليمًا. جيّد.
- **OCR خارج مسار القاعدة تمامًا:** `document-inspection`/`gemini-ocr`/`doc-node` لا تكتب في الجداول القانونية —
  نصّ الـOCR **عرض فقط، لا يُخزَّن كمواد**. فإن كان الاستيراد عبر OCR مقصودًا **فهو غير موجود بعد**.

## ما تعذّر فحصه
هل شُغِّلت المستوردات على Neon وكم صفًّا كتبت؛ حجم تكرار fiqh الفعلي؛ محتوى ملفّات الـdump — كلّها تحتاج
القاعدة الحيّة/الملفّات المصدرية.
