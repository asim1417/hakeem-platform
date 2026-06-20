/**
 * link-fiqh-to-nizam.ts — ربط مسائل الموسوعة الفقهية (3,073) بمواد الأنظمة السعودية الحقيقية.
 * ──────────────────────────────────────────────────────────────────
 * يقرأ:
 *   data/fiqh_issue_tree.json   — شجرة المسائل
 *   data/saudi_systems.json     — الأنظمة (لقائمة الأسماء المعروفة)
 *   data/legal-bm25-index.json.gz — للمطابقة النصّية (عبر bm25)
 * يكتب:
 *   data/fiqh-nizam-links.json  — لكل مسألة: مواد حقيقية + nizam_score + link_status
 *   data/fiqh-nizam-links.report.md — ملخّص التغطية
 *
 * حد النظام: لا تُطابَق مسألة إلا بمواد نظامها. لا اختلاق: كل ربط لمادة موجودة فعلاً.
 *
 * التشغيل: npm run link:fiqh   (شغّل export:saudi-systems وbuild:bm25 أولاً عند الحاجة)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  flattenMasail,
  linkMasala,
  LINK_THRESHOLDS,
  type FiqhTreeNode,
  type MasalaLink
} from "@/lib/modules/legal-core/fiqh-nizam-linker";
import type { SaudiSystemsExport } from "@/lib/modules/legal-core/saudi-systems";

const DATA = join(process.cwd(), "data");

function main() {
  console.log("🔗 ربط المسائل الفقهية بالأنظمة السعودية");
  console.log("=".repeat(56));

  for (const f of ["fiqh_issue_tree.json", "saudi_systems.json", "legal-bm25-index.json.gz"]) {
    if (!existsSync(join(DATA, f))) {
      console.error(`❌ مفقود: data/${f}`);
      process.exitCode = 1;
      return;
    }
  }

  const tree = JSON.parse(readFileSync(join(DATA, "fiqh_issue_tree.json"), "utf-8")) as FiqhTreeNode;
  const systemsData = JSON.parse(readFileSync(join(DATA, "saudi_systems.json"), "utf-8")) as SaudiSystemsExport;
  const knownSystems = new Set(systemsData.systems.map((s) => s.name));

  const masail = flattenMasail(tree);
  console.log(`📖 مسائل: ${masail.length} · أنظمة معروفة: ${knownSystems.size}`);

  const links: MasalaLink[] = masail.map((m) => linkMasala(m, knownSystems));

  // إحصاء
  const byStatus = new Map<string, number>();
  const bySystem = new Map<string, number>();
  let linkedArticles = 0;
  for (const l of links) {
    byStatus.set(l.linkStatus, (byStatus.get(l.linkStatus) ?? 0) + 1);
    if (l.linkStatus === "linked" || l.linkStatus === "needs_review") {
      linkedArticles += l.articleLinks.length;
      const sys = l.articleLinks[0]?.lawName;
      if (sys) bySystem.set(sys, (bySystem.get(sys) ?? 0) + 1);
    }
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "data/fiqh_issue_tree.json + data/saudi_systems.json (BM25)",
      masail: masail.length,
      thresholds: LINK_THRESHOLDS,
      byStatus: Object.fromEntries(byStatus),
      note: "حد النظام مطبَّق؛ كل مادة مربوطة موجودة فعلاً في legal_articles. needs_human_review قبل الاعتماد."
    },
    links
  };
  writeFileSync(join(DATA, "fiqh-nizam-links.json"), JSON.stringify(out, null, 2));

  // تقرير
  const pct = (n: number) => `${((n / masail.length) * 100).toFixed(1)}%`;
  const rep: string[] = [
    "# تقرير ربط المسائل الفقهية بالأنظمة السعودية",
    "",
    `- المصدر: الموسوعة الفقهية الكويتية → الأنظمة السعودية (BM25، حد النظام).`,
    `- المسائل: **${masail.length}**`,
    `- عتبات النسبة المعيارية (داخل النظام ÷ عالمياً): linked ≥ ${LINK_THRESHOLDS.linked} · needs_review ≥ ${LINK_THRESHOLDS.review}`,
    "",
    "## حسب حالة الربط",
    "| الحالة | العدد | النسبة |",
    "|---|---|---|"
  ];
  const statusLabel: Record<string, string> = {
    linked: "linked — النظام المُعيَّن يحوي أفضل مطابقة",
    needs_review: "needs_review — مطابقة معقولة داخل النظام",
    review_nizam: "review_nizam — أفضل مطابقة خارج النظام؛ يُراجَع التعيين",
    no_match: "no_match — لا مادة داخل النظام",
    uncodified_sharia: "uncodified_sharia — أحكام شرعية غير مقنّنة"
  };
  for (const s of ["linked", "needs_review", "review_nizam", "no_match", "uncodified_sharia"]) {
    const c = byStatus.get(s) ?? 0;
    rep.push(`| ${statusLabel[s]} | ${c} | ${pct(c)} |`);
  }
  rep.push("", "## أكثر الأنظمة استقبالاً للربط (أعلى مادة لكل مسألة)", "| النظام | مسائل |", "|---|---|");
  for (const [sys, c] of [...bySystem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    rep.push(`| ${sys} | ${c} |`);
  }
  rep.push(
    "",
    `- مجموع روابط المواد (linked+needs_review): **${linkedArticles}**`,
    "- ملاحظة: المسائل `uncodified_sharia` أحكام شرعية غير مقنّنة — لا مادة نظامية مباشرة (بصدق، بلا إجبار ربط).",
    "- كل الصفوف `needs_human_review` — مراجعة مختص قبل الاعتماد."
  );
  writeFileSync(join(DATA, "fiqh-nizam-links.report.md"), rep.join("\n"));

  console.log("\n📊 حسب الحالة:");
  for (const [s, c] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${s}: ${c} (${pct(c)})`);
  console.log(`\n✅ كُتب: data/fiqh-nizam-links.json · data/fiqh-nizam-links.report.md`);
}

main();
