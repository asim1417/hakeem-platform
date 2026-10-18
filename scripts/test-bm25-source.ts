/**
 * اختبار مصدر متن فهرس BM25 (HKM-030): يُفهرس النص الساري لا النص الأصلي، والملغاة بنصها الأصلي.
 * يعمل بلا قاعدة (دوال نقية). التشغيل: npm run test:bm25-source
 */
import { resolveEffectiveText, searchableText } from "../lib/modules/legal-core/effective-text";
import type { UnitVersionRecord, VerificationRecord } from "../lib/modules/legal-core/verified-status";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

const base = "الهيئة: هيئة تنظيم المياه والكهرباء.";
const v: UnitVersionRecord = {
  id: "hkm30u-test",
  body: "الهيئة: الهيئة السعودية لتنظيم الكهرباء.",
  validFrom: new Date("2024-05-17T00:00:00Z").toISOString(),
  evidenceInstrument: "قرار مجلس الوزراء رقم 918 وتاريخ 1445/10/28هـ",
  evidenceUrl: "https://www.uqn.gov.sa/details?p=24962",
};
const repeal: VerificationRecord = {
  id: "hkm30v-test",
  verifiedStatus: "ملغاة",
  evidenceInstrument: "مرسوم ملكي رقم م/101 وتاريخ 1442/11/14هـ",
  evidenceUrl: "https://www.uqn.gov.sa/details?p=17876",
  evidenceQuote: null,
  verifiedAt: new Date("2026-10-18T00:00:00Z").toISOString(),
};

const amended = resolveEffectiveText({ articleId: "a1", baseText: base, versions: [v], verification: null });
ok(searchableText(base, amended) === v.body, "مادة لها نسخة سارية تُفهرس بنص النسخة");

const future = resolveEffectiveText({ articleId: "a2", baseText: base, versions: [{ ...v, validFrom: new Date("2999-01-01T00:00:00Z").toISOString() }], verification: null });
ok(searchableText(base, future) === base, "نسخة لم يبدأ سريانها لا تُفهرس");

const plain = resolveEffectiveText({ articleId: "a3", baseText: base, versions: [], verification: null });
ok(searchableText(base, plain) === base, "مادة بلا نسخ تُفهرس بنصها الأصلي");

const repealed = resolveEffectiveText({ articleId: "a4", baseText: base, versions: [v], verification: repeal });
ok(repealed.repealed && searchableText(base, repealed) === base, "الملغاة تُفهرس بنصها الأصلي لا بسطر الإلغاء");

ok(searchableText(null, undefined) === "" && searchableText(base, undefined) === base, "غياب النص الساري (تعذّر القراءة) = النص الأصلي");

if (failed) {
  console.error(`\n${failed} فشل`);
  process.exit(1);
}
console.log("\n✅ نجح اختبار مصدر متن BM25.");
