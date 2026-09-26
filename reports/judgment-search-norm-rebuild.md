# إعادة بناء search_norm للأحكام — بعد تنقية العرض

> التاريخ: 2026-09-25 · الفرع: `cursor/judgment-text-sanitize-dryrun-9926`
> **لم يُمسّ عمود `judgmentText`.** التحديث على `search_norm` فقط.

## ما طُبِّق
1. ربط `sanitizeJudgmentDisplay` بـ:
   - `buildRulingSearchNorm` (مسار البحث/PDPL)
   - `backfill-rulings-search-norm.ts` (تعبئة Neon)
2. dry-run كامل: **51,105 / 51,105** ستتغيّر (تنقية + إثراء رقم القضية/المدينة في ذيل الفهرس).
3. APPLY على Neon: **51,105** صفًا محدَّثًا في `search_norm`.

## إثبات عدم المساس بالنص الأصلي
عيّنة `cmpzi84cx000abx5bd5voxcki`:
- `judgmentText` ذيل: `...كثيرا.رئيس الدائرة القضائيةعمر بن حسين الحربي` (التصاق باقٍ في المصدر)
- `search_norm` ذيل: `...القضاييه عمر بن حسين الحربي رقم القضيه...` (مسافة في الفهرس)

## أوامر
```bash
# dry-run
npx tsx scripts/backfill-rulings-search-norm.ts --dry-run --all
# apply
CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/backfill-rulings-search-norm.ts --all
```
