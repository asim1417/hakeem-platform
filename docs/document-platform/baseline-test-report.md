# HKM-DOCUMENTS-UPGRADE-002 — تقرير اختبار خط الأساس (قبل التعديل)

**الفرع الأساس:** `main` @ `1180190ca332aa71cad6ebfd83488421c8d14944`  
**البيئة:** Node v22.14.0 · npm 10.9.7 · تاريخ UTC 2026-07-28T02:47:04Z  
**الأمر:** `npm ci` ثم الأوامر أدناه **قبل** أي تعديل على الكود.

---

## نتائج الأوامر الإلزامية

| الأمر | رمز الخروج | النتيجة |
|---|---|---|
| `npm ci` | 0 | نجح (609 حزمة) |
| `npm run typecheck` | 0 | نجح — بلا أخطاء |
| `npm run lint` | 1 | **فشل مسبق** — لا يوجد `.eslintrc*`؛ `next lint` يطلب إعدادًا تفاعليًا |
| `npm test` | 0 | نجح — عقل المحادثة / Chat-First (مع تحذير Prisma لعدم وجود `DATABASE_URL` في مسار جانبي غير كاسر) |
| `npm run build` | 0 | نجح — Compiled successfully · 87 صفحة ثابتة (تحذيرات Prisma `DATABASE_URL` أثناء توليد بعض المسارات الديناميكية) |

---

## اختبارات الوثائق الخاصة

| الأمر | رمز الخروج | النتيجة |
|---|---|---|
| `npm run test:document-inspection` | 0 | **81** اختبارًا ناجحًا |
| `npm run accuracy` (`scripts/measure-accuracy.ts`) | 0 | 3 حالات ذهبية · CER=0.000 · إخفاقات: 0 |
| `npm run test:doc-node` | 0 | **7** اختبارات ناجحة |
| `npx tsx scripts/test-ownership.ts` | 0 | **42** نجح · 0 فشل |

---

## إخفاقات سابقة (لا تُنسب لـ PR-1)

1. **`npm run lint`:** المستودع بلا ملف إعداد ESLint. هذا فشل خط أساس موثَّق قبل أي تغيير.
2. **`DATABASE_URL` غير مضبوط في بيئة الوكيل:** يظهر في سجلات build/test كتحذير Prisma عند مسارات تحتاج DB؛ لا يفشل `typecheck` ولا يفشل اختبارات document-inspection/doc-node/accuracy الحتمية.

---

## فجوات اختبار قبل PR-1

- لا اختبار regression لعقد `/api/attachments` (رفع/رفض MIME/DTO).
- لا اختبار لـ JSON-داخل-`extractedText` مقابل نص حقيقي.
- لا اختبار ترحيل metadata.
- `test-ask-attach-docs.ts` و`test-ownership.ts` غير مسجّلين كسكربتات npm رئيسية.

---

## قرار المتابعة

خط الأساس يسمح ببدء PR-1 بشرط:

- عدم كسر مسارات الرفع/DTO/الملكية.
- توثيق فشل lint المسبق وإصلاح إعداد ESLint الأدنى فقط لتمكين بوابة الدمج دون تغيير قواعد جودة واسعة.
- إضافة اختبارات regression قبل أي موصل خارجي.
