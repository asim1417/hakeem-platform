// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §12 — تحقّق محرّك خريطة الإجراءات (نقيّ، بلا قاعدة).
// يفحص المواءمة بالحزمة، وحساب الجاهزيّة، والتفرّع الشرطيّ (إقرار/إنكار)، وفجوة السلطة.
//   npm run test:jds-procedure
// ─────────────────────────────────────────────────────────────────────────────
import { buildProcedureGraph } from "@/lib/modules/judicial";

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
  // ① رسمٌ أساسيّ بلا وقائع: العقد الأساسيّة موجودة، والحكم محجوز (متطلّبات ناقصة).
  const g = buildProcedureGraph({ caseId: "c1", domainPackId: "GENERAL_CIVIL_PACK", litigationStage: "PLEADING" });
  check("توجد عقدة تحرير الدعوى", g.nodes.some((n) => n.id === "filing"));
  check("توجد عقدة الحكم", g.nodes.some((n) => n.id === "merits_decision"));
  check("متطلّبات غير محلولة عند غياب الوقائع", g.unresolvedRequirements.length > 0);
  check("الحالة NEEDS_INPUT عند نقص المدخلات", g.validationStatus === "NEEDS_INPUT");

  // ② التفرّع الشرطيّ (§17): حافّتا الإقرار والإنكار من الجواب موجودتان.
  const fromAnswer = g.edges.filter((e) => e.from === "answer").map((e) => e.to);
  check("الجواب يتفرّع إلى الحكم عند الإقرار", fromAnswer.includes("merits_decision"));
  check("الجواب يتفرّع إلى الإثبات عند الإنكار", fromAnswer.includes("evidence"));

  // ③ المواءمة بالحزمة (§8): التنفيذ لا ينطبق في الحزمة المدنيّة العامّة (ليست ضمن مراحلها)،
  //    وينطبق في حزمة التنفيذ.
  const execInGeneral = g.nodes.find((n) => n.id === "execution");
  check("التنفيذ NOT_APPLICABLE في المدنيّة العامّة", execInGeneral?.status === "NOT_APPLICABLE");
  const gExec = buildProcedureGraph({ caseId: "c2", domainPackId: "EXECUTION_PACK", litigationStage: "EXECUTION" });
  check("التنفيذ منطبقٌ في حزمة التنفيذ", gExec.nodes.find((n) => n.id === "execution")?.status !== "NOT_APPLICABLE");

  // ④ الجاهزيّة تتقدّم مع توافر الوقائع/المستندات.
  const ready = buildProcedureGraph({
    caseId: "c3",
    domainPackId: "GENERAL_CIVIL_PACK",
    litigationStage: "FILING",
    knownFacts: ["أطراف الدعوى", "صفة كلّ طرف"],
    availableDocuments: ["وكالة/تمثيل عند اللزوم"],
  });
  check("المتطلّبات القبليّة جاهزة عند توافر عناصرها", ready.nodes.find((n) => n.id === "precondition")?.status === "READY");

  // ⑤ فجوة السلطة (§6.1/§7): عقدٌ نظاميّة تتطلّب سلطةً، وبلا lawAsOfDate تُعلَّم NEEDS_AUTHORITY.
  const complete = buildProcedureGraph({
    caseId: "c4",
    domainPackId: "GENERAL_CIVIL_PACK",
    litigationStage: "JUDGMENT",
    knownFacts: ["أطراف الدعوى", "صفة كلّ طرف", "الواقعة المنشئة", "المدّعى به", "الطلبات", "بيانات الخصم", "موقف الخصم من كلّ ادّعاء", "الوقائع المؤثّرة", "الوقائع المتنازع عليها", "الوقائع الثابتة", "المسائل"],
    availableDocuments: ["وكالة/تمثيل عند اللزوم", "صحيفة الدعوى", "محضر التبليغ", "المذكّرة الجوابيّة", "الأدلّة"],
  });
  check("العقد الأساسيّة كلّها محلولة (لا unresolved)", complete.unresolvedRequirements.length === 0);
  check("بلا تاريخ سريان: الحالة NEEDS_AUTHORITY لا VALIDATED", complete.validationStatus === "NEEDS_AUTHORITY");
  check("عقدة الحكم تتطلّب سلطةً ساريةً", (complete.nodes.find((n) => n.id === "merits_decision")?.requiredAuthorities.length ?? 0) > 0);

  // ⑥ العقد المشروطة لا تنشئ حوافًّا حين تكون NOT_APPLICABLE.
  check("لا حافّة إلى عقدة غير منطبقة", g.edges.every((e) => execInGeneral?.status !== "NOT_APPLICABLE" || (e.from !== "execution" && e.to !== "execution")));

  console.log(`\nنتيجة JDS §12 (procedure-graph): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();
