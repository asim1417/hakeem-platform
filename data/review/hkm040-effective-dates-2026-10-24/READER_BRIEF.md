# مهمة: تاريخ نفاذ نسخ النص المعدّل — حكيم (قراءة فقط)

## السياق
أضيفت 67 نسخة نص معدّل في `public.unit_version` (المعرّفات تبدأ بـ `hk37u-` أو `hk37wu-`). سُجّل `valid_from` لكل منها بتاريخ **صدور** الأداة المعدِّلة، والمطلوب تاريخ **نفاذ** التعديل على تلك المادة. النص نفسه صحيح ولا يُمس؛ المطلوب التاريخ فقط.

مثال محسوم: المرسوم م/191 (1444/11/29) نص «يلغى اعتباراً من تاريخ العمل بنظام المعاملات المدنية»، والمادة 721 من ذلك النظام «يُعمل بهذا النظام بعد مضي (مائة وثمانين) يومًا من تاريخ نشره»، ونُشر 1444/12/01 (2023-06-19) ← النفاذ 2023-12-16.

## نصيبك
النسخ المذكورة في رسالتك (قائمة `vid`). اجلب بياناتها:
```sql
SELECT v.id vid, v.unit_id aid, a."lawName", a."articleNumber", a."articleBis", v.valid_from::date, v.evidence_instrument, v.evidence_url, v.evidence_quote,
       substring(v.evidence_url from 'LawDetails/([0-9a-f-]+)/') law_guid
FROM unit_version v JOIN legal_articles a ON a.id = v.unit_id WHERE v.id IN (...);
```
أداة القاعدة: `mcp__Neon__run_sql` مع `project_id = misty-base-66693229` و`branch_id = br-rapid-salad-aq782ea2` (حمّلها بـ ToolSearch `select:mcp__Neon__run_sql`). **SELECT فقط.**

## المصادر (لا غيرها، ولا ذاكرة)
1. **نص الأداة المعدِّلة** (الأهم): `boe.attachment` (`law_guid`, `kind` = amending_instrument | issuance_instrument | article_attachment, `unit_seq`) و`boe.attachment_page` (`attachment_id`, `page_no`, `ocr_text`, `image_url`, `image_sha256`). النص الآلي تقريبي (الأرقام تُقرأ خطأً)؛ تعرّف على الأداة برقمها وتاريخها في رأس الصفحة.
   الصور الأصلية محفوظة في فروع git: `git -C /home/user/hakeem-platform fetch origin crawl/boe-39987807785 crawl/boe-40019834094 crawl/boe-39982828368 crawl/boe-40055429402` ثم `git ls-tree -r --name-only origin/<branch>` (المسار `ingest/crawl-2026-10-23/runs/<run>/attachments/<viewer>/<name>.jpg`، والمطابقة ببصمة sha256 للصورة = `image_sha256`). استخرج الصورة إلى مجلد مؤقت خاص بك تحت `/tmp/claude-0/-home-user-hakeem-platform/ca620407-2d6b-5011-a62c-22afbdc2c911/scratchpad/eff/<اسمك>/` واقرأها بأداة Read (تعرض الصور). اقرأ الصورة لكل عبارة نفاذ تعتمدها أو تاريخ نشر.
2. **أم القرى (1441هـ فما بعد فقط)**: `uqn_stage.effect` (`instrument_kind`, `instrument_no`, `instrument_date_hijri`, `published_hijri`, `operative_text`, `source_url`). طابق برقم الأداة وتاريخها.
3. **بطاقة النظام**: `boe.law` (`published_raw`, `issued_raw`, `instruments`) — لتاريخ نشر النظام نفسه حين تحيل الأداة إليه (مثل «من تاريخ نفاذ نظام كذا»)، و`boe.unit` لمواد النظام المحال إليه.
4. **القاعدة العامة عند سكوت الأداة**: اجلب نصها حرفيًا من حكيم: `SELECT "articleNumber", content FROM legal_articles WHERE "lawName" LIKE 'النظام الأساسي للحكم%' AND content LIKE '%تنشر%'` واقتبسه؛ والنفاذ حينئذ = تاريخ النشر في الجريدة الرسمية.

## القواعد
- لكل نسخة حدّد: البند الذي عدّل المادة في الأداة، وعبارة النفاذ **حرفيًا** وموضعها (attachment_id، page_no)، وهل تشمل ذلك البند (قد تخص بنودًا معيّنة فقط)، وتاريخ النشر ومصدره، ثم احسب.
- «من بداية الشهر التالي لنشره» = أول الشهر الهجري التالي لشهر النشر. «بعد (N) يومًا من تاريخ نشره» = النشر + N. «من تاريخ صدوره» = تاريخ الأداة. «اعتباراً من تاريخ نفاذ نظام X» = تاريخ نفاذ X (ابحث عنه بالقواعد نفسها).
- التحويل الهجري↔الميلادي: `python3 -c "from hijri_converter import Hijri, Gregorian; print(Hijri(1444,12,1).to_gregorian())"`.
- لا تخمين: إن لم تجد تاريخ النشر في المصادر فالحالة `needs_publication_date` (واذكر ما وجدت). إن التبس نطاق العبارة فالحالة `needs_owner`.
- لا تكتب في القاعدة ولا في المستودع.

## المخرج
اكتب `result.jsonl` في مجلدك، سطرًا لكل نسخة:
```json
{"vid":"...","aid":"...","law":"...","article":"...","instrument":"...","amending_clause":"البند الذي عدّل المادة",
 "effect_clause":"العبارة حرفيًا أو null","effect_source":"attachment_id:page أو uqn url أو null","scope_covers_article":true,
 "publication_hijri":"YYYY-MM-DD أو null","publication_source":"...","rule":"وصف القاعدة المطبقة",
 "effective_hijri":"YYYY-MM-DD أو null","effective_gregorian":"YYYY-MM-DD أو null","current_valid_from":"YYYY-MM-DD",
 "status":"resolved|needs_publication_date|needs_owner","confidence":"high|medium|low","notes":"..."}
```
ردّك الأخير: العدد لكل status، ومسار الملف، وأي ملاحظة عامة (مثل خطأ في تحديد الأداة نفسها).
