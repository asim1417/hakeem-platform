/**
 * الكتابة على جدول embeddings موقوفة.
 * المتجه الجديد يُضاف في embedding_version عبر scripts/backfill-embedding-versions.ts
 * والصف القائم لا يُستبدل.
 */
import { prisma } from "@/lib/prisma";

async function main() {
  console.error("الكتابة على جدول embeddings موقوفة. المتجه الجديد يُضاف في embedding_version، والصف القائم لا يُستبدل.");
  console.error("التشغيل التجريبي: npx tsx scripts/dry-run-verification-layer.ts");
  process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
