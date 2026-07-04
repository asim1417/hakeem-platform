# فوتبول فيوتشر v3 — اقرأ أولًا

هذه حزمة تشغيل وبرمجة للعبة كرة قدم عربية الهوية، مبنية كنسخة Web/PWA قابلة للتشغيل مباشرة.

## التشغيل السريع

```bash
python3 run_local.py
```

ثم افتح:

```text
http://127.0.0.1:4173/index.html
```

## ماذا تحتوي؟

- لعبة Canvas قابلة للعب.
- واجهات كاملة بنمط الهوية المصممة.
- تحكم لمس.
- مؤثرات صوتية أصلية داخل `src/assets/audio/sfx`.
- تعليق عربي عبر `src/js/commentary.js`.
- بنك عبارات عربي.
- PWA manifest وservice worker.
- ملفات اختبار وتشغيل.
- وثائق للمبرمج وClaude Code.

## الاختبارات

```bash
python3 smoke_test.py
python3 tools/validate_project.py
node --check src/js/*.js
node --check service-worker.js
```
