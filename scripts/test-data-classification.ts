// اختبار تصنيف البيانات (§21) — نواة نقيّة.
import {
  classify,
  rank,
  clearanceSatisfies,
  labelAr,
  classificationAudit,
  DEFAULT_DATA_CLASS,
} from "../lib/modules/security/data-classification";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

assert(classify(null) === DEFAULT_DATA_CLASS, "null يُعامَل INTERNAL");
assert(classify("RESTRICTED") === "RESTRICTED", "يحترم التصنيف الصريح");
assert(rank("PUBLIC") < rank("RESTRICTED"), "ترتيب الحساسية تصاعديّ");
assert(clearanceSatisfies("RESTRICTED", "CONFIDENTIAL"), "تصريح أعلى يكفي لأدنى");
assert(!clearanceSatisfies("INTERNAL", "RESTRICTED"), "تصريح أدنى لا يكفي لأعلى");
assert(labelAr("CONFIDENTIAL") === "سرّيّ", "التسمية العربية");
const a = classificationAudit(null);
assert(a.dataClass === "INTERNAL" && a.explicit === false, "حمولة تدقيق للغياب");
const b = classificationAudit("RESTRICTED");
assert(b.explicit === true && b.dataClassRank === 3, "حمولة تدقيق صريحة");

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nتصنيف البيانات: كل التحقّقات ناجحة.");
