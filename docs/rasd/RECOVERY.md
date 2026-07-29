# Recovery / الاستعادة بعد فشل التشغيل

## استئناف run

يحدّث orchestrator حقل `monitoring_runs.checkpoint` أثناء المرور على المصادر والوثائق.

```bash
tsx scripts/rasd/cli.ts retry-failed --run-id <RUN_ID> --fixtures
```

للتشغيل الحي أزل `--fixtures` بعد التأكد من الأعلام:

- `RASD_ENABLED=true`
- `RASD_AUTO_FETCH_ENABLED=true`

## عند غياب الجداول

إذا ظهرت رسالة أن جداول رصد غير متاحة:

```bash
npm run db:generate
# ثم طبّق migration على قاعدة البيانات
```

## عند تغير HTML المصدر

لا تطبق التغييرات على المكتبة القانونية. شغّل:

```bash
tsx scripts/rasd/cli.ts reparse-snapshot --snapshot-id <ID>
npm run test:rasd
```
