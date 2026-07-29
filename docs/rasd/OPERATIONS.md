# Rasd Operations / تشغيل رصد

## تشغيل محلي آمن

```bash
npm run db:generate
npm run test:rasd
npm run test:rasd:integration
npm run rasd:baseline
```

الوضع الافتراضي للسكربتات المضافة يستخدم `--dry-run --fixtures`، لذلك لا يكتب في المكتبة القانونية المعتمدة.

## تشغيل خط أساس حي

1. طبّق migration `20260727120000_add_rasd_monitoring`.
2. شغّل `prisma generate`.
3. اضبط:
   - `RASD_ENABLED=true`
   - `RASD_BASELINE_ENABLED=true`
   - `RASD_AUTO_FETCH_ENABLED=true`
4. شغّل:

```bash
tsx scripts/rasd/cli.ts baseline --limit 100
```

## قاعدة الأمان

المسح يكتب فقط في جداول `monitoring_*`, `source_snapshots`, `monitored_*`, `legal_change_detections`, و`source_conflicts`.
لا يغير `legal_articles` أثناء scan. التطبيق على `article_versions` و`article_amendments` يتم عبر review/apply فقط.
