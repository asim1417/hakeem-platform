// اختبار طبقة التشغيل (@hakeem/agent-runtime المدمجة) — الحرّاس + البوابة + المهلة + المسار.
// يُشغَّل: `npm run test:runtime`. سلوكيّ نقيّ (بلا قاعدة حيّة).
import {
  gregorianToJDN, jdnToGregorian, hijriToJDN, jdnToHijri,
  gregorianToHijri, hijriToGregorian, addDaysHijri, computeDeadline,
} from "@/lib/agent-runtime/tools/hijriDateCalc";
import { runEnforcement } from "@/lib/agent-runtime/enforcement/enforce";
import { runConformance } from "@/lib/agent-runtime/conformance/runner";
import { STANCE_CASES } from "@/lib/agent-runtime/conformance/cases";
import { scoreAgent, STRUCTURAL_GOLDEN } from "@/lib/agent-runtime/eval/goldenSet";
import { handleSearch } from "@/lib/agent-runtime/pipeline/searchRoute";
import type { AnswerForGuard, EngineResult } from "@/lib/agent-runtime/types";

let pass = 0, fail = 0;
const T = (name: string, cond: boolean, extra = "") => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name + (cond ? "" : " " + extra));
  cond ? pass++ : fail++;
};
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// ── hijri_date_calc ──
T("مرساة JDN: 2000-01-01 = 2451545", gregorianToJDN(2000, 1, 1) === 2451545, String(gregorianToJDN(2000, 1, 1)));
T("ميلاديّ round-trip", same(jdnToGregorian(gregorianToJDN(2026, 7, 18)), { year: 2026, month: 7, day: 18 }));
T("هجريّ round-trip", (() => { const j = hijriToJDN(1447, 1, 10); return same(jdnToHijri(j), { year: 1447, month: 1, day: 10 }); })());
T("هجريّ→ميلاديّ→هجريّ", same(gregorianToHijri(hijriToGregorian({ year: 1446, month: 9, day: 1 })), { year: 1446, month: 9, day: 1 }));
T("جمع 30 يومًا دقيق (JDN)", hijriToJDN(1447, 1, 1) + 30 === hijriToJDN(addDaysHijri({ year: 1447, month: 1, day: 1 }, 30).year, addDaysHijri({ year: 1447, month: 1, day: 1 }, 30).month, addDaysHijri({ year: 1447, month: 1, day: 1 }, 30).day));
T("حساب مهلة: التبليغ + 30 = فرق 30 يومًا", (() => { const r = computeDeadline({ year: 1447, month: 3, day: 15 }, 30); return r.jdnDue - hijriToJDN(1447, 3, 15) === 30; })());
T("العام الهجريّ ليوليو 2026 معقول (±جدوليّ)", (() => { const h = gregorianToHijri({ year: 2026, month: 7, day: 18 }); return h.year >= 1447 && h.year <= 1448; })());

// ── الحرّاس ──
const engine: EngineResult = {
  scopeSystems: ["نظام الإفلاس", "نظام العمل"],
  articles: [{ system: "نظام الإفلاس", article: "10", text: "نصّ", enforcement: "ساري" }],
};
const good: AnswerForGuard = {
  title: "حصر", stance: "neutral", scope: ["نظام الإفلاس", "نظام العمل"],
  sections: [{ heading: "أ", body: "حكمٌ مؤرَّض." }],
  sources: [{ ref: "x", system: "نظام الإفلاس", article: "10", enforcement: "ساري" }],
};
T("حارس: مخرجٌ سليم يمرّ", runEnforcement(good, engine).ok);
T("حارس التأريض: مصدرٌ غير مسترجَع يُرفَض", !runEnforcement({ ...good, sources: [{ ref: "x", system: "نظام الإفلاس", article: "999", enforcement: "ساري" }] }, engine).ok);
T("حارس النطاق: تسريب يُرفَض", !runEnforcement({ ...good, sources: [{ ref: "x", system: "نظام المرور", article: "10", enforcement: "ساري" }] }, engine).ok);
T("حارس النفاذ: مادّة لاغية تُرفَض", !runEnforcement({ ...good, sources: [{ ref: "x", system: "نظام الإفلاس", article: "10", enforcement: "لاغٍ" }] }, engine).ok);
T("حارس الاختلاق: رقمٌ مختلَق في المتن يُرفَض", !runEnforcement({ ...good, sections: [{ heading: "أ", body: "راجع المادة (999)." }] }, engine).ok);
const advocacy: AnswerForGuard = { ...good, sections: [{ heading: "أ", body: "المنطوق المقترح رفض الدعوى." }] };
T("حارس الموقف: منطوقٌ من محايد يُرفَض", !runEnforcement(advocacy, engine).ok);
T("حارس الموقف: نفس المخرج مسموحٌ للمنازِع", runEnforcement({ ...advocacy, stance: "advocate" }, engine).ok);

// ── بوابة الاعتماد + golden + المسار ──
(async () => {
  const compliantRunner = async () => ({ answer: { title: "لا يوجد", stance: "supervisor", scope: [], sections: [{ heading: "أ", body: "يُترَك للقاضي." }], sources: [] } as AnswerForGuard, engine });
  const violatingRunner = async () => ({ answer: { title: "المنطوق المقترح", stance: "supervisor", scope: [], sections: [{ heading: "أ", body: "يُقضى برفض الدعوى." }], sources: [] } as AnswerForGuard, engine });
  T("البوابة تعتمد الوكيل الممتثل", (await runConformance(compliantRunner, STANCE_CASES)).approved);
  T("البوابة ترفض الوكيل المخالف", !(await runConformance(violatingRunner, STANCE_CASES)).approved);

  const gRunner = async () => ({ answer: { ...good, sources: [good.sources[0]] }, engine });
  T("golden: المخرج السليم يمرّ", (await scoreAgent(gRunner, STRUCTURAL_GOLDEN)).passRate === 1);

  const deps = { runEngine: async () => engine, compose: () => good };
  T("المسار: قاضٍ × تقدير حكم = محجوب", (await handleSearch({ query: "q", scope: [], stance: "supervisor", taskMode: "verdict-estimate", roleKey: "judge" }, deps)).status === "blocked");
  T("المسار: مسموحٌ يمرّ للحارس ثم يخرج", (await handleSearch({ query: "q", scope: ["نظام الإفلاس", "نظام العمل"], stance: "advocate", taskMode: "ask" }, deps)).status === "ok");
  T("المسار: مخرجٌ مخالف يُرفَض بالحارس", (await handleSearch({ query: "q", scope: [], stance: "neutral", taskMode: "ask" }, { runEngine: async () => engine, compose: () => advocacy })).status === "rejected");

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  if (fail) process.exit(1);
})();
