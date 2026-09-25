# استكمال قاعدة الأنظمة بأثر رجعي (Backfill) — المرحلة ٣

سكربتات إدخال أدوات الإصدار والتمهيدات الناقصة إلى شجرة `document_units` دون مساس
بوحدات المواد القائمة. المرجع: الأمر الموجّه (ثامنًا).

## الترتيب

```bash
# ١) الحصر (قراءة فقط) → reports/legal-completeness-audit.csv
npx tsx scripts/backfill/audit.ts

# ٢) الجلب من بوابة هيئة الخبراء (شبكة) — دفعات ≤20 مع مهلة مهذبة، خام أولًا
npx tsx scripts/backfill/fetch-boe.ts            # معاينة
npx tsx scripts/backfill/fetch-boe.ts --apply    # جلب فعليّ

# ٣) الإدخال عبر القارئ + تحديث completeness (كتابة مقفولة)
CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED \
  npx tsx scripts/backfill/ingest.ts --apply
```

## بوّابات الأمان

- **قراءة/كتابة القاعدة** تحتاج `DATABASE_URL` حيًّا؛ تتخطّى بأمان إن غاب.
- **الكتابة** مقفولة خلف `CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED` +
  `--apply` (نفس نمط `import-moj-regs`/`derive-article-versions`).
- **الجلب الحيّ** من `laws.boe.gov.sa` محجوب بسياسة الخروج داخل جلسات Claude Code
  الحالية (403)؛ يُشغَّل خطّ الجلب في بيئةٍ تصل للمصدر (جهاز/CI).

## المدخلات

- `data/backfill/boe-raw/<systemId>.html` — خام البوابة (من fetch-boe).
- `data/backfill/text/<systemId>.json` — نصّ مُستخلَص للإدخال:
  `{ "docType": "ROYAL_DECREE", "rawText": "...", "number": "م/191", "hijriDate": "..." }`
  (خطوة الاستخلاص من HTML → نصّ: عمل بشريّ/سكربت لاحق قبل ingest.)
