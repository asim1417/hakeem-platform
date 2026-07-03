# حزمة ربط اللائحة بالنظام — حكيم

سحب لمرة واحدة لمحاذاة الأنظمة/اللوائح/الضوابط/الأدلة من nezams إلى قاعدة بيانات حكيم،
وبناء رسم قانوني بأربع طبقات وعلاقات مُوسومة. لا اعتماد حيّ على الموقع.

## المحتويات
- `CLAUDE_CODE_PROMPT.md` — ابدأ من هنا. المواصفة الكاملة لـ Claude Code.
- `schema_graph.prisma` — نموذج LegalNode + LegalRelation والـ enums.
- `nezams_scraper.py` — المُستخرِج (Playwright): وضع inspect للمعايرة، وextract للاستخراج.
- `bylaw_link_parser.py` — محلّل الإشارات الصريحة «المادة (كذا) من النظام» (مُدقِّق).
- `tests/` — اختبارات مُمرَّرة: الأعداد الترتيبية، الاستدعاء، تفكيك الطبقات الأربع.

## التشغيل السريع
1. سلّم `CLAUDE_CODE_PROMPT.md` لـ Claude Code في ريبو hakeem-platform.
2. معايرة قبل التعميم:
   pip install playwright && playwright install chromium
   python nezams_scraper.py inspect <url_نظام_واحد>
   طابِق MARKERS في أعلى nezams_scraper.py مع ما يظهر.
3. الاستخراج:
   python nezams_scraper.py extract <url1> <url2> ...
4. البذر داخل الريبو حسب المواصفة (seed:legal-graph).

## ملاحظات دقّة
- الجلب يتطلّب Playwright لأن صفحات nezams تُصيَّر بالجافاسكربت.
- التفكيك النصي مُختبَر على بنية «وسم واحد قبل كل بند». عايِر عبر inspect أولاً.
- الإشارة الصريحة (ثقة 0.98) ترجّح على المحاذاة البنيوية (0.9) عند التعارض.
- مادة نظام بلا مقابل في اللائحة = سلوك صحيح، لا خلل.
