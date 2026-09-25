#!/usr/bin/env bash
# run-when-db-ready.sh — نفّذ الجرد والتجربة فور توفر DATABASE_URL.
# لا يكتب إنتاجًا. التجربة على فرع الاختبار فقط عند --apply-test.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "✗ DATABASE_URL غير محقون في هذه الجلسة بعد."
  echo "  املأ نموذج الأسرار في صفحة الوكيل أو Secrets في Cursor، ثم أعد التشغيل."
  exit 2
fi

echo "== 1) بصمة اتصال غير سرية + جرد قراءة فقط =="
export CONFIRM_RUNTIME_DB_ALIGNMENT="${CONFIRM_RUNTIME_DB_ALIGNMENT:-}"
npm run audit:live-snapshot -- --out=reports/live-snapshot-current.json

echo "== 2) تجربة مدنية (5 مواد) داخل معاملة ثم ROLLBACK =="
export CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
npm run audit:civil-trial -- \
  --diff=handoff/archives/live-audit/round6/civil-proposed-diff.json \
  --only=237,465,468,474,720

if [[ "${1:-}" == "--apply-test" ]]; then
  echo "== 3) تطبيق على فرع الاختبار فقط =="
  export CONFIRM_CIVIL_TRIAL_BRANCH=hakeem-legal-repair-test-2026-09-22
  # يتوقف السكربت إن بدا URL إنتاجيًا
  npm run audit:civil-trial -- --apply-test \
    --diff=handoff/archives/live-audit/round6/civil-proposed-diff.json \
    --only=237,465,468,474,720
fi

echo "✓ انتهى المسار المشروط. الإنتاج لم يُمس."
