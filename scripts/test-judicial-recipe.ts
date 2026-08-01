// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §16 — تحقّق محرّك توليف وصفة المستند (نقيّ).
// يفحص اختلاف الأقسام بالوظيفة، وربط الأنماط بالصوت، وبوّابات المنطوق، وفحوص السريان.
//   npm run test:jds-recipe
// ─────────────────────────────────────────────────────────────────────────────
import { synthesizeDocumentRecipe, characterizeJudicialTask, buildProcedureGraph } from "@/lib/modules/judicial";

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
  // ① وصفة صحيفة دعوى (محامٍ) — أقسام التحرير + صوت الطرف.
  const claimTc = characterizeJudicialTask({ role: "LAWYER", courtTrack: "COMMERCIAL", documentFunction: "CLAIM_FORMULATION", litigationStage: "FILING" });
  const claim = synthesizeDocumentRecipe({ taskId: "t1", characterization: claimTc });
  check("صحيفة الدعوى: قسم الأطراف موجود", claim.sections.some((s) => s.key === "parties"));
  check("صحيفة الدعوى: قسم الطلبات موجود", claim.sections.some((s) => s.key === "requests"));
  check("صوت المحامي = طرف", claim.roleProfile === "JUDICIAL_PARTY");
  check("أقسام المحامي تحظر أنماط صوت المحكمة", claim.sections.every((s) => s.prohibitedPatternIds.length > 0));

  // ② وصفة حكم (قاضٍ) — أقسام مختلفة تمامًا + صوت المحكمة + بوّابات المنطوق.
  const dispTc = characterizeJudicialTask({ role: "JUDGE", courtTrack: "GENERAL", documentFunction: "DISPOSITION", litigationStage: "JUDGMENT" });
  const disp = synthesizeDocumentRecipe({ taskId: "t2", characterization: dispTc });
  check("الحكم: قسم المنطوق موجود", disp.sections.some((s) => s.key === "operative"));
  check("اختلاف الأقسام بالوظيفة (حكم ≠ صحيفة)", JSON.stringify(disp.sections.map((s) => s.key)) !== JSON.stringify(claim.sections.map((s) => s.key)));
  check("صوت القاضي = محكمة مقيّدة", disp.roleProfile === "JUDICIAL_BENCH_RESTRICTED");
  const operative = disp.sections.find((s) => s.key === "operative");
  check("قسم المنطوق يحمل بوّابة عدم التجاوز JG15", !!operative && operative.qualityGateIds.includes("JG15"));
  check("قسم المنطوق يحمل بوّابة الاتّساق JG16", !!operative && operative.qualityGateIds.includes("JG16"));

  // ③ وصفة اعتراض — قسم الأوجه يحمل بوّابة مصطلح الطريق JG14.
  const objTc = characterizeJudicialTask({ role: "LAWYER", courtTrack: "COMMERCIAL", documentFunction: "OBJECTION", litigationStage: "APPEAL" });
  const obj = synthesizeDocumentRecipe({ taskId: "t3", characterization: objTc });
  check("الاعتراض: قسم الأوجه يحمل JG14", obj.sections.find((s) => s.key === "grounds")?.qualityGateIds.includes("JG14") === true);

  // ④ فجوة السريان: وصفةٌ فيها سلطةٌ مطلوبة وبلا lawAsOfDate → NEEDS_REVIEW + فحصٌ إلزاميّ للسريان.
  const claimNeedsAuth = synthesizeDocumentRecipe({ taskId: "t4", characterization: claimTc });
  check("بلا سريان + سلطةٌ مطلوبة: الوصفة NEEDS_REVIEW", claimNeedsAuth.validationStatus === "NEEDS_REVIEW");
  check("فحصٌ إلزاميّ للسريان حين توجد سلطةٌ مطلوبة", claimNeedsAuth.mandatoryProceduralChecks.some((c) => c.includes("سريان")));

  // ⑤ ربطٌ بخريطة الإجراءات: تمرير graph يضخّ متطلّباته غير المحلولة في الفحوص.
  const graph = buildProcedureGraph({ caseId: "cX", domainPackId: "COMMERCIAL_PACK", litigationStage: "FILING" });
  const withGraph = synthesizeDocumentRecipe({ taskId: "t5", characterization: claimTc, procedureGraph: graph });
  check("متطلّبات خريطة الإجراءات غير المحلولة تدخل الفحوص", withGraph.mandatoryProceduralChecks.length >= graph.unresolvedRequirements.length && graph.unresolvedRequirements.length > 0);
  check("ربط معرّف خريطة الإجراءات بالوصفة", withGraph.procedureGraphId === graph.id);

  // ⑥ نسخة حزمة المجال مثبّتة في الوصفة.
  check("نسخة حزمة المجال مثبّتة", disp.domainPackVersion.includes("@"));

  console.log(`\nنتيجة JDS §16 (recipe-synthesizer): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
