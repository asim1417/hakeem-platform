// ─────────────────────────────────────────────────────────────────────────────
// eval:hls — مطابقة HLS §8 على القاعدة الحيّة (orchestrate عميق). قراءة فقط.
// يقيس على بيانات حقيقية: النطاق (صفر تسريب) · النفاذ (صفر لاغٍ) · المرحلية (خطوة verify
// لا تزيد المصادر) · التغطية · التأريض (ذيول ⊆ الأساس، عند توفّر النموذج). حتميّ حيث لا نموذج.
// ─────────────────────────────────────────────────────────────────────────────
import { orchestrate } from "@/lib/modules/agents/orchestrator";
import { resolveEnforcement } from "@/lib/modules/agents/substrate/enforcement";
import { belongsToScope } from "@/lib/modules/agents/thinking/verification";
import { citedFootnotes } from "@/lib/modules/agents/thinking/analysis";
import { prisma } from "@/lib/prisma";
import type { AgentStep } from "@/lib/modules/agents/types";

interface Case {
  q: string;
  expectSystems?: number; // عدد الأنظمة المستهدفة المتوقّع (≥)
  conceptual?: boolean; // يُتوقّع مسار مسح مفهوميّ
}
const CASES: Case[] = [
  { q: "مدة الإشعار بإنهاء عقد العمل في نظام العمل ونظام المعاملات المدنية", expectSystems: 2 },
  { q: "ما هي مواد السلطة التقديرية للمحكمة في نظام المعاملات المدنية؟", conceptual: true, expectSystems: 1 },
  { q: "التعويض عن الضرر في نظام المعاملات المدنية", expectSystems: 1 },
  { q: "مسؤولية الشريك في نظام الشركات", expectSystems: 1 },
];

async function run(c: Case) {
  const steps: AgentStep[] = [];
  const r = await orchestrate(c.q, { mode: "deep", onStep: (s) => steps.push(s) });
  const targets = r.plan?.targetSystems ?? [];

  // ④ النطاق: كل مادة مُخرَّجة ضمن الأنظمة المستهدفة (عند وجودها).
  const leaks = targets.length ? r.articles.filter((a) => !belongsToScope(a, targets)).length : 0;
  // ③ النفاذ: صفر مادة لاغية في المُتحقَّق (أو في المُخرَّج إن لم يجرِ التحقّق).
  const pool = r.verified?.length ? r.verified : r.articles.map((a) => ({ status: a.status }));
  const repealed = pool.filter((x) => resolveEnforcement((x as { status?: string | null }).status).state === "لاغٍ").length;
  // ⑥ المرحلية: خطوة verify موجودة ولم تزد المصادر.
  const hasVerify = steps.some((s) => s.id === "verify" || s.id === "verify-deep");
  const noSourceIncrease = (r.verified?.length ?? 0) <= r.articles.length;
  // ⑤ التأريض: ذيول التحليل ⊆ [1..حجم الأساس] (فقط عند إنتاج تحليل).
  const basisSize = r.verified?.length ?? r.articles.length;
  const foot = r.analysis ? citedFootnotes(r.analysis) : [];
  const groundedFoot = r.analysis ? foot.every((n) => n >= 1 && n <= basisSize) : null;

  return {
    q: c.q.slice(0, 40),
    systems: targets.length,
    articles: r.articles.length,
    conceptual: steps.some((s) => s.id === "scan-normative"),
    leaks,
    repealed,
    hasVerify,
    noSourceIncrease,
    coverage: r.coverage ? `${r.coverage.answered}/${r.coverage.issues.length}` : "-",
    analysis: r.analysis ? "yes" : "no",
    groundedFoot,
    expectSystemsOk: c.expectSystems ? targets.length >= c.expectSystems : true,
  };
}

async function main() {
  console.log("q\tsystems\tarticles\tleaks\trepealed\tverify\tcoverage\tanalysis");
  let scopeOk = 0,
    enforceOk = 0,
    stageOk = 0,
    groundOk = 0,
    groundN = 0,
    planOk = 0;
  for (const c of CASES) {
    let o: Awaited<ReturnType<typeof run>>;
    try {
      o = await run(c);
    } catch (e) {
      console.log(`${c.q.slice(0, 40)}\tERROR ${(e as Error).message}`);
      continue;
    }
    console.log(`${o.q}\t${o.systems}\t${o.articles}\t${o.leaks}\t${o.repealed}\t${o.hasVerify ? "✓" : "✗"}\t${o.coverage}\t${o.analysis}`);
    if (o.leaks === 0) scopeOk += 1;
    if (o.repealed === 0) enforceOk += 1;
    if (o.hasVerify && o.noSourceIncrease) stageOk += 1;
    if (o.expectSystemsOk) planOk += 1;
    if (o.groundedFoot !== null) {
      groundN += 1;
      if (o.groundedFoot) groundOk += 1;
    }
  }
  const n = CASES.length;
  console.log("\n══════════ مطابقة HLS §8 (حيّ) ══════════");
  console.log(`④ النطاق (صفر تسريب)        = ${scopeOk}/${n}`);
  console.log(`③ النفاذ (صفر لاغٍ)         = ${enforceOk}/${n}`);
  console.log(`⑥ المرحلية (verify بلا زيادة) = ${stageOk}/${n}`);
  console.log(`② التخطيط (الأنظمة المستهدفة) = ${planOk}/${n}`);
  console.log(`⑤ التأريض (ذيول ⊆ الأساس)   = ${groundN ? `${groundOk}/${groundN}` : "N/A (النموذج offline في CI؟)"}`);
  console.log("════════════════════════════════════");
  await prisma.$disconnect().catch(() => {});
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
