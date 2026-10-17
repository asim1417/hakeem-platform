/**
 * HKM-012 — عرض نص الحكم حسب الدور (قرار المالك 17/10/2026): المتدرّب يرى النص كاملًا بلا أسماء
 * الأفراد ولا أرقامهم؛ بقية الأدوار بلا أرقام فقط. بيانات مصطنعة.
 */
import { rulingDisplayText, masksRulingNames } from "../lib/modules/legal-core/ruling-display";
import { buildJudgmentSnippet } from "../lib/modules/legal-core/judgment-search";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

const RAW = "المدعي/ سعد فهد الدوسري بأن المدعى عليه لم يسدد، وحضر وكيله المحامي خالد عبدالرحمن العتيبي بموجب الوكالة، هوية 1012345678، والمدعى عليها شركة الراجحي للتجارة، استنادًا إلى المادة 18";

const trainee = rulingDisplayText(RAW, "TRAINEE");
ok(!trainee.includes("الدوسري") && !trainee.includes("العتيبي"), "المتدرّب: أسماء الأطراف محجوبة");
ok(trainee.includes("المدعي/ [اسم]") && trainee.includes("وكيله المحامي [اسم]"), "المتدرّب: الصفة تبقى ومكان الاسم معلَّم");
ok(!trainee.includes("1012345678"), "المتدرّب: الهوية محجوبة");
ok(trainee.includes("شركة الراجحي للتجارة") && trainee.includes("المادة 18"), "المتدرّب: الشركة والمادة تبقيان");
ok(trainee.includes("بموجب الوكالة") && trainee.includes("لم يسدد"), "المتدرّب: بقية النص كاملة");

for (const role of ["LAWYER", "TRAINER", "JUDGE", "SYSTEM_ADMIN", "SUPER_ADMIN"]) {
  const out = rulingDisplayText(RAW, role);
  ok(out.includes("الدوسري") && !out.includes("1012345678"), `${role}: الأسماء تبقى والهوية محجوبة`);
}
ok(rulingDisplayText(null, "TRAINEE") === "" && rulingDisplayText(undefined, "LAWYER") === "", "نص فارغ");
ok(masksRulingNames("TRAINEE") && !masksRulingNames("LAWYER") && !masksRulingNames(null), "الدور الذي تُحجب له الأسماء");

const snipT = buildJudgmentSnippet(RAW, "يسدد", true);
const snipL = buildJudgmentSnippet(RAW, "يسدد", false);
ok(!snipT.includes("الدوسري") && snipT.includes("يسدد"), "مقتطف البحث للمتدرّب بلا أسماء");
ok(snipL.includes("الدوسري") && !snipL.includes("1012345678"), "مقتطف البحث لغيره: الأسماء تبقى والهوية محجوبة");

console.log(failed === 0 ? "✓ عرض الحكم حسب الدور" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
