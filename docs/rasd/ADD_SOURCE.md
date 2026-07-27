# Add a fourth Rasd source / إضافة مصدر رابع

1. أضف كود المصدر إلى `RasdSourceCode` في `lib/modules/rasd/types.ts`.
2. أنشئ connector جديداً تحت `lib/modules/rasd/connectors/` يطبق:
   - `discover`
   - `fetchDocument`
   - `healthCheck`
3. أضفه إلى `allConnectors` في `connectors/index.ts`.
4. أضف تعريف المصدر في `DEFAULT_SOURCES` داخل `db/seed-sources.ts`.
5. أضف fixtures محلية تحت `data/rasd/fixtures/<code>/`.
6. وسّع migration لاحقة بفهرس/أعمدة عند الحاجة فقط، ولا تعدّل هجرة رصد الأولى بعد اعتمادها.
7. أضف حالة conflict source في تقارير التعارضات إذا احتجت عموداً مخصصاً؛ وإلا خزّن القيم داخل `evidence`.

اختبار سريع:

```bash
tsx scripts/rasd/cli.ts source --code NEWCODE --fixtures
```
