// تقييم جسر وكيل الأنظمة للخدمات المؤرَّضة (lib/modules/agents/case-agent-bridge.ts).
// يثبت اختبار القبول ①: تحليل قضية «فسخ زواج» يحدّد **الأحوال الشخصية** (فهم النظام الحاكم)
// عبر resolve-scope داخل الوكيل، لا «المعاملات المدنية» المهيمنة حجمًا. قراءة على القاعدة الحيّة.
//
// التشغيل (مع Neon + شِمّ server-only): npm run eval:case-agent
import { runCaseAgent } from "@/lib/modules/agents/case-agent-bridge";
import { resolveAiConfig } from "@/lib/modules/ai/ai-config";
import { prisma } from "@/lib/prisma";

interface Case {
  name: string;
  q: string;
  /** جزء اسم النظام الحاكم المتوقّع في المظانّ/الأساس. */
  expectSystem: string;
  hard: boolean; // تأكيد صارم (يُفشِل) أم تشخيصيّ فقط؟
}

const CASES: Case[] = [
  {
    name: "فسخ نكاح للضرر",
    q: "تطلب الزوجة فسخ عقد النكاح للضرر الواقع عليها من هجر الزوج وإيذائه، وتطلب التفريق للضرر.",
    expectSystem: "الأحوال الشخصية",
    hard: true,
  },
  {
    name: "إخلال بعقد مقاولة",
    q: "نزاع حول إخلال المقاول بالتزاماته في عقد مقاولة وتعويض المالك عن التأخّر والأضرار.",
    expectSystem: "المعاملات المدنية",
    hard: false,
  },
];

async function main() {
  let pass = 0;
  let fail = 0;
  console.log("🧪 تقييم جسر وكيل الأنظمة (تأريض الخدمات الثلاث)\n" + "=".repeat(56));

  // فهم النظام الحاكم (resolve-scope) يقوده النموذج. بلا مزوّد نموذج مضبوط يتعذّر تحديد النظام
  // (يسقط الاسترجاع إلى المطابقة المعجمية فيغلب «فسخ» ← الشركات). عندئذٍ نتخطّى التأكيد الصارم
  // بصدق (لا فشل كاذب) — يُتحقَّق فهمُ النظام في الإنتاج أو عند ضبط مفتاح نموذج في هذه البيئة.
  const cfg = await resolveAiConfig().catch(() => ({ provider: "offline", apiKey: "" }));
  const hasModel = cfg.provider !== "offline" && Boolean(cfg.apiKey);
  if (!hasModel) {
    console.log("\n⏭️  تخطٍّ: لا مزوّد نموذج مضبوط في هذه البيئة.");
    console.log("    فهم النظام الحاكم (resolve-scope) يتطلّب النموذج — يُتحقَّق في الإنتاج أو بضبط");
    console.log("    مفتاح نموذج (AI_PROVIDER + ANTHROPIC_API_KEY/OPENAI_API_KEY) لهذا الـworkflow.");
    console.log("    (نفس اعتماد «اسأل حكيم» على النموذج في تحديد النظام — لا يُثبَت بلا مفتاح.)");
    // تشخيص خفيف: نطبع ما يُخرِجه المسار العام (بلا تأكيد) كي يبقى القياس مفيدًا.
    try {
      const ctx = await runCaseAgent(CASES[0].q);
      console.log(`\n[تشخيص بلا نموذج] ${CASES[0].name}: grounded=${ctx.grounded} · articles=${ctx.articles.length} · مظانّ=[${ctx.governingSystems.slice(0, 2).map((g) => g.systemName).join(" · ")}]`);
    } catch {
      /* تجاهل */
    }
    await prisma.$disconnect().catch(() => undefined);
    console.log("\n✅ تخطٍّ نظيف (البيئة بلا نموذج) — لا فشل كاذب.");
    return;
  }
  console.log(`\n(مزوّد النموذج: ${cfg.provider}) — تشغيل التأكيد الصارم لفهم النظام الحاكم.`);

  for (const c of CASES) {
    let grounded = false;
    let systems: string[] = [];
    let basisSystems: string[] = [];
    let verified = 0;
    let articles = 0;
    try {
      const ctx = await runCaseAgent(c.q);
      grounded = ctx.grounded;
      articles = ctx.articles.length;
      verified = ctx.verified.length;
      systems = ctx.governingSystems.map((g) => g.systemName);
      basisSystems = [...new Set(ctx.articles.map((a) => a.systemName))];
    } catch (e) {
      console.log(`\n${c.name}: ERROR ${(e as Error).message}`);
    }

    const hit = systems.some((s) => s.includes(c.expectSystem)) || basisSystems.some((s) => s.includes(c.expectSystem));
    console.log(`\n▸ ${c.name}`);
    console.log(`  grounded=${grounded} · articles=${articles} · verified=${verified}`);
    console.log(`  المظانّ: [${systems.slice(0, 3).join(" · ")}]`);
    console.log(`  أنظمة الأساس: [${basisSystems.slice(0, 4).join(" · ")}]`);
    if (grounded && hit) {
      pass++;
      console.log(`  ✅ فهم النظام الحاكم: «${c.expectSystem}»`);
    } else if (c.hard) {
      fail++;
      console.log(`  ❌ متوقّع نظام يحوي «${c.expectSystem}» — فشل صارم`);
    } else {
      console.log(`  ⚠️ تشخيصيّ فقط (لم يُطابِق «${c.expectSystem}»)`);
    }
  }

  // اختبار القبول ⑥: واقعة بلا سند نظاميّ → لا هلوسة (الوكيل يفصح: grounded=false).
  try {
    const none = await runCaseAgent("زقزقة عصافير حديقة منزلية بلا أي مضمون نظاميّ إطلاقًا xyz");
    console.log(`\n▸ بلا سند: grounded=${none.grounded} · articles=${none.articles.length} (متوقّع: امتناع/قلّة — لا تلفيق)`);
  } catch {
    /* تجاهل */
  }

  await prisma.$disconnect().catch(() => undefined);
  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${pass} نجح · ${fail} فشل`);
  if (fail > 0) {
    console.error("❌ فشل تقييم جسر الوكيل (لم يُحدَّد النظام الحاكم الصحيح).");
    process.exit(1);
  }
  console.log("✅ نجح تقييم جسر الوكيل — الخدمات ترتقي لمستوى «اسأل حكيم» في فهم النظام.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
