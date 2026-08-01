// اختبار سجلّ البرومبتات (§17) — كتالوج نقيّ.
import { listPrompts, getPrompt, validateRegistry } from "../lib/modules/ai/prompts/registry";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

assert(listPrompts().length >= 10, "الكتالوج يحوي البرومبتات الأساسية");
assert(getPrompt("legal.answer.system")?.owner === "legal-core", "استرجاع برومبت بالمعرّف");
assert(getPrompt("unknown.id") === null, "معرّف مجهول يعيد null");
const v = validateRegistry();
assert(v.ok, `تفرّد المعرّفات وصحّة الإصدارات: ${v.errors.join("، ")}`);

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nسجلّ البرومبتات: كل التحقّقات ناجحة.");
