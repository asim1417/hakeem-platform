// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §23/§28 — تحقّق واجهة JDS الموحّدة (نقيّ).
// يفحص أنّ نداءً واحدًا يعطي الخطّة الكاملة، وأنّ المراجعة بعد التوليد تمنع المخالف.
//   npm run test:jds-orchestrator
// ─────────────────────────────────────────────────────────────────────────────
import { planJudicialTask, reviewJudicialDraft, isJdsFlagOn, isJdsDraftingShadowEnabled } from "@/lib/modules/judicial";

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
  // ① نداءٌ واحد يعطي: تصنيف + خريطة إجراءات + وصفة + جاهزيّة.
  const plan = planJudicialTask({
    taskId: "T-1",
    role: "LAWYER",
    courtTrack: "COMMERCIAL",
    documentFunction: "CLAIM_FORMULATION",
    litigationStage: "FILING",
    text: "تحرير دعوى تجاريّة",
  });
  check("الخطّة تحوي التصنيف", plan.characterization.courtTrack === "COMMERCIAL");
  check("الخطّة تحوي خريطة إجراءات", plan.procedureGraph.nodes.length > 0);
  check("الخطّة تحوي وصفة مستند", plan.recipe.sections.length > 0);
  check("بلا وقائع: لا يمكن الصياغة بعد", plan.readiness.canDraft === false);
  check("بلا وقائع: توجد مدخلاتٌ ناقصة", plan.readiness.needsInput.length > 0);
  check("يلزم إثبات سريان السلطة", plan.readiness.needsAuthority === true);

  // ② مع اكتمال المدخلات: يمكن الصياغة.
  const ready = planJudicialTask({
    taskId: "T-2",
    role: "LAWYER",
    courtTrack: "COMMERCIAL",
    documentFunction: "CLAIM_FORMULATION",
    litigationStage: "FILING",
    knownFacts: ["أطراف الدعوى", "صفة كلّ طرف", "الواقعة المنشئة", "الوقائع المؤثّرة", "الطلبات"],
    availableDocuments: ["وكالة/تمثيل عند اللزوم", "صحيفة الدعوى"],
  });
  check("مع اكتمال المدخلات: يمكن الصياغة", ready.readiness.canDraft === true);

  // ③ المراجعة بعد التوليد: مسودّة قاضٍ بلا وسمٍ ومع تجاوز الطلبات = غير جاهزة.
  const judgePlan = planJudicialTask({ taskId: "T-3", role: "JUDGE", courtTrack: "GENERAL", documentFunction: "DISPOSITION", litigationStage: "JUDGMENT" });
  const bad = reviewJudicialDraft(judgePlan, {
    draftText: "حكمت الدائرة بإلزام المدعى عليه بالمبلغ وبحبسه.",
    requests: ["إلزام المدعى عليه بالمبلغ"],
    dispositionItems: ["إلزام المدعى عليه بالمبلغ", "حبسه"],
    hasNonBindingLabel: false,
  });
  check("مراجعة مسودّة القاضي المخالفة: غير جاهزة", bad.ready === false);
  check("تُرصد بوّابة الوسم JG19 مانعة", bad.blocking.includes("JG19"));
  check("تُرصد بوّابة تجاوز الطلبات JG15 مانعة", bad.blocking.includes("JG15"));

  // ④ مسودّةٌ نظيفةٌ موسومةٌ ومتّسقة: لا مانع (تبقى بوّابات مراجعةٍ خارجيّة).
  const good = reviewJudicialDraft(judgePlan, {
    draftText: "وحيث ثبت من المستند… تقضي الدائرة بإلزام المدعى عليه بالمبلغ. (مسودّة داخليّة غير ملزمة)",
    requests: ["إلزام المدعى عليه بالمبلغ"],
    dispositionItems: ["إلزام المدعى عليه بالمبلغ"],
    hasNonBindingLabel: true,
  });
  check("مسودّة نظيفة: لا بوّابة مانعة", good.ready === true);
  check("مسودّة نظيفة: تبقى بوّابات مراجعةٍ خارجيّة (سريان/استشهاد)", good.review.length > 0);

  // ⑤ §31-I — أعلام التفعيل مطفأةٌ افتراضيًّا (لا تغيير سلوكٍ حيّ ما لم تُضبط بيئةً).
  const wasSet = process.env.JDS_DRAFTING_SHADOW;
  delete process.env.JDS_DRAFTING_SHADOW;
  check("الظلّ الصياغيّ مطفأٌ افتراضيًّا", isJdsDraftingShadowEnabled() === false);
  check("أعلام JDS مطفأةٌ افتراضيًّا", isJdsFlagOn("PROCEDURE_V2") === false && isJdsFlagOn("DISPOSITION_V2") === false);
  process.env.JDS_DRAFTING_SHADOW = "1";
  check("الظلّ يُفعَّل صراحةً بالبيئة", isJdsDraftingShadowEnabled() === true);
  if (wasSet === undefined) delete process.env.JDS_DRAFTING_SHADOW;
  else process.env.JDS_DRAFTING_SHADOW = wasSet;

  console.log(`\nنتيجة JDS §23/§28 (orchestrator): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
