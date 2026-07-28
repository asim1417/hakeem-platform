# Rollback Guide / دليل الرجوع

كل تطبيق ناجح من رصد يأخذ `batchId` ويضع المصدر بصيغة:

```text
rasd:<batchId>
```

على `article_versions.source` و`article_amendments.source`.

## Dry-run

```bash
tsx scripts/rasd/cli.ts rollback-batch --id <BATCH_ID>
```

## تنفيذ الرجوع

```bash
tsx scripts/rasd/cli.ts rollback-batch --id <BATCH_ID> --apply
```

الرجوع لا يحذف النسخ القديمة. يغلق نسخة رصد بتعيين `effectiveTo` ثم يحاول إعادة النسخة السابقة كنسخة نافذة.
