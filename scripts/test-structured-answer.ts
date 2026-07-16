// اختبار الصياغة المنهجية (المرحلة ٥) — نقيّ. يغطّي: ثبات الأقسام الإلزامية الخمسة،
// وفحص البنية، واستخراج الذيول الرقمية [n] (أساس فحص «كل معلومة بسند» — HLS‑4.6/5.10).
import { ANSWER_SECTIONS, hasAllSections, citedFootnotes } from "@/lib/modules/agents/thinking/analysis";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  cond ? (pass += 1, console.log(`✓ ${name}`)) : (fail += 1, console.log(`✗ ${name}`));
}

// ── الأقسام الإلزامية بالترتيب ──
const EXPECTED = ["تحرير المسألة", "الأنظمة والاتجاهات وأسانيدها", "الدفوع المتقابلة", "الحكم النظاميّ المطبَّق", "الأثر العمليّ"];
check("خمسة أقسام إلزامية بالترتيب", ANSWER_SECTIONS.length === 5 && EXPECTED.every((s, i) => ANSWER_SECTIONS[i] === s));

// ── فحص البنية ──
const good = `تحرير المسألة: كذا [1]. الأنظمة والاتجاهات وأسانيدها: كذا [2]. الدفوع المتقابلة: كذا. الحكم النظاميّ المطبَّق: كذا [1]. الأثر العمليّ: كذا.`;
const bad = `تحرير المسألة فقط ثم خلاصة سريعة.`;
check("hasAllSections يقبل الجواب المكتمل", hasAllSections(good));
check("hasAllSections يرفض الجواب الناقص", !hasAllSections(bad));

// ── الذيول الرقمية ──
check("citedFootnotes يستخرج [1],[2] بلا تكرار", (() => {
  const f = citedFootnotes(good).sort((a, b) => a - b);
  return f.length === 2 && f[0] === 1 && f[1] === 2;
})());
check("citedFootnotes فارغ لجواب بلا ذيول", citedFootnotes("نصّ بلا أسانيد").length === 0);

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
