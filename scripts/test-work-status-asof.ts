// اختبار حالة العمل بتاريخ السريان: «نظام التنفيذ» م/53 ساري حتى 27/10/2026، ثم م/237 ساري وم/53 مستبدل.
// الصفوف مطابقة لوجه البحث في الإنتاج (16/10/2026). التشغيل: npx tsx scripts/test-work-status-asof.ts
import { computeSurface, unitStatusAsOf, workStatusAsOf, type SurfaceRow, type SurfaceMember } from "@/lib/modules/legal-core/search-surface";

const WORK = "we:cmpwi0c2p001znxffggwph0fg";
const MIXED = "cmpwi0c2p001znxffggwph0fg";
const OLD = "ed25-d62948bc9ac1a3c3fb813076"; // م/53
const NEW = "ed25-c2a4c0ce70ba0e7eee683d32"; // م/237
const OTHER = "ed25-71b37d1ec31a497747ed643c"; // عمل آخر وجهه نفسه

const rows: SurfaceRow[] = [
  { id: "r1", workKey: WORK, surfaceSystemId: OLD, validOn: "2012-07-03", createdAt: "2026-10-16T13:50:17.891Z" },
  { id: "r2", workKey: WORK, surfaceSystemId: NEW, validOn: "2026-10-28", createdAt: "2026-10-16T13:50:17.891Z" },
  { id: "r3", workKey: "we:other", surfaceSystemId: OTHER, validOn: "2025-04-03", createdAt: "2026-10-16T13:50:17.891Z" },
];
const members: SurfaceMember[] = [
  { workKey: WORK, systemId: MIXED },
  { workKey: WORK, systemId: OLD },
  { workKey: WORK, systemId: NEW },
  { workKey: "we:other", systemId: OTHER },
];
// الحالات المسجلة في سجل التحقق اليوم.
const recorded: Record<string, string> = { [MIXED]: "سجل مخلوط — لا يُعرض", [OLD]: "ساري", [NEW]: "صادر لم يسرِ بعد", [OTHER]: "ساري" };

let failed = 0;
function expect(asOf: string, id: string, status: string, replacedBy: string | null = null) {
  const got = workStatusAsOf(id, recorded[id], computeSurface(rows, members, asOf));
  const ok = got.status === status && got.replacedBy === replacedBy;
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${asOf} ${id} → ${got.status}${got.replacedBy ? ` (البديل ${got.replacedBy})` : ""}`);
}

for (const day of ["2026-10-16", "2026-10-27"]) {
  expect(day, OLD, "ساري");
  expect(day, NEW, "صادر لم يسرِ بعد");
  expect(day, MIXED, "سجل مخلوط — لا يُعرض");
}
for (const day of ["2026-10-28", "2027-01-01"]) {
  expect(day, OLD, "مستبدل", NEW);
  expect(day, NEW, "ساري");
  expect(day, MIXED, "سجل مخلوط — لا يُعرض");
}
expect("2026-10-28", OTHER, "ساري");
// نظام بلا وجه: الحالة كما سُجّلت.
const none = workStatusAsOf("x", "ملغى", computeSurface(rows, members, "2026-10-28"));
if (none.status !== "ملغى" || none.derived) failed += 1;
console.log(`${none.status === "ملغى" && !none.derived ? "✓" : "✗"} نظام خارج الوجه يبقى «ملغى»`);

// حالة المادة تتبع عملها: مواد م/237 «صادر لم يسرِ بعد» تصير «ساري» يوم 28/10، ومواد م/53 «ساري» تصير «مستبدل».
function unit(asOf: string, id: string, recordedUnit: string, want: string) {
  const got = unitStatusAsOf(recordedUnit, workStatusAsOf(id, recorded[id], computeSurface(rows, members, asOf)));
  if (got !== want) failed += 1;
  console.log(`${got === want ? "✓" : "✗"} ${asOf} مادة في ${id} «${recordedUnit}» → ${got}`);
}
unit("2026-10-27", NEW, "صادر لم يسرِ بعد", "صادر لم يسرِ بعد");
unit("2026-10-28", NEW, "صادر لم يسرِ بعد", "ساري");
unit("2026-10-27", OLD, "ساري", "ساري");
unit("2026-10-28", OLD, "ساري", "مستبدل");
unit("2026-10-28", OLD, "ملغاة", "ملغاة"); // مادة ملغاة تبقى ملغاة
unit("2026-10-28", OTHER, "ساري", "ساري");
unit("2026-10-28", MIXED, "ساري", "ساري"); // السجل المخلوط لا يُشتق

if (failed) {
  console.error(`\n${failed} فشل`);
  process.exit(1);
}
console.log("\nكل الاختبارات ناجحة");
