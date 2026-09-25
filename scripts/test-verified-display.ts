import { classifyEffectText } from "../lib/modules/legal-core/effect-classifier";
import { embeddingFingerprint } from "../lib/modules/legal-core/embedding-fingerprint";
import {
  assertNoVersionOverlap,
  citationFlagsFromVerification,
  presentArticle,
  textAsOf,
  type UnitVersionRecord,
  type VerificationRecord,
} from "../lib/modules/legal-core/verified-status";
import { countsAsStatute, kindFromTitle } from "../lib/modules/legal-core/work-kind";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

const base = "نص أصلي";
const after = "نص بعد الأداة";
const versions: UnitVersionRecord[] = [
  { id: "v2", body: after, validFrom: "2026-06-01T00:00:00.000Z", evidenceInstrument: "م/101", evidenceUrl: "https://example.test/m101" },
];

ok(textAsOf(base, versions, new Date("2026-01-01T00:00:00Z")).text === base, "قبل الأداة يبقى النص الأصلي");
ok(textAsOf(base, versions, new Date("2026-07-01T00:00:00Z")).text === after, "بعد الأداة تظهر النسخة الجديدة");
ok(assertNoVersionOverlap(versions), "لا تداخل عندما تتوالى النسخ");
ok(!assertNoVersionOverlap([...versions, { ...versions[0], id: "dup", validFrom: versions[0].validFrom }]), "تاريخ مكرر يُرفض");

const pending: UnitVersionRecord = {
  id: "future",
  body: "نص لم يسر",
  validFrom: "2099-01-01T00:00:00.000Z",
  evidenceInstrument: "م/237",
  evidenceUrl: "https://example.test/m237",
};
const shown = presentArticle({ baseText: base, versions: [pending], verification: null, asOf: new Date("2026-09-01T00:00:00Z") });
ok(shown.text === base && Boolean(shown.pendingNotice) && shown.unverifiedNotice !== null, "تعديل لم يسرِ يبقى النص الحالي مع تنبيه");

const repealed: VerificationRecord = {
  id: "r",
  verifiedStatus: "ملغاة",
  evidenceInstrument: "م/51 لعام 1445",
  evidenceUrl: "https://example.test/m51",
  evidenceQuote: null,
  verifiedAt: "2024-01-01T00:00:00.000Z",
};
const faded = presentArticle({ baseText: base, versions: [], verification: repealed });
ok(faded.faded && faded.badge === "ملغاة" && faded.text === base, "الملغاة تبقى ظاهرة باهتة");
const replacedView = presentArticle({ baseText: base, versions: [], verification: { ...repealed, verifiedStatus: "مستبدل" } });
ok(replacedView.faded && replacedView.badge === "مستبدل" && replacedView.text === base, "المستبدل يبقى ظاهرًا بوسمه");

ok(citationFlagsFromVerification(null).inForce === false && citationFlagsFromVerification(null).repealed === false, "بلا تحقق ليس ساريًا ولا ملغى");
ok(citationFlagsFromVerification({ ...repealed, verifiedStatus: "ساري" }).inForce === true, "سجل ساري يجعل الإحالة نافذة");

ok(kindFromTitle("السياسة الوطنية لتعزيز النمط التغذوي الصحي") === "سياسة", "السياسة تُصنّف سياسة");
ok(kindFromTitle("نظام الاستثمار") === "نظام", "نظام الاستثمار نظام");
ok(countsAsStatute("سياسة") === false && countsAsStatute("نظام") === true, "العداد يستبعد السياسة");

const blanket = classifyEffectText("ويلغي كل ما يتعارض معه");
ok(blanket.formula !== "إلغاء" && blanket.blanketConflictClause, "عبارة التعارض ليست إلغاء نظام بعينه");
ok(classifyEffectText("تعديل المادة (7) لتكون بالنص الآتي: مثال").formula === "تعديل المادة لتكون بالنص الآتي", "صيغة تعديل المادة");
ok(embeddingFingerprint("نص", "text-embedding-3-small") !== embeddingFingerprint("نص", "other"), "البصمة تدخل اسم النموذج");

console.log(failed === 0 ? "✓ عرض التحقق" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
