/**
 * اختبار تكامل شجرة المسائل وربطها بالأنظمة (سلامة الربط، بلا فقد).
 * يبني الشجرة من saudi_systems.json ويتحقّق أن كل ورقة مرتبطة بمادة حقيقية موجودة فعلاً.
 * التشغيل: npm run test:fiqh-tree   (شغّل export:saudi-systems أولاً)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildFiqhIssuesTree, type FiqhMasalaNode } from "@/lib/modules/legal-core/fiqh-issues-tree";
import { classifyDomain, type SaudiSystemsExport } from "@/lib/modules/legal-core/saudi-systems";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function collectMasail(nodes: { type: string; children?: unknown[] }[]): FiqhMasalaNode[] {
  const out: FiqhMasalaNode[] = [];
  const walk = (n: any) => {
    if (n.type === "masala") out.push(n);
    else (n.children ?? []).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function main() {
  console.log("🧪 اختبار شجرة المسائل الفقهية");
  console.log("=".repeat(56));

  const src = join(process.cwd(), "data", "saudi_systems.json");
  check(existsSync(src), "data/saudi_systems.json موجود");
  if (!existsSync(src)) {
    console.log("شغّل: npm run export:saudi-systems");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(src, "utf-8")) as SaudiSystemsExport;

  // مرجع: مجموعة مفاتيح المواد الحقيقية (lawName|articleNumber)
  const realKeys = new Set<string>();
  let totalArticles = 0;
  for (const s of data.systems) for (const a of s.articles) {
    realKeys.add(`${s.name}|${a.articleNumber}`);
    totalArticles++;
  }

  const tree = buildFiqhIssuesTree(data.systems);
  const masail = collectMasail(tree.tree as any);

  check(tree.tree.length === new Set(data.systems.map((s) => s.domain)).size, "عدد المجالات = عدد مجالات الأنظمة المميّزة");
  check(tree.meta.systems === data.systems.length, `كل الأنظمة ممثّلة في الشجرة (${tree.meta.systems}/${data.systems.length})`);
  check(masail.length === totalArticles, `عدد المسائل = عدد المواد (${masail.length}/${totalArticles}) — بلا فقد/تكرار`);

  // سلامة الربط: كل ورقة تشير لمادة حقيقية
  const unlinked = masail.filter((m) => !realKeys.has(`${m.link.lawName}|${m.link.articleNumber}`));
  check(unlinked.length === 0, `كل مسألة مرتبطة بمادة حقيقية (روابط معلّقة: ${unlinked.length})`);

  // تطابق meta مع الإحصاء الفعلي
  check(tree.meta.masail === masail.length, "عدّاد meta.masail مطابق للعدّ الفعلي");

  // المصنّف: ديوان المظالم → إداري، المرافعات الشرعية → مرافعات (لا تضارب)
  check(classifyDomain("نظام المرافعات أمام ديوان المظالم").slug === "administrative", "ديوان المظالم → القضاء الإداري");
  check(classifyDomain("نظام المرافعات الشرعية").slug === "procedure", "المرافعات الشرعية → المرافعات والإجراءات");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار شجرة المسائل (ربط حتمي سليم).");
}

main();
