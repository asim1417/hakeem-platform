/**
 * اختبار المصدر الواحد للنص الساري (effective-text) ومستهلكيه.
 * بيانات الاختبار من صفوف الحقن الفعلية (ingest/boe-corpus-2026-09-28/data/injection-2026-10-16).
 * التشغيل: npx tsx scripts/test-effective-text.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repealLine, resolveEffectiveText } from "../lib/modules/legal-core/effective-text";
import { presentArticle, type UnitVersionRecord, type VerificationRecord } from "../lib/modules/legal-core/verified-status";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

const DIR = join(process.cwd(), "ingest/boe-corpus-2026-09-28/data/injection-2026-10-16");
const jsonl = <T>(f: string): T[] =>
  readFileSync(join(DIR, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);

type UvRow = { id: string; unit_id: string; body: string; valid_from: string; evidence_instrument: string | null; evidence_url: string | null; _law?: string; _article?: number };
type StRow = { id: string; object_id: string; verified_status: string; evidence_instrument: string | null; evidence_url: string | null; evidence_quote: string | null };

const uv = jsonl<UvRow>("unit_versions.jsonl");
const us = jsonl<StRow>("unit_status.jsonl");
const toVersion = (r: UvRow): UnitVersionRecord => ({
  id: r.id,
  body: r.body,
  validFrom: new Date(`${r.valid_from}T00:00:00Z`).toISOString(),
  evidenceInstrument: r.evidence_instrument,
  evidenceUrl: r.evidence_url,
});

// ── نظام العمل م5: النص الساري هو نص م/46 لسنة 1436هـ ──
const labor5 = uv.find((r) => r._law === "نظام العمل" && r._article === 5);
ok(Boolean(labor5), "صف نسخة نظام العمل م5 موجود في الحقن");
if (labor5) {
  const original = "تسري أحكام هذا النظام على: (النص الأصلي قبل التعديل)";
  const today = resolveEffectiveText({ articleId: labor5.unit_id, baseText: original, versions: [toVersion(labor5)], verification: null });
  ok(today.text === labor5.body, "نظام العمل م5 يُرجع نص النسخة المعدلة اليوم");
  ok(today.source === "unit_version" && !today.repealed, "المصدر unit_version وليست ملغاة");
  ok(/م\/46/.test(today.evidenceInstrument ?? "") && /1436/.test(today.evidenceInstrument ?? ""), "السند م/46 لسنة 1436هـ");
  ok(today.basis.startsWith("معدّلة بموجب") && !today.basis.includes(labor5.valid_from.slice(0, 10)), "سطر الاستناد يذكر الأداة بلا تاريخ");
  ok(today.status === "ساري", "الحالة ساري لا «قيد التحقق»");
  const before = resolveEffectiveText({ articleId: labor5.unit_id, baseText: original, versions: [toVersion(labor5)], verification: null, asOf: new Date("2010-01-01T00:00:00Z") });
  ok(before.text === original && before.source === "original", "قبل تاريخ السريان يبقى النص الأصلي");

  const view = presentArticle({ baseText: original, versions: [toVersion(labor5)], verification: null });
  ok(view.text === labor5.body, "presentArticle يعرض النص نفسه");
  ok(view.unverifiedNotice === null, "لا «الحالة قيد التحقق» على مادة لها نسخة موثقة");
  ok(Boolean(view.amendmentLine?.startsWith("معدّلة بموجب")) && !view.amendmentLine?.includes("من تاريخ"), "سطر «معدّلة بموجب …» بلا تاريخ");
}

// ── مادة ملغاة: لا نص ساري، تُرجع الإلغاء وسنده ──
const rep = us[0];
const repVer: VerificationRecord = {
  id: rep.id,
  verifiedStatus: rep.verified_status,
  evidenceInstrument: rep.evidence_instrument,
  evidenceUrl: rep.evidence_url,
  evidenceQuote: rep.evidence_quote,
  verifiedAt: "2026-10-16T00:00:00.000Z",
};
const stale = "نص المادة قبل إلغائها";
const repealed = resolveEffectiveText({ articleId: rep.object_id, baseText: stale, versions: [], verification: repVer });
ok(repealed.repealed && repealed.source === "repeal", "مادة ملغاة تُعلَّم ملغاة");
ok(repealed.text !== stale && repealed.text === repealLine(repVer), "لا يُعاد نصها القديم نصًّا ساريًا");
ok(repealed.text.includes(rep.evidence_instrument ?? "∅"), "سطر الإلغاء يحمل السند");
ok(repealed.originalText === stale, "النص المحفوظ متاح للقراءة التاريخية فقط");
ok(repealed.evidenceUrl === rep.evidence_url, "رابط سند الإلغاء");

// ملغاة ولها نسخة سابقة: الإلغاء يغلب
const repWithVersion = resolveEffectiveText({
  articleId: rep.object_id,
  baseText: stale,
  versions: [{ id: "x", body: "نسخة معدلة قديمة", validFrom: "2000-01-01T00:00:00.000Z", evidenceInstrument: "م/1", evidenceUrl: null }],
  verification: repVer,
});
ok(repWithVersion.repealed && repWithVersion.text === repealLine(repVer), "الإلغاء يغلب أي نسخة سابقة");

// صفحة المادة: سطر الإلغاء وسنده، والنص المحفوظ في «النسخ السابقة»
const repView = presentArticle({ baseText: stale, versions: [], verification: repVer });
ok(repView.text === repealLine(repVer) && repView.text !== stale && repView.badge === "ملغاة", "صفحة المادة: الملغاة بسطر إلغائها وسنده كالوصف وJSON-LD");

// نسخة مستقبلية فقط: لا «قيد التحقق» (للمادة نسخة موثقة)، مع تنبيه السريان
const futureOnly = presentArticle({
  baseText: "أصل",
  versions: [{ id: "f", body: "لاحق", validFrom: "2099-01-01T00:00:00.000Z", evidenceInstrument: "م/9", evidenceUrl: null }],
  verification: null,
});
ok(futureOnly.unverifiedNotice === null && Boolean(futureOnly.pendingNotice), "نسخة لم تسرِ: تنبيه السريان بلا «قيد التحقق»");

// ── بلا نسخ ولا تحقق: النص الأصلي كما هو ──
const plain = resolveEffectiveText({ articleId: "a", baseText: "نص", versions: [], verification: null });
ok(plain.text === "نص" && plain.source === "original" && plain.status === "الحالة قيد التحقق من المصدر", "بلا سجلات: الأصل مع «قيد التحقق»");

// ── الحقن نفسه: كل نسخة تختار نصها اليوم، ولا تداخل تواريخ داخل المادة ──
const byUnit = new Map<string, UnitVersionRecord[]>();
for (const r of uv) byUnit.set(r.unit_id, [...(byUnit.get(r.unit_id) ?? []), toVersion(r)]);
let mismatches = 0;
for (const [id, vs] of byUnit) {
  const latest = [...vs].sort((a, b) => a.validFrom.localeCompare(b.validFrom)).filter((v) => new Date(v.validFrom) <= new Date()).pop();
  const e = resolveEffectiveText({ articleId: id, baseText: "أصل", versions: vs, verification: null });
  if (latest && e.text !== latest.body) mismatches += 1;
}
ok(byUnit.size === 204, `204 مادة لها نسخ (وجد ${byUnit.size})`);
ok(mismatches === 0, "كل مادة معدلة تُرجع آخر نسخة سارية اليوم");

if (failed) {
  console.error(`\n${failed} اختبار فشل`);
  process.exit(1);
}
console.log("\nكل الاختبارات نجحت");
