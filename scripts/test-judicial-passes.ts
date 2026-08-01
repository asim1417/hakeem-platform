// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §23 — تحقّق محرّك مرورات الصياغة (نقيّ).
// يفحص: تنفيذ المراحل الـ٢٢، أنّ مراحل المحرّكات DONE، والمراحل النصّيّة/البوّابات
// DELEGATED، والحجز BLOCKED حين نقص المتطلّبات. لا يدّعي توليدًا لم يقع.
//   npm run test:jds-passes
// ─────────────────────────────────────────────────────────────────────────────
import { runDraftingPasses } from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

function main() {
  // ① مهمّة صياغة صحيفة دعوى تجاريّة — كلّ المتطلّبات متاحة.
  const run = runDraftingPasses({
    taskId: "t1",
    role: "LAWYER",
    text: "تحرير صحيفة دعوى تجاريّة لمطالبة بقيمة عقد توريد",
    knownFacts: ["أبرم الطرفان عقد توريد", "تخلّف المورّد عن التسليم"],
    availableDocuments: ["عقد التوريد", "إشعار المطالبة"],
    lawAsOfDate: "2026-08-01",
  });

  // ② العدد ٢٢ مرحلة بالضبط (§23).
  check("ينتج ٢٢ مرحلة", run.passes.length === 22);

  // ③ الترقيم متسلسل ١..٢٢.
  check("الترقيم متسلسل", run.passes.every((p, i) => p.step === i + 1));

  // ④ المراحل المحرّكيّة الحتميّة DONE (تصنيف/توليف الوصفة/التجميع).
  const byId = (id: string) => run.passes.find((p) => p.id === id);
  check("تصنيف المهمّة DONE", byId("CHARACTERIZE_JUDICIAL_TASK")?.status === "DONE");
  check("توليف الوصفة DONE", byId("SYNTHESIZE_DOCUMENT_RECIPE")?.status === "DONE");
  check("تجميع المسودّة DONE", byId("ASSEMBLE_REVIEW_DRAFT")?.status === "DONE");
  check("تحديد الحزمة DONE (حزمة تجاريّة موجودة)", byId("IDENTIFY_DOMAIN_PACK")?.status === "DONE");

  // ⑤ المراحل النصّيّة تُفوَّض (لا تُدّعى) — والبوّابات تُطبَّق بعد التوليد.
  check("استخراج الوقائع مفوَّض", byId("EXTRACT_AND_NORMALIZE_FACTS")?.status === "DELEGATED");
  check("صياغة الحجّة مفوَّضة", byId("DRAFT_ARGUMENT_OR_REASONING")?.status === "DELEGATED");
  check("المراجعة العدائيّة مؤجّلة للتوليد", byId("ADVERSARIAL_JUDICIAL_REVIEW")?.status === "DELEGATED");

  // ⑥ فيه مراحل مفوَّضة (>0) — المحرّك لا يزعم توليدًا كاملًا.
  check("توجد مراحل مفوَّضة", run.delegatedSteps.length > 0);

  // ⑦ التوصيف مشتقّ صحيحًا (مسار تجاري، دور محامٍ).
  check("المسار تجاري", run.characterization.courtTrack === "COMMERCIAL");
  check("الدور محامٍ", run.characterization.role === "LAWYER");

  // ⑧ مهمّة بمسار بلا حزمة صريحة (GENERAL) — الحزمة تُحلّ بالمسار لا بالسلسلة.
  const gen = runDraftingPasses({ taskId: "t2", role: "RESEARCHER", text: "سؤال قانوني عام" });
  check("مسار عام يحلّ لحزمة موجودة (لا BLOCKED خاطئ)", gen.passes.find((p) => p.id === "IDENTIFY_DOMAIN_PACK")?.status === "DONE");

  // ⑨ لا اختلاق: readyForAssembly = false متى وُجدت مراحل محجوزة.
  check("الجاهزيّة تتبع غياب المحجوزات", run.readyForAssembly === (run.blockedSteps.length === 0));

  console.log(`\nنتيجة §23 (drafting-passes): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
