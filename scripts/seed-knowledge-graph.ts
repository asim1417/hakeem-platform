/**
 * بذر علاقات الرسم المعرفي من الروابط القائمة (مادة↔حكم) والمبادئ (حكم↔مبدأ).
 * لا يخترق المحرّكات؛ يحوّل بيانات حقيقية موجودة إلى صفوف legal_relations.
 *
 * آمن: dry-run افتراضياً (لا يكتب). للتطبيق الفعلي: --apply.
 * idempotent: يتخطّى العلاقات الموجودة مسبقاً.
 *
 * التشغيل:
 *   npm run seed:kg            # معاينة (dry-run)
 *   npm run seed:kg -- --apply # تطبيق فعلي على القاعدة المضبوطة في DATABASE_URL
 */
import { prisma } from "@/lib/prisma";
import { planRelations, relationKey, type RelationSpec } from "@/lib/modules/knowledge-graph/relation-derivation";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;

async function main() {
  console.log(`🌱 بذر الرسم المعرفي — الوضع: ${APPLY ? "تطبيق فعلي (--apply)" : "معاينة (dry-run)"}`);
  console.log("=".repeat(56));

  const [links, principles] = await Promise.all([
    prisma.legalArticleCaseLink.findMany({
      select: { articleId: true, caseId: true, relationType: true, confidence: true },
      ...(LIMIT ? { take: LIMIT } : {}),
    }),
    prisma.judicialPrinciple.findMany({
      select: { id: true, sourceCaseId: true, confidence: true },
      ...(LIMIT ? { take: LIMIT } : {}),
    }),
  ]);

  console.log(`روابط مادة↔حكم: ${links.length} · مبادئ حكم↔مبدأ: ${principles.length}`);
  const specs = planRelations(links, principles);
  console.log(`علاقات مُخطّطة (بلا تكرار داخلي): ${specs.length}`);

  if (specs.length === 0) {
    console.log("لا روابط مصدرية بعد — شغّل ربط الأحكام (link:judgments) أولاً لإثراء العلاقات.");
    return;
  }

  // منع التكرار مقابل الموجود فعلاً في القاعدة.
  const existing = await prisma.legalRelation.findMany({
    select: { sourceType: true, sourceId: true, targetType: true, targetId: true, relation: true },
  });
  const existingKeys = new Set(
    existing.map((e) => relationKey({ sourceType: e.sourceType as RelationSpec["sourceType"], sourceId: e.sourceId, targetType: e.targetType as RelationSpec["targetType"], targetId: e.targetId, relation: e.relation, strength: 0 }))
  );
  const toCreate = specs.filter((s) => !existingKeys.has(relationKey(s)));
  console.log(`جديدة (غير موجودة): ${toCreate.length} · موجودة مسبقاً: ${specs.length - toCreate.length}`);

  const byRelation = toCreate.reduce<Record<string, number>>((acc, s) => ((acc[s.relation] = (acc[s.relation] ?? 0) + 1), acc), {});
  console.log("التوزيع:", JSON.stringify(byRelation));

  if (!APPLY) {
    console.log("\nمعاينة فقط — لم يُكتب شيء. أعِد التشغيل بـ --apply للتطبيق.");
    return;
  }

  let created = 0;
  for (const s of toCreate) {
    await prisma.legalRelation
      .create({ data: { sourceType: s.sourceType, sourceId: s.sourceId, targetType: s.targetType, targetId: s.targetId, relation: s.relation, strength: s.strength, description: s.description ?? null } })
      .then(() => created++)
      .catch(() => undefined);
  }
  console.log(`\n✅ أُنشئت ${created} علاقة في legal_relations.`);
}

main()
  .catch((e) => {
    console.error("❌ فشل البذر:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
