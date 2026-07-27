# Parser Repair / إصلاح parser عند تغير HTML

## خطوات التشخيص

1. احفظ snapshot من المصدر في `data/rasd/fixtures/<source>/`.
2. شغّل:

```bash
npm run test:rasd
tsx scripts/rasd/cli.ts reparse-snapshot --snapshot-id <ID>
```

3. راقب:
   - عدد المواد.
   - `metadata.instrumentNumber`.
   - `structureHash`.
   - `parseConfidence`.

## قاعدة الإصلاح

- لا تعدّل نصوص المواد المستخرجة لتبدو أجمل؛ احفظ النص كما ورد.
- أصلح `parse/metadata.ts` أو `parse/structure.ts` بأضيق تغيير ممكن.
- أضف fixture يثبت شكل HTML الجديد.
- شغّل unit وintegration قبل تشغيل scan حي.

## قبول الإصلاح

الحد الأدنى:

```bash
npm run test:rasd
npm run test:rasd:integration
```
