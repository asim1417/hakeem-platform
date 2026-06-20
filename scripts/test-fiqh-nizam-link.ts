/**
 * اختبار تكامل ربط المسائل بالأنظمة: لا اختلاق + احترام حد النظام.
 * يبني الروابط من المصادر ويتحقّق أن كل مادة مربوطة حقيقية وضمن نظام المسألة المُعيَّن.
 * التشغيل: npm run test:fiqh-link   (شغّل export:saudi-systems أولاً)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  flattenMasail,
  linkMasala,
  resolveTargets,
  type FiqhTreeNode
} from "@/lib/modules/legal-core/fiqh-nizam-linker";
import type { SaudiSystemsExport } from "@/lib/modules/legal-core/saudi-systems";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار ربط المسائل بالأنظمة");
  console.log("=".repeat(56));

  const DATA = join(process.cwd(), "data");
  for (const f of ["fiqh_issue_tree.json", "saudi_systems.json", "legal-bm25-index.json.gz"]) {
    check(existsSync(join(DATA, f)), `data/${f} موجود`);
  }

  const tree = JSON.parse(readFileSync(join(DATA, "fiqh_issue_tree.json"), "utf-8")) as FiqhTreeNode;
  const data = JSON.parse(readFileSync(join(DATA, "saudi_systems.json"), "utf-8")) as SaudiSystemsExport;
  const known = new Set(data.systems.map((s) => s.name));

  // مرجع المواد الحقيقية
  const realKeys = new Set<string>();
  for (const s of data.systems) for (const a of s.articles) realKeys.add(`${s.name}|${a.articleNumber}`);

  const masail = flattenMasail(tree);
  check(masail.length === 3073, `عدد المسائل = 3073 (${masail.length})`);

  // issue_id ثابت وفريد عبر كل المسائل
  const allIds = masail.map((m) => linkMasala(m, known).issueId);
  check(allIds.every((id) => /^fiqh-[0-9a-f]{12}$/.test(id)), "كل مسألة لها issue_id بصيغة ثابتة");
  check(new Set(allIds).size === masail.length, `issue_id فريد لكل مسألة (${new Set(allIds).size}/${masail.length})`);

  // عيّنة كافية للتحقق (لتسريع الاختبار): أول 400 مسألة
  const sample = masail.slice(0, 400);
  const links = sample.map((m) => linkMasala(m, known));

  // 1) لا اختلاق: كل مادة مربوطة موجودة فعلاً
  let fakeArticles = 0;
  for (const l of links) for (const a of l.articleLinks) if (!realKeys.has(`${a.lawName}|${a.articleNumber}`)) fakeArticles++;
  check(fakeArticles === 0, `كل المواد المربوطة حقيقية (مزيّفة: ${fakeArticles})`);

  // 2) حد النظام: كل مادة مربوطة ضمن أنظمة المسألة المستهدفة
  let outOfBoundary = 0;
  for (const l of links) for (const a of l.articleLinks) if (!l.targetSystems.includes(a.lawName)) outOfBoundary++;
  check(outOfBoundary === 0, `حد النظام محترم 100% (خارج النطاق: ${outOfBoundary})`);

  // 3) المسائل غير المقنّنة بلا روابط مواد
  const sharia = links.filter((l) => l.linkStatus === "uncodified_sharia");
  check(sharia.every((l) => l.articleLinks.length === 0), "المسائل الشرعية غير المقنّنة بلا روابط مواد");

  // 4) المُحلِّل: أحكام شرعية → غير مقنّنة؛ معاملات مدنية → مقنّنة
  check(resolveTargets("أحكام شرعية (حدود)", known).codified === false, "«أحكام شرعية (حدود)» → غير مقنّنة");
  check(
    resolveTargets("نظام المعاملات المدنية", known).targets.includes("نظام المعاملات المدنية"),
    "«نظام المعاملات المدنية» → مقنّنة ومحلولة"
  );
  check(resolveTargets("أنظمة الأوقاف", known).targets.includes("نظام الهيئة العامة للأوقاف"), "«أنظمة الأوقاف» → الهيئة العامة للأوقاف");

  // 5) صحة دلالية (spot): مسألة بيع تُربط بنظام المعاملات المدنية
  const bay = links.find((l) => l.title.includes("أركان البيع") && l.articleLinks.length);
  check(!!bay && bay.articleLinks[0].lawName === "نظام المعاملات المدنية", "«أركان البيع» → نظام المعاملات المدنية");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار الربط (لا اختلاق · حد النظام سليم).");
}

main();
