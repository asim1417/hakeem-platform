#!/usr/bin/env bash
# يبني dump/boe_full.sql.gz: مخطط boe وبياناته فقط (لا شيء من جداول حكيم) من قاعدة المختبر المحلية.
# لا يحمل boe.match ولا boe.diff: هذان يُحسبان على قاعدة حكيم الحقيقية بـ match_and_diff.py.
# الملف الناتج يُحمَّل بـ: gunzip -c dump/boe_full.sql.gz | psql "$DATABASE_URL"
# وهو إضافة فقط: CREATE SCHEMA/TABLE IF NOT EXISTS ثم COPY إلى جداول جديدة. يرفض التحميل إن كان المخطط موجودًا وفيه بيانات.
set -euo pipefail
cd "$(dirname "$0")/.."
H=$(python3 -c "import os;u=os.environ['DATABASE_URL'];print(u.split('@')[-1].split('/')[0].split(':')[0])")
[ "$H" = "127.0.0.1" ] || [ "$H" = "localhost" ] || { echo "المختبر المحلي فقط"; exit 1; }
mkdir -p dump
{
  echo "-- قاعدة هيئة الخبراء المتكاملة (boe) — $(date -u +%F). إضافة فقط."
  echo "\\set ON_ERROR_STOP on"
  echo "BEGIN;"
  echo "DO \$\$ DECLARE n bigint := 0; BEGIN IF to_regclass('boe.page_snapshot') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM boe.page_snapshot' INTO n; END IF; IF n > 0 THEN RAISE EXCEPTION 'boe موجود وفيه بيانات: استعمل scripts/load_boe.py (يضيف الجديد فقط)'; END IF; END \$\$;"
  cat schema/boe_schema.sql
  pg_dump "$DATABASE_URL" --data-only --schema=boe --no-owner --no-privileges --exclude-table-data=boe.match --exclude-table-data=boe.diff
  echo "COMMIT;"
} | gzip -9 > dump/boe_full.sql.gz
ls -la dump/boe_full.sql.gz
