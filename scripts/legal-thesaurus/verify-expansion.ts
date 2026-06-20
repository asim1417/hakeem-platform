/**
 * verify-expansion.ts — تحقّق سريع (قراءة فقط) من ربط المكنز بتوسيع البحث.
 * يحمّل فهرس المفاهيم من القاعدة، ثم يطابق استعلامات نموذجية ويطبع المفاهيم
 * المُطابَقة + عيّنة من المرادفات المُضافة. يثبت أن التوسيع يعمل على البيانات الحقيقية.
 */
import { matchThesaurusConcepts } from "@/lib/modules/legal-thesaurus/concept-index";
import { prisma } from "@/lib/prisma";

const SAMPLES = [
  "ما حكم الفصل التعسفي للعامل؟",
  "نزاع حول عقد العمل ومكافأة نهاية الخدمة",
  "حماية الملكية الفكرية والعلامات التجارية",
  "دعوى الرهن العقاري",
  "بطلان العقد لعيب الرضا",
  "الاعتراض على حكم التحكيم",
];

async function main() {
  const total = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint AS c FROM legal_thesaurus_concepts`
  );
  console.log(`📚 مفاهيم المكنز في القاعدة: ${Number(total[0]?.c ?? 0)}`);
  console.log("=".repeat(60));

  let anyMatch = false;
  for (const q of SAMPLES) {
    const m = await matchThesaurusConcepts(q);
    if (m.conceptIds.length) anyMatch = true;
    console.log(`\n🔎 «${q}»`);
    console.log(`   مفاهيم مُطابَقة: ${m.matched.length} → ${m.matched.slice(0, 6).map((x) => x.label).join(" | ") || "—"}`);
    console.log(`   مرادفات مُضافة (${m.synonyms.length}): ${m.synonyms.slice(0, 8).join(" · ") || "—"}`);
    if (m.matched[0]) console.log(`   مثال إسناد: concept_id=${m.matched[0].id}`);
  }

  console.log("\n" + "=".repeat(60));
  if (!anyMatch) {
    console.error("✗ لم يُطابِق أي استعلام — تحقّق من الجداول/الأعمدة.");
    process.exit(1);
  }
  console.log("✅ التوسيع يعمل: الاستعلامات تُوسَّع بمفاهيم مُسنَدة لمعرّفات حقيقية.");
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
