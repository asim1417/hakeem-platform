# 09 — تقرير الاختبارات

## التقييم: **2.5 / 5** — تأكيدات حقيقية، ربط CI ضعيف.

## الإطار
لا jest/vitest. كل الاختبارات `tsx scripts/test-*.ts` (34 ملفًّا) + `qa-*`/`eval-*`، تُؤكّد ذاتيًّا وتُنهي بـ`exit(1)`
عند الفشل. **لا يوجد اختبار وهميّ صرف** (حتى ما لا يحوي `exit(1)` نصًّا يستخدم `exit(failed?1:0)`).

## نتائج تشغيل مباشر (نقيّة، بلا قاعدة) — **مفحوصة الآن**
| الأمر | النتيجة |
|---|---|
| `test:pdpl` | ✅ 7/7 |
| `test:policy-gate` | ✅ 15/15 |
| `test:response-verifier` | ✅ 12/12 |
| `test:versions` | ✅ 7/7 |
| `tsc --noEmit` (بعد تصفية ضجيج OCR المعروف) | ✅ 0 خطأ |
| `prisma validate` | ✅ صالح |

## ما يُغطّى جيّدًا (تأكيدات صارمة حقيقية)
تعمية PDPL، البوابات الحتمية، مدقّق الردّ، مستخرِج الاستشهاد (`qa-citations` recall/precision=100% + حالات منع)،
النسخ الزمنية (`selectVersionAt`)، تنوّع المرشّحين، حدود المعرفي (`qa-relations`)، أمن FS (`qa-security`)،
صلة البحث (`eval-search`: P@k/MRR/nDCG مع `--gate`).

## الفجوات
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| TEST-001 | High | **لا اختبارات في CI:** الـworkflow الوحيد على PR يشغّل `typecheck`+`build`+`qa:security`+`qa:citations` فقط — لا أيٌّ من الـ34، ولا `eval-search --gate`، ولا `qa:db`/`qa:relations` | `.github/workflows/deploy-readiness-check.yml:34-44` |
| TEST-002 | High | **لا اختبار عزل مستأجر/مستخدم إطلاقًا** — لا شيء يثبت أن مستخدمًا لا يقرأ قضايا آخر (يؤكّد ثغرات SEC-002..005) | grep tenant/isolation = 0 |
| TEST-003 | Medium | **لا اختبار «مادة من نظام خاطئ» (anti-mixing)** على مسار الاسترجاع/الاستشهاد | grep = 0 في اختبارات البحث |
| TEST-004 | Medium | **مُشغّل يدويّ بالكامل:** `npm test` = ملفّ واحد فقط؛ لا `test:all` — سهولة تعفّن الاختبارات | `package.json:14` |
| TEST-005 | Low | **`quality-gate.ts` بأعداد قديمة** (1981 مادة/9 أنظمة) تناقض `qa-db` (15,902/489) — لا يمكن نجاح الاثنين | `quality-gate.ts:6-7` مقابل `qa-db.ts:34` |

## CI (مفحوص)
- **`deploy-readiness-check.yml`** هو الـworkflow الوحيد على `pull_request`/`push`: `npm ci`→`db:generate`→typecheck→build→qa:security→qa:citations. يضبط `DATABASE_URL` وهميًّا و`AI_PROVIDER:offline` وبلا Postgres → البوّابة الفعليّة = **typecheck + build** + فحصان بلا قاعدة.
- **lint خارج CI** (لا `.eslintrc`). باقي ~60 workflow يدويّ (`workflow_dispatch`) للعمليّات/البيانات.

## ما تعذّر فحصه
نجاح الاختبارات المعتمدة على القاعدة (qa:db, qa:relations, eval-search, test-hybrid, test-kg) — لم تُشغَّل (بلا `DATABASE_URL`)؛
وقواعد حماية الفرع في إعدادات GitHub (هل `deploy-readiness-check` **إلزاميّ**).
