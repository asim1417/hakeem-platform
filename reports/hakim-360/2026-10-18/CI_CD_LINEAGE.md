# سلالة التكامل المستمر — HKM-031

**القياس:** 2026-10-18 نحو 12:46 UTC. **المصدر:** `gh api --paginate` على `/repos/asim1417/hakeem-platform/actions/runs` ثم تجميع محلي. **لم تُسحب سجلات الخطوات.**

## التاريخ الكامل المرئي لهذه الجلسة

| المؤشر | القيمة |
|---|---:|
| التشغيلات | 2,658 |
| أول تشغيل | 2026-06-02T09:13:25Z |
| آخر تشغيل في اللقطة | 2026-10-18T12:32:58Z — Deploy Readiness Check ناجح على فرع `uqn-fix/effective-dates-2026-10-18` عند `5feb592` |
| success | 2,107 |
| failure | 524 |
| cancelled | 14 |
| action_required | 13 |
| pull_request | 1,376 |
| push | 1,004 |
| workflow_dispatch | 278 |
| أسماء workflow مميزة | 94 |

التوزيع الشهري: 2026-06 = 463، 2026-07 = 1,259، 2026-08 = 102، 2026-09 = 477، 2026-10 = 357 حتى لحظة السحب.

أكبر كتلة إخفاق بالاسم: Deploy Readiness Check، 411 إخفاقًا من 2,100 تشغيلًا بهذا الاسم. هذا عدّ تاريخي لا حكم على آخر `main`. يوجد أيضًا اسم مسار `.github/workflows/deploy-readiness-check.yml` بـ 20 إخفاقًا من 20، منفصل في واجهة Actions عن الاسم الظاهر.

## تصنيف ملفات workflow في الشجرة الحالية

فُحصت 93 ملفًا تحت `.github/workflows`.

- 35 ملفًا يذكر `CONFIRM_RUNTIME_DB_ALIGNMENT` ويقارن القيمة بـ `NEON_RUNTIME_CONFIRMED` قبل الكتابة.
- لا ملف في هذه الشجرة يعلن `schedule:`.
- إشارات كتابة (مثل `--apply` أو `db push` أو `CREATE INDEX` أو فهرسة OpenSearch) ظهرت في 19 ملفًا. البوابة النصية لا تساوي إثبات أن كل تشغيل تاريخي كان مقفلًا؛ التشغيلات اليدوية القديمة قد تكون سابقة للبوابة.

حماية فرع `main` وأسماء أسرار Actions أُعيد طلبهما في 12:50 UTC وعادا `HTTP 403 Resource not accessible by integration`. الغياب غير مستنتج.

## ما لا يثبته نجاح workflow

نجاح Deploy Readiness أو Index OpenSearch أو Rebuild BM25 يثبت أن ذلك التشغيل انتهى بخاتمة success على SHA مذكور. لا يثبت SHA الذي يخدم `hakeemai.net` الآن، ولا عدد وثائق OpenSearch، ولا أن الهجرة طُبقت على الإنتاج.
