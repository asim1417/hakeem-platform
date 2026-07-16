// ─────────────────────────────────────────────────────────────────────────────
// eval:hls — مطابقة HLS §8 على القاعدة الحيّة (orchestrate عميق). قراءة فقط.
// يقيس حتميًّا: النطاق · النفاذ · المرحلية · التخطيط · **تفعيل المسح المفهوميّ عبر الأنواع
// الأربعة (حظر/إلزام/إباحة/رخصة تقديرية)** + التأريض (عند توفّر النموذج). يطبع توزيع الوسم.
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
  expectConceptual?: boolean; // يُتوقّع مرور مسار المسح المفهوميّ (scan-normative)
}
// حالات الحصر المفهوميّ تُصاغ **بعلامة حصر** (كل/احصر/جميع) كي تُصنَّف «حصر_مفهوميّ» فيُشتعل المسح.
const CASES: Case[] = [
  { q: "مدة الإشعار بإنهاء عقد العمل في نظام العمل ونظام المعاملات المدنية", expectSystems: 2 },
  { q: "احصر كل مواد السلطة التقديرية للمحكمة في نظام المعاملات المدنية", expectSystems: 1, expectConceptual: true }, // رخصة_تقديرية
  { q: "اذكر كل المحظورات في نظام العمل", expectSystems: 1, expectConceptual: true }, // حظر
  { q: "احصر جميع الالتزامات في نظام العمل", expectSystems: 1, expectConceptual: true }, // إلزام
  { q: "ما هي كل الرخص في نظام المعاملات المدنية", expectSystems: 1, expectConceptual: true }, // إباحة
  { q: "التعويض عن الضرر في نظام المعاملات المدنية", expectSystems: 1 }, // ضابط: بحث مركّز (لا مسح)
];

async function run(c: Case) {
  const steps: AgentStep[] = [];
  const r = await orchestrate(c.q, { mode: "deep", onStep: (s) => steps.push(s) });
  const targets = r.plan?.targetSystems ?? [];
  const conceptual = steps.some((s) => s.id === "scan-normative");
  const leaks = targets.length ? r.articles.filter((a) => !belongsToScope(a, targets)).length : 0;
  const pool = r.verified?.length ? r.verified : r.articles.map((a) => ({ status: a.status }));
  const repealed = pool.filter((x) => resolveEnforcement((x as { status?: string | null }).status).state === "لاغٍ").length;
  const hasVerify = steps.some((s) => s.id === "verify" || s.id === "verify-deep");
  const noSourceIncrease = (r.verified?.length ?? 0) <= r.articles.length;
  const basisSize = r.verified?.length ?? r.articles.length;
  const foot = r.analysis ? citedFootnotes(r.analysis) : [];
  const groundedFoot = r.analysis ? foot.every((n) => n >= 1 && n <= basisSize) : null;
  return {
    q: c.q.slice(0, 38),
    queryClass: r.plan?.queryClass ?? "-",
    conceptual,
    systems: targets.length,
    articles: r.articles.length,
    leaks,
    repealed,
    hasVerify,
    noSourceIncrease,
    coverage: r.coverage ? `${r.coverage.answered}/${r.coverage.issues.length}` : "-",
    analysis: r.analysis ? "yes" : "no",
    groundedFoot,
    expectSystemsOk: c.expectSystems ? targets.length >= c.expectSystems : true,
    conceptualOk: c.expectConceptual ? conceptual : true,
  };
}

async function printModalityDistribution() {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ m: string | null; c: bigint }>>(
      `SELECT "norm_modality" AS m, COUNT(*)::bigint AS c FROM legal_articles GROUP BY "norm_modality" ORDER BY c DESC`
    );
    console.log("── توزيع الوسم (norm_modality) ──");
    for (const r of rows) console.log(`  ${r.m ?? "(فارغ)"}\t${Number(r.c).toLocaleString("ar-SA")}`);
    console.log("");
  } catch (e) {
    console.log(`(تعذّر جلب توزيع الوسم — هل طُبِّق التفعيل؟): ${(e as Error).message}\n`);
  }
}

async function main() {
  await printModalityDistribution();
  console.log("q\tclass\tscan\tsystems\tarticles\tleaks\trepealed\tverify\tcoverage");
  let scopeOk = 0,
    enforceOk = 0,
    stageOk = 0,
    planOk = 0,
    conceptualOk = 0,
    conceptualN = 0,
    groundOk = 0,
    groundN = 0;
  for (const c of CASES) {
    let o: Awaited<ReturnType<typeof run>>;
    try {
      o = await run(c);
    } catch (e) {
      console.log(`${c.q.slice(0, 38)}\tERROR ${(e as Error).message}`);
      continue;
    }
    console.log(`${o.q}\t${o.queryClass}\t${o.conceptual ? "✓" : "—"}\t${o.systems}\t${o.articles}\t${o.leaks}\t${o.repealed}\t${o.hasVerify ? "✓" : "✗"}\t${o.coverage}`);
    if (o.leaks === 0) scopeOk += 1;
    if (o.repealed === 0) enforceOk += 1;
    if (o.hasVerify && o.noSourceIncrease) stageOk += 1;
    if (o.expectSystemsOk) planOk += 1;
    if (c.expectConceptual) {
      conceptualN += 1;
      if (o.conceptualOk) conceptualOk += 1;
    }
    if (o.groundedFoot !== null) {
      groundN += 1;
      if (o.groundedFoot) groundOk += 1;
    }
  }
  const n = CASES.length;
  console.log("\n══════════ مطابقة HLS §8 (حيّ) ══════════");
  console.log(`④ النطاق (صفر تسريب)          = ${scopeOk}/${n}`);
  console.log(`③ النفاذ (صفر لاغٍ)           = ${enforceOk}/${n}`);
  console.log(`⑥ المرحلية (verify بلا زيادة)   = ${stageOk}/${n}`);
  console.log(`② التخطيط (الأنظمة المستهدفة)   = ${planOk}/${n}`);
  console.log(`⑤⑤ المسح المفهوميّ فَعَل (الأنواع) = ${conceptualOk}/${conceptualN}`);
  console.log(`⑤ التأريض (ذيول ⊆ الأساس)     = ${groundN ? `${groundOk}/${groundN}` : "N/A (النموذج offline في CI؟)"}`);
  console.log("════════════════════════════════════");
  await prisma.$disconnect().catch(() => {});
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
