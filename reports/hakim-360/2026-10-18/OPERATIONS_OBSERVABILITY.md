# المراقبة والتشغيل — HKM-031

## ما وُجد

- `GET /api/health` أعاد `ok` في 2026-10-18T11:44Z: القاعدة متصلة، وأنواع مفاتيح Clerk الحية متطابقة، وGoogle OAuth مهيأ، وMoyasar غير مهيأ، و`conversationSession` جاهز، والكمون 161 مللي ثانية. الاستجابة بلا SHA.
- GitHub Actions هي الإشارة التاريخية المتاحة: 2,658 تشغيلًا حتى 12:32Z في اليوم نفسه. التفاصيل في [CI_CD_LINEAGE.md](CI_CD_LINEAGE.md).
- `idle_in_transaction_session_timeout` قُرئ 300000 مللي ثانية في الجرد الأول. مهلة الجملة الافتراضية للخادم لم تُلتقط لأن جلسة التدقيق ضبطت `statement_timeout` قبل قراءة `pg_settings`.
- `pg_stat_statements` غير مثبّت. لا سلسلة زمنية لاستعلامات الإنتاج داخل القاعدة.

## ما لم يُوجد في المستودع

بحث في ملفات `ts` و`yml` و`json` عن `sentry` و`datadog` و`pagerduty` و`otel` و`OpenTelemetry` لم يُرجع تطابقًا. هذا لا ينفي لوحة Vercel أو Cloudflare خارج المستودع. لا SLO مكتوب، ولا جهاز استدعاء، ولا أثر MCP لحوادث 300 ثانية.

صحة البناء ونجاح readiness لا يساويان صحة الاسترجاع. قياس الاسترجاع المعجمي منفصل في [SEARCH_EVALUATION.md](SEARCH_EVALUATION.md).
