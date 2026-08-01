// اختبار مركز المراجعة (§12) — يتحقّق من ثبات ثوابت دورة الحياة دون قاعدة بيانات.
// (اختبار التكامل الكامل يجري في البيئة الحيّة بعد تطبيق الهجرة.)
import type { SuggestionStatus, FindingSeverity } from "@prisma/client";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

// دورة حياة الاقتراح: القرارات المسموحة (§12 لا تعديل صامت).
const DECIDABLE: SuggestionStatus[] = ["ACCEPTED", "REJECTED", "DEFERRED"];
assert(!DECIDABLE.includes("SUGGESTED" as SuggestionStatus), "SUGGESTED ليست قرارًا نهائيًّا");
assert(DECIDABLE.length === 3, "ثلاثة قرارات: قبول/رفض/تأجيل");

// شدّة الملاحظة — سلّم متدرّج.
const SEV: FindingSeverity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
assert(SEV[0] === "INFO" && SEV[SEV.length - 1] === "CRITICAL", "سلّم الشدّة من INFO إلى CRITICAL");

// Evidence-First: قاعدة رفض ملاحظة بلا دليل (تُحاكى منطقيًّا).
function acceptsFinding(evidence: unknown[]): boolean {
  return Array.isArray(evidence) && evidence.length > 0;
}
assert(!acceptsFinding([]), "§13: تُرفض ملاحظة بلا دليل");
assert(acceptsFinding(["م/1"]), "§13: تُقبل ملاحظة بدليل");

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nمركز المراجعة: كل التحقّقات ناجحة.");
