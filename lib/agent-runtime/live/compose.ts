// ─────────────────────────────────────────────────────────────────────────────
// المُركِّب المؤرَّض — يبني AnswerForGuard من نتيجة المحرّك مباشرةً (Skeleton محايد).
// كل مصدرٍ مسترجَعٌ فعلًا (تأريضٌ بالبناء)، وداخل النطاق، والمواد اللاغية تُستبعَد من
// السند (لا تُقدَّم قانونًا قائمًا). لا يحمل أي علامة ترجيح — يمرّ حارس الموقف لكل المواقف.
// ─────────────────────────────────────────────────────────────────────────────
import type { AnswerForGuard, AnswerSource, EngineResult, Stance } from "../types";
import type { TaskMode } from "../pipeline/searchRoute";

export function composeGrounded(
  er: EngineResult,
  ctx: { stance: Stance; taskMode: TaskMode; scope: string[] }
): AnswerForGuard {
  // السند: المواد المسترجَعة النافذة فقط (تُستبعَد اللاغية) — كلٌّ مؤرَّض وداخل النطاق.
  const sources: AnswerSource[] = er.articles
    .filter((a) => a.enforcement !== "لاغٍ")
    .map((a) => ({
      ref: `${a.system} — المادة (${a.article})`,
      system: a.system,
      article: a.article,
      enforcement: a.enforcement,
    }));

  // النطاق للحارس يجب أن يطابق أسماء الأنظمة المطبَّعة في مصادر المحرّك (لا صيغة النطاق الخام
  // بالشُّرَط)، وإلا رصد حارس النطاق تسريبًا كاذبًا. نعتمد scopeSystems الذي طبّعه المحرّك.
  const scope = er.scopeSystems.length ? er.scopeSystems : ctx.scope;

  if (!sources.length) {
    // امتناعٌ صريح عند غياب سندٍ نافذ — لا اختلاق ولا ملء فراغ.
    return {
      title: "لا يوجد سند نظاميّ نافذ مطابق ضمن النطاق",
      sections: [{ heading: "النتيجة", body: "لم يُعثر على مادّةٍ نافذةٍ مطابقةٍ ضمن الأنظمة المسموح بها. جرّب إعادة صياغة الطلب أو توسيع النطاق صراحةً." }],
      sources: [],
      stance: ctx.stance,
      scope,
    };
  }

  // متنٌ محايدٌ يُحيل إلى عدد المواد فقط — لا يذكر أرقامًا خارج المسترجَع (يمرّ حارس الاختلاق).
  const bySystem = new Map<string, number>();
  for (const s of sources) bySystem.set(s.system, (bySystem.get(s.system) ?? 0) + 1);
  const spread = Array.from(bySystem.entries())
    .map(([sys, n]) => `${sys}: ${n.toLocaleString("ar-SA")} مادة`)
    .join(" · ");

  return {
    title: "المواد النظامية المسترجَعة ضمن النطاق",
    sections: [
      { heading: "الحصيلة", body: `استُرجعت ${sources.length.toLocaleString("ar-SA")} مادّة نافذة ضمن النطاق المسموح به.` },
      { heading: "التوزيع بحسب النظام", body: spread },
    ],
    sources,
    stance: ctx.stance,
    scope,
  };
}
