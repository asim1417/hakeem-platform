#!/usr/bin/env tsx
/**
 * تنظيف ملفات مؤقتة لاستيراد الوثائق.
 * الافتراضي dry-run. استخدم --apply للحذف الفعلي.
 *
 * npm run documents:cleanup-temp -- --dry-run
 * npm run documents:cleanup-temp -- --apply
 */
import { cleanupTempDocumentFiles } from "@/lib/modules/documents/cleanup-temp";

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  if (!apply && !args.has("--dry-run")) {
    console.log("الوضع الافتراضي: dry-run. مرّر --apply للحذف الفعلي.");
  }
  const result = await cleanupTempDocumentFiles({ apply });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
