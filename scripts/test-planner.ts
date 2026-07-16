// اختبار المخطِّط (المرحلة ٢) — نقيّ بلا قاعدة. يغطّي قبول HLS‑3.5/5.2:
// الحصر في نظامين → مسألتان مستقلّتان (نظامان)؛ والتصنيف والتفكيك.
import { classifyQuery, buildPlan, describePlan } from "@/lib/modules/agents/thinking/planner";
import type { SystemRef } from "@/lib/modules/agents/substrate/systems-registry";
import type { LegalIssue } from "@/lib/modules/agents/thinking/takyeef";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

const REG: SystemRef[] = [
  { id: "s-labor", name: "نظام العمل" },
  { id: "s-civil", name: "نظام المعاملات المدنية" },
  { id: "s-company", name: "نظام الشركات" },
];

// ── التصنيف ──
check("حصر مفهوميّ: «احصر كل المدد»", classifyQuery("احصر كل المدد في نظام العمل", REG).queryClass === "حصر_مفهوميّ");
check("مقارنة: «الفرق بين»", classifyQuery("الفرق بين الفسخ والبطلان في نظام المعاملات المدنية", REG).queryClass === "مقارنة");
check("متعدّد الأنظمة: نظامان بلا حصر/مقارنة", classifyQuery("مسؤولية الشريك في نظام الشركات وأثرها في نظام العمل", REG).queryClass === "متعدّد_الأنظمة");
check("بحث مركّز: سؤال بسيط", classifyQuery("ما شروط فسخ عقد الإيجار؟", REG).queryClass === "بحث_مركّز");

// ── القبول: الحصر في نظامين → مسألتان مستقلّتان ──
const plan2 = buildPlan("احصر كل المدد في نظام العمل ونظام المعاملات المدنية", REG);
check("الحصر في نظامين → مسألتان", plan2.issues.length === 2);
check("كل مسألة مرتبطة بنظام مستقلّ", (() => {
  const ids = new Set(plan2.issues.map((i) => i.systemId));
  return ids.has("s-labor") && ids.has("s-civil") && ids.size === 2;
})());
check("كل مسألة تبدأ pending (تُتتبَّع مستقلّة)", plan2.issues.every((i) => i.status === "pending"));

// ── البحث المركّز يعتمد مسائل التكييف ──
const tk: LegalIssue[] = [
  { issue: "صحة عقد الإيجار", manat: "التراضي", keywords: ["إيجار"] },
  { issue: "أثر الإخلال بالأجرة", manat: "الإخلال", keywords: ["أجرة"] },
];
const planFocused = buildPlan("ما حكم تأخر المستأجر عن الأجرة؟", REG, tk);
check("البحث المركّز يفكّك حسب التكييف (مسألتان)", planFocused.issues.length === 2 && planFocused.issues[0].label.includes("عقد الإيجار"));

// ── حصر بلا نظام مذكور → مسألة واحدة ──
const planNoSys = buildPlan("ما هي كل حالات البطلان؟", REG);
check("حصر بلا نظام → مسألة واحدة", planNoSys.issues.length === 1);

check("describePlan يذكر التصنيف والأنظمة", describePlan(plan2).includes("حصر_مفهوميّ") && describePlan(plan2).includes("نظام العمل"));

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
