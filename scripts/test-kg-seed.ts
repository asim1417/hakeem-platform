/**
 * اختبار اشتقاق علاقات الرسم المعرفي (دوال نقيّة، بلا قاعدة).
 * التشغيل: npm run test:kg-seed
 */
import {
  mapLinkRelationType,
  clampStrength,
  relationFromArticleCaseLink,
  relationFromPrinciple,
  planRelations,
  relationKey,
} from "@/lib/modules/knowledge-graph/relation-derivation";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار اشتقاق علاقات الرسم المعرفي");
  console.log("=".repeat(50));

  // ١. تحويل نوع الربط
  check(mapLinkRelationType("سند") === "SUPPORTS", "«سند» → SUPPORTS");
  check(mapLinkRelationType("تفسير") === "INTERPRETS", "«تفسير» → INTERPRETS");
  check(mapLinkRelationType("تعارض") === "CONTRADICTS", "«تعارض» → CONTRADICTS");
  check(mapLinkRelationType("غير معروف") === "RELATED_TO", "غير معروف → RELATED_TO");
  check(mapLinkRelationType(null) === "RELATED_TO", "null → RELATED_TO");

  // ٢. قص الثقة
  check(clampStrength(1.5) === 1 && clampStrength(-1) === 0 && clampStrength(0.4) === 0.4, "قص الثقة 0..1");
  check(clampStrength(null) === 0.7, "ثقة غائبة → 0.7 افتراضي");

  // ٣. علاقة مادة↔حكم
  const r = relationFromArticleCaseLink({ articleId: "a1", caseId: "c1", relationType: "سند", confidence: 0.9 });
  check(r.sourceType === "article" && r.targetType === "ruling" && r.relation === "SUPPORTS" && r.strength === 0.9, "علاقة مادة↔حكم صحيحة");

  // ٤. علاقة حكم↔مبدأ
  const p = relationFromPrinciple({ id: "p1", sourceCaseId: "c1", confidence: null });
  check(p.sourceType === "ruling" && p.targetType === "principle" && p.relation === "INTERPRETS" && p.strength === 0.8, "علاقة حكم↔مبدأ صحيحة");

  // ٥. الخطة بلا تكرار
  const plan = planRelations(
    [
      { articleId: "a1", caseId: "c1", relationType: "سند", confidence: 0.9 },
      { articleId: "a1", caseId: "c1", relationType: "سند", confidence: 0.9 }, // مكرّر
      { articleId: "a2", caseId: "c1", relationType: "تفسير", confidence: 0.5 },
    ],
    [{ id: "p1", sourceCaseId: "c1", confidence: 0.7 }]
  );
  check(plan.length === 3, `إزالة التكرار (3 من 4 مدخلات): ${plan.length}`);
  check(new Set(plan.map(relationKey)).size === plan.length, "مفاتيح التفرّد فريدة");

  // ٦. خطة فارغة لا تكسر
  check(planRelations([], []).length === 0, "بلا مدخلات → خطة فارغة");

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار اشتقاق علاقات الرسم المعرفي.");
}

main();
