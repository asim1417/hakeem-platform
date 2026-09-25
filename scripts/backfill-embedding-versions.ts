/**
 * يضيف متجهات في embedding_version فقط. لا يمس جدول embeddings.
 * افتراضيًا تجريبي: يطبع الأعداد ولا يكتب.
 * --apply يحتاج CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED وموافقة المالك إن زاد الإدراج على 100 صف.
 */
import { prisma } from "@/lib/prisma";
import { EMBEDDING_MODEL_NAME } from "@/lib/modules/legal-core/embedding-fingerprint";

async function main() {
  if ((process.env.EMBEDDING_MODEL || EMBEDDING_MODEL_NAME) !== EMBEDDING_MODEL_NAME) {
    console.error("النموذج المسموح text-embedding-3-small فقط.");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  console.log(apply
    ? "التطبيق مرفوض من هذا المسار حتى موافقة صريحة على الإدراج. لم يُكتب شيء."
    : "تجريبي. لم يُكتب شيء. الأعداد في scripts/dry-run-verification-layer.ts");
  process.exitCode = apply ? 2 : 0;
}

main().finally(() => prisma.$disconnect());
