# مهمة: عمليات تعديل أم القرى بلا قرار (البند 2) — حكيم (قراءة فقط)

## السياق
في `uqn_fix.amendment_op` 395 عملية تعديل استُخرجت آليًّا من جريدة أم القرى (1441هـ فما بعد). 143 منها عولجت سابقًا (HKM-030) ولها صف في `uqn_fix.amendment_review` أو `uqn_fix.amendment_decision`. الباقي 252 بلا قرار. كثير منها انعكس فعلًا في نص حكيم بمراحل HKM-030 اللاحقة دون صف قرار، وبعضها يستهدف نظامًا أو مادة غير موجودة في حكيم.
الاستخراج الآلي يقرّب ولا يصلح دليلًا: الخطأ يقع غالبًا في النظام المستهدف أو المادة أو الفقرة أو نوع العملية أو التاريخ. **المرجع هو نص الأداة في اللقطة**.

## الأدوات
- القاعدة (SELECT فقط): `mcp__Neon__run_sql` مع `project_id = misty-base-66693229` و`branch_id = br-rapid-salad-aq782ea2` (حمّلها بـ ToolSearch `select:mcp__Neon__run_sql`).
- نص الأداة كاملًا: `SELECT body FROM uqn_fix.source_snapshot WHERE url = <source_url>`.
- تاريخ السريان المعاد بناؤه لكل عملية (HKM-030): `/home/user/hakeem-platform/ingest/uqn-fix-2026-09-25/data/effective_corrections.jsonl` (سطر لكل op_id: `effective_from_gregorian`، `basis`، `sanad`، `quote`). **لا تستعمل `effective_from_*` في amendment_op** فهو افتراض.

## نصيبك
عملياتك:
```sql
WITH u AS (SELECT o.* FROM uqn_fix.amendment_op o
  WHERE NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_decision d WHERE d.op_id = o.op_id)
    AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review r WHERE r.op_id = o.op_id))
SELECT u.*, s.id AS system_id, s.name AS system_name FROM u
LEFT JOIN legal_systems s ON s.code = u.target_hakeem_code
WHERE <شرط نصيبك في رسالتك> ORDER BY coalesce(u.target_hakeem_code, u.target_law_title), u.article_number, u.op_id;
```
والمادة ونصها الساري الآن (الأحدث `valid_from <= now()` ثم `content`):
```sql
SELECT x.id, x."articleNumber", x."articleBis", x.content,
  (SELECT json_agg(json_build_object('id',v.id,'valid_from',v.valid_from,'instr',v.evidence_instrument,'body',v.body) ORDER BY v.valid_from) FROM unit_version v WHERE v.unit_id = x.id) versions
FROM legal_articles x WHERE x."legalSystemId" = <system_id> AND x."articleNumber" = <n> AND x."articleBis" < 100;
```
النظام المستهدف بلا رمز (`target_resolution = resolve_by_title_in_hakeem`): ابحث عنه بالاسم في `legal_systems.name` (اسم قريب أو سابق)، ولا تفترض.

## لكل عملية: الحكم
1. اقرأ البند في اللقطة: أي نظام، أي مادة/فقرة، ما الفعل، وما النص الجديد **حرفيًا**.
2. قارنه بالعملية المستخرجة (هل الاستخراج صحيح؟).
3. قارنه بنص حكيم الساري ونسخه.
اختر واحدًا:
- `reflected`: النص الجديد موجود في نص حكيم الساري (اذكر النسخة `unit_version.id` أو `content`).
- `apply`: لم ينعكس، ويمكن تطبيقه آليًّا بدقة. أعطِ **مواصفة تعديل** لا نصًّا مكتوبًا:
  - `edits`: قائمة `{ "old": "مقطع من نص حكيم الساري حرفيًا ويرد فيه مرة واحدة", "new": "مقطع من نص اللقطة حرفيًا" }`، أو `{ "whole": "النص الكامل الجديد للمادة حرفيًا من اللقطة" }` لاستبدال المادة كلها.
  - الحذف: `new` = "" (واذكر حدود المحذوف بدقة، مع علامات الترقيم والفواصل المحيطة).
  - **انسخ النصوص نسخًا (copy) من مخرجات SQL، لا تكتبها من الذاكرة**؛ سيُتحقق آليًّا أن كل `old` يرد مرة واحدة في النص الساري وأن كل `new` يرد حرفيًّا في جسم اللقطة. إن احتاج التطبيق نصًا ليس في اللقطة حرفيًا (مثل إعادة ترقيم فقرات) فالحكم `needs_owner` واشرح.
  - `effective_gregorian` من effective_corrections.jsonl، و`basis`. إن كان `unresolved` فالحكم `needs_owner`.
- `repeal`: إلغاء مادة كاملة (سيُسجّل «ملغاة»)، مع الاقتباس الحرفي من اللقطة.
- `not_in_hakeem`: النظام أو المادة غير موجودين في حكيم (اذكر ما بحثت عنه).
- `law_level`: إحلال نظام كامل أو إلغاؤه أو تسميته (replace_law, repeal_law, rename_law) — اذكر هل النظام الجديد موجود في حكيم وحالة القديم (`verification` object_type='work'). لا تطبيق مواد.
- `reject`: الاستخراج خاطئ (النظام أو المادة أو الفعل) — اذكر الصحيح من اللقطة، وإن كان الصحيح منعكسًا أو يحتاج تطبيقًا فاذكر ذلك.
- `needs_owner`: التباس حقيقي.

إن كانت للمادة نفسها عدة عمليات (في نصيبك أو منعكسة سابقًا) فرتّبها بتاريخ السريان، واجعل `old` لكل عملية مأخوذًا من النص بعد العمليات السابقة (اذكر `after_op` إن بُنيت على عملية أخرى غير منعكسة).

## ممنوع
الكتابة في القاعدة أو المستودع. النص القانوني من الذاكرة. التخمين.

## المخرج
`result.jsonl` في مجلدك، سطر لكل عملية:
```json
{"op_id":"...","system_id":"...","system_name":"...","article_id":"... أو null","article":"...","op_type":"...",
 "verdict":"reflected|apply|repeal|not_in_hakeem|law_level|reject|needs_owner",
 "source_url":"...","source_quote":"البند حرفيًا من اللقطة (حتى 600 حرف)",
 "reflected_in":"unit_version.id أو content أو null",
 "edits":[{"old":"...","new":"..."}] أو [{"whole":"..."}] أو null, "after_op":null,
 "effective_gregorian":"YYYY-MM-DD أو null","effective_basis":"...",
 "extraction_ok":true,"notes":"..."}
```
ردّك الأخير: العدد لكل verdict، والمسار، وأي ملاحظة عامة.
