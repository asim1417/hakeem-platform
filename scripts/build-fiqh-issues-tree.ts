/**
 * build-fiqh-issues-tree.ts — بناء شجرة المسائل الفقهية وربطها بالأنظمة والمواد.
 * ──────────────────────────────────────────────────────────────────
 * يقرأ data/saudi_systems.json (مخرج export-saudi-systems.ts) ويُنتج:
 *   data/fiqh-issues-tree.json
 *
 * كل مسألة (ورقة) مرتبطة بمادة حقيقية عبر (lawName, articleNumber).
 *
 * التشغيل: npm run build:fiqh-tree   (شغّل export:saudi-systems أولاً)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildFiqhIssuesTree } from "@/lib/modules/legal-core/fiqh-issues-tree";
import type { SaudiSystemsExport } from "@/lib/modules/legal-core/saudi-systems";

function main() {
  console.log("🌳 بناء شجرة المسائل الفقهية وربطها بالأنظمة");
  console.log("=".repeat(56));

  const src = join(process.cwd(), "data", "saudi_systems.json");
  if (!existsSync(src)) {
    console.error("❌ data/saudi_systems.json غير موجود. شغّل أولاً: npm run export:saudi-systems");
    process.exitCode = 1;
    return;
  }

  const data = JSON.parse(readFileSync(src, "utf-8")) as SaudiSystemsExport;
  const tree = buildFiqhIssuesTree(data.systems);

  const outPath = join(process.cwd(), "data", "fiqh-issues-tree.json");
  writeFileSync(outPath, JSON.stringify(tree, null, 2));

  console.log(`   المجالات: ${tree.meta.domains}`);
  console.log(`   الأنظمة:  ${tree.meta.systems}`);
  console.log(`   الأبواب:  ${tree.meta.chapters}`);
  console.log(`   المسائل:  ${tree.meta.masail} (كلها مرتبطة بمواد حقيقية)`);
  console.log("\n   الشجرة (المجالات):");
  for (const d of tree.tree) {
    console.log(`     ▸ ${d.title} — ${d.systemsCount} نظام · ${d.articleCount} مسألة`);
  }
  console.log(`✅ كُتب: data/fiqh-issues-tree.json`);
}

main();
