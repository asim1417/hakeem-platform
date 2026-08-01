// اختبار آلة حالة سير العمل (§14) — نواة نقيّة.
import {
  BLUEPRINT_WORKFLOW,
  SIMULATION_WORKFLOW,
  canAdvance,
  nextStates,
  entryGates,
  isTerminal,
} from "../lib/modules/workflow/state-machine";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

// المخطط العام.
assert(BLUEPRINT_WORKFLOW.initial === "Created", "البداية Created");
assert(isTerminal(BLUEPRINT_WORKFLOW, "Archived"), "Archived نهائيّة");
assert(canAdvance(BLUEPRINT_WORKFLOW, "Created", "Planned"), "Created→Planned مسموح");
assert(!canAdvance(BLUEPRINT_WORKFLOW, "Created", "Archived"), "Created→Archived غير مسموح");
assert(canAdvance(BLUEPRINT_WORKFLOW, "Review", "Revision"), "Review→Revision مسموح");
assert(entryGates(BLUEPRINT_WORKFLOW, "Revision", "Review").includes("revision-addressed"), "بوابة العودة للمراجعة");

// المحاكاة القضائية.
assert(SIMULATION_WORKFLOW.initial === "CLAIM_FILING", "المحاكاة تبدأ بتقييد الدعوى");
assert(canAdvance(SIMULATION_WORKFLOW, "PLEADING", "SETTLEMENT"), "مسار الصلح البديل");
assert(nextStates(SIMULATION_WORKFLOW, "PLEADING").includes("SETTLEMENT"), "الصلح ضمن التالي من المرافعة");
assert(isTerminal(SIMULATION_WORKFLOW, "OBJECTION"), "الاعتراض نهائيّ");

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nآلة حالة سير العمل: كل التحقّقات ناجحة.");
