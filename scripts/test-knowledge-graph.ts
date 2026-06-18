/**
 * اختبار بسيط للرسم المعرفي القانوني (Knowledge Graph).
 * يتحقق من: إنشاء علاقة، قراءة العلاقات، ربط مادة بحكم، ربط مادة بمبدأ.
 *
 * التشغيل (محلي/تطوير فقط — لا تُشغّله على الإنتاج):
 *   npm run test:kg
 * يتطلّب DATABASE_URL وجداول الرسم المعرفي مُفعّلة (migration add_knowledge_graph_pgvector).
 * يُنظّف ما ينشئه (idempotent).
 */
import { prisma } from "@/lib/prisma";
import {
  createRelation,
  getRelationsForEntity,
  hydrateRelations,
} from "@/lib/modules/knowledge-graph/relations";

async function main() {
  console.log("🧪 اختبار الرسم المعرفي القانوني");
  console.log("=".repeat(50));

  // ١. التقط كيانات حقيقية إن وُجدت، وإلا استخدم معرّفات تجريبية
  const [article, ruling, principle] = await Promise.all([
    prisma.legalArticle.findFirst({ select: { id: true, lawName: true, articleNumber: true } }),
    prisma.judicialCase.findFirst({ select: { id: true, caseNo: true } }),
    prisma.judicialPrinciple.findFirst({ select: { id: true, title: true } }),
  ]);

  const articleId = article?.id ?? "test-article-kg";
  const rulingId = ruling?.id ?? "test-ruling-kg";
  const principleId = principle?.id ?? "test-principle-kg";

  console.log(`  مادة:  ${article ? `حقيقية (${article.lawName} م/${article.articleNumber})` : "تجريبية"} → ${articleId}`);
  console.log(`  حكم:   ${ruling ? "حقيقي" : "تجريبي"} → ${rulingId}`);
  console.log(`  مبدأ:  ${principle ? "حقيقي" : "تجريبي"} → ${principleId}`);

  const created: string[] = [];
  let passed = 0;
  let failed = 0;
  const check = (cond: boolean, label: string) => {
    console.log(`  ${cond ? "✅" : "❌"} ${label}`);
    cond ? passed++ : failed++;
  };

  try {
    // ٢. إنشاء علاقة: مادة → حكم (يدعم)
    const r1 = await createRelation({
      sourceType: "article",
      sourceId: articleId,
      targetType: "ruling",
      targetId: rulingId,
      relation: "SUPPORTS",
      strength: 0.9,
      description: "اختبار: ربط مادة بحكم",
    });
    created.push(r1.id);
    check(Boolean(r1.id), "إنشاء علاقة (مادة → حكم)");

    // ٣. ربط مادة بمبدأ (يفسّر)
    const r2 = await createRelation({
      sourceType: "article",
      sourceId: articleId,
      targetType: "principle",
      targetId: principleId,
      relation: "INTERPRETS",
      strength: 0.75,
      description: "اختبار: ربط مادة بمبدأ",
    });
    created.push(r2.id);
    check(Boolean(r2.id), "ربط مادة بمبدأ (مادة → مبدأ)");

    // ٤. قراءة علاقات المادة
    const relations = await getRelationsForEntity("article", articleId);
    check(relations.length >= 2, `قراءة العلاقات (وُجد ${relations.length})`);

    // ٥. التحقق من الإثراء (resolve الكيانات)
    const hydrated = await hydrateRelations(relations);
    const hasRuling = hydrated.some((h) => h.target.type === "ruling");
    const hasPrinciple = hydrated.some((h) => h.target.type === "principle");
    check(hasRuling, "إثراء: ظهور الحكم المرتبط");
    check(hasPrinciple, "إثراء: ظهور المبدأ المرتبط");

    console.log("\n  أمثلة من العلاقات المُثراة:");
    for (const h of hydrated.slice(0, 4)) {
      console.log(`    ${h.source.label}  —(${h.relation}, ${h.strength})→  ${h.target.label}`);
    }
  } finally {
    // ٦. تنظيف ما أُنشئ (idempotent)
    if (created.length) {
      await prisma.legalRelation.deleteMany({ where: { id: { in: created } } });
      console.log(`\n  🧹 نُظّفت ${created.length} علاقة تجريبية.`);
    }
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار الرسم المعرفي.");
}

main().catch((e) => {
  console.error("\n❌ فشل الاختبار:", e instanceof Error ? e.message : e);
  process.exit(1);
});
