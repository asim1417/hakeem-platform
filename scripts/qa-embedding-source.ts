/**
 * qa-embedding-source.ts — توحيد مصدر الـembedding (المرحلة ٥، قراءة فقط).
 *
 * يثبت أن جدول pgvector «embeddings» هو المصدر الحيّ الوحيد للبحث الدلالي:
 *  - تغطية المواد في الجدول (المتوقّع 100% = كل المواد لها متجه).
 *  - عدّاد الحقل المهجور legal_articles.embedding (Json) للأرشفة فقط (لا يُكتب إليه).
 * لا يحذف ولا يكتب شيئًا. يخرج برمز 1 إن نقصت تغطية المواد عن الكمال.
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { getEmbeddingStatus } from "@/lib/modules/knowledge-graph/embeddings";

const prisma = new PrismaClient();

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log("=".repeat(64));

  const status = await getEmbeddingStatus();
  console.log(`جدول pgvector «embeddings» — الإجمالي: ${status.totalEmbeddings.toLocaleString("en")}`);
  console.log(`  حسب النوع: ${JSON.stringify(status.byOwnerType)}`);
  console.log(`  المتون:    ${JSON.stringify(status.corpus)}`);
  console.log(`  التغطية%:  ${JSON.stringify(status.coverage)}`);

  // الحقل المهجور (Json) — للأرشفة فقط، لا يُكتب إليه (المرحلة ٥).
  const jsonArchived = await prisma.legalArticle
    .count({ where: { embedding: { not: Prisma.AnyNull } } })
    .catch(() => -1);
  console.log(`\nالحقل المهجور legal_articles.embedding (Json) — صفوف محفوظة كأرشيف: ${jsonArchived.toLocaleString("en")}`);
  console.log("  (deprecated — مصدر الحقيقة الوحيد هو جدول pgvector؛ لا كتابة جديدة إليه.)");

  console.log("\n" + "=".repeat(64));
  if (status.coverage.articles >= 100) {
    console.log(`✅ تغطية المواد في pgvector = ${status.coverage.articles}% — مصدر دلالي واحد مكتمل.`);
    return;
  }
  console.log(`🔴 تغطية المواد في pgvector = ${status.coverage.articles}% (< 100%). شغّل backfill-embeddings (إلى الجدول) لإكمالها.`);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
