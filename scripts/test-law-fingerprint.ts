/** HKM-028: اختبار البصمة والمقارنة ببيانات مصطنعة (بلا قاعدة). */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FINGERPRINT_NORMALIZATION,
  compareFingerprint,
  fingerprintArticle,
  fingerprintClean,
  normalizeForFingerprint,
  type LawFingerprint,
} from "../lib/modules/legal-core/law-fingerprint";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

ok(normalizeForFingerprint("موطنًا له") === normalizeForFingerprint("موطناً  له"), "موضع التنوين والمسافات لا يُعدّ اختلافًا");
ok(normalizeForFingerprint("الحقُّ الماليُّ") === normalizeForFingerprint("الحق المالي"), "التشكيل لا يُعدّ اختلافًا");
ok(normalizeForFingerprint("يقيم") !== normalizeForFingerprint("يقيمه"), "تغيّر حرف يُعدّ اختلافًا");

const law = [
  { articleNumber: 1, title: "المادة الأولى", content: "نص أول." },
  { articleNumber: 2, title: "المادة الثانية", content: "إذا تعدد الدائنون." },
  { articleNumber: 3, title: "المادة الثالثة", content: "للدائن أن يحيل حقه." },
];
const fp = law.map((a) => fingerprintArticle(a.articleNumber, a.title, a.content));

ok(fingerprintClean(compareFingerprint(fp, law)), "النظام المطابق نظيف");

// الانزياح: سقطت المادة 2 فانزاح ما بعدها، وكُررت الأخيرة لسدّ العدد.
const shifted = [law[0], { ...law[2], articleNumber: 2, title: "المادة الثانية" }, { ...law[2], articleNumber: 3 }];
const d = compareFingerprint(fp, shifted);
ok(!fingerprintClean(d) && d.textMismatch.join() === "2", "انزياح الترقيم يُكشف في المادة المنزاحة");

const missing = compareFingerprint(fp, law.slice(0, 2));
ok(missing.missing.join() === "3" && !fingerprintClean(missing), "المادة الناقصة");
const dup = compareFingerprint(fp, [...law, law[0]]);
ok(dup.duplicateNumbers.join() === "1", "الرقم المكرر");
const extra = compareFingerprint(fp, [...law, { articleNumber: 4, title: "المادة الرابعة", content: "س" }]);
ok(extra.extra.join() === "4", "المادة الزائدة");
const retitled = compareFingerprint(fp, [law[0], { ...law[1], title: "المادة الثالثة" }, law[2]]);
ok(retitled.titleMismatch.join() === "2" && !retitled.textMismatch.length, "العنوان المختلف");

// ملفات البصمات المحفوظة: بنية سليمة، ومواد متصلة من 1 بلا تكرار، وتطبيع مطابق للكود.
const FP_DIR = path.join(process.cwd(), "data/law-fingerprints");
const HEX = /^[0-9a-f]{32}$/;
for (const f of readdirSync(FP_DIR).filter((x) => x.endsWith(".json"))) {
  const file = JSON.parse(readFileSync(path.join(FP_DIR, f), "utf8")) as LawFingerprint;
  const nums = file.articles.map((a) => a[0]);
  ok(Boolean(file.lawName && file.source && file.verifiedAt), `${f}: الاسم والمصدر وتاريخ التحقق`);
  ok(file.normalization === FINGERPRINT_NORMALIZATION, `${f}: التطبيع مطابق للكود`);
  ok(nums.every((n, i) => n === i + 1), `${f}: ${nums.length} مادة متصلة من 1 بلا تكرار`);
  ok(file.articles.every((a) => HEX.test(a[1]) && HEX.test(a[2])), `${f}: كل بصمة md5 سداسية`);
}
// نظام المحاكم التجارية: 96 مادة كما في الهيئة.
const cc = JSON.parse(readFileSync(path.join(FP_DIR, "commercial-courts.json"), "utf8")) as LawFingerprint;
ok(cc.lawName === "نظام المحاكم التجارية" && cc.articles.length === 96, "بصمة نظام المحاكم التجارية: 96 مادة");
ok(cc.articles[17][1] === fingerprintArticle(18, "المادة 18", "")[1], "عنوان المادة 18 في البصمة بتمثيل حكيم الرقمي");

console.log(failed === 0 ? "✓ بصمة النظام" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
