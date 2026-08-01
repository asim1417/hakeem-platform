# المرحلة 1 — سياسة المصادر الخادمية

المرجع: HKM-COMPOSER-EVOLUTION-003  
يعتمد على: PR #592 (`cursor/hakeem-composer-da55`)  
الفرع: `cursor/composer-source-policy-da55`  
العلم: `HAKEEM_COMPOSER_SOURCE_POLICY_V2=1`

## الهدف
فرض اختيار مصادر المستخدم خادميًا داخل `/api/ai/agent-search` وأدوات الوكيل والمنسّق — لا كتلميح نصي.

## ما كان موجودًا
- SourcesSelector في الواجهة
- تلميح نصي عبر `buildSourceHint` / `composeAgentQuery`
- عقد `SourcePolicy` + mapper في PR 592

## ما يُنفَّذ هنا
1. قراءة/تطبيع `sourcePolicy` في agent-search
2. تمرير السياسة إلى `runHakeemAgent` و`orchestrate`
3. إنفاذ `decideToolAccess` داخل `executeTool`
4. تخطّي البحث النظامي/الأحكام وفق السياسة في المنسّق
5. `auditEvent` لبداية الطلب والمصادر المستدعاة/المرفوضة
6. بث حالة واضحة عند رفض النطاق
7. Feature Flag مع Rollback

## Rollback
`HAKEEM_COMPOSER_SOURCE_POLICY_V2=0` أو غياب المتغير → لا إنفاذ (توافق خلفي كامل).

---

## بعد التنفيذ

### ما اعتُمد
- `/api/ai/agent-search` كنقطة اختناق
- أدوات الوكيل الحالية + المنسّق
- عقد `SourcePolicy` من PR 592

### ما طُوّر
- إنفاذ `decideToolAccess` داخل `executeTool`
- تمرير السياسة إلى `runHakeemAgent` و`orchestrate`
- رفض مبكر لـ «مرفقات فقط» بلا مستند
- تخطّي الأحكام/المبادئ عند `judgments=false`
- منع البحث النظامي عند `legalLibrary=false`
- منع المصادر الخارجية/الويب إلا بتصريح
- `auditEvent` لبداية السياسة والمصادر المستخدمة/المرفوضة
- بث خطوة `source-policy` + حقول في `result`

### ما لم يُنفَّذ (مراحل لاحقة)
- `caseFiles` / مكتبة المؤسسة (تحتاج سياق صلاحيات — مرحلة 6)
- أداة ويب حقيقية
- إصلاح تسرّب semantic extras خارج systemIds (مرحلة 3)
- Playwright E2E مرئي

### الاختبارات
| أمر | نتيجة |
|---|---|
| `test:source-policy` | 19/19 |
| `test:hakeem-composer` | 40/40 |
| `test:runtime` | 20/20 |
| `tsc --noEmit` | ناجح |
| lint | ناجح |

### متغيرات البيئة
- `HAKEEM_COMPOSER_SOURCE_POLICY_V2=1` لتفعيل الإنفاذ
- `HAKEEM_ALLOW_WEB_SOURCE=1` للسماح بمصدر ويب عند الطلب
