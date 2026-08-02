// اختبار خوارزمية توزيع الاستهلاك على الـBuckets (المرحلة B) — نقيّ بلا قاعدة.
import {
  allocateConsumption,
  sortBucketsForConsumption,
  distributeBySource,
  sumRemaining,
  type CreditBucketRow,
} from "@/lib/modules/credits/bucket-allocation";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

const d = (iso: string) => new Date(iso);
const bucket = (
  id: string,
  remaining: number,
  expiresAt: string | null,
  priority = 100,
  createdAt = "2026-01-01T00:00:00Z"
): CreditBucketRow => ({
  id,
  sourceType: "SUBSCRIPTION",
  remainingMilliUnits: remaining,
  expiresAt: expiresAt ? d(expiresAt) : null,
  priority,
  createdAt: d(createdAt),
});

// ── الأقرب انتهاءً أولًا ──
const bs = [
  bucket("no_exp", 5000, null),
  bucket("late", 5000, "2026-12-01T00:00:00Z"),
  bucket("soon", 5000, "2026-06-01T00:00:00Z"),
];
const sorted = sortBucketsForConsumption(bs).map((b) => b.id);
T("ترتيب: soon ثم late ثم no_exp", sorted[0] === "soon" && sorted[1] === "late" && sorted[2] === "no_exp");

// استهلاك 6000 من {soon:5000, late:5000, no_exp:5000} → 5000 من soon + 1000 من late
const r1 = allocateConsumption(bs, 6000);
T("consumed=6000 shortfall=0", r1.consumed === 6000 && r1.shortfall === 0);
T("allocations: soon=5000", r1.allocations.find((a) => a.bucketId === "soon")?.amount === 5000);
T("allocations: late=1000", r1.allocations.find((a) => a.bucketId === "late")?.amount === 1000);
T("allocations: no_exp غير مستخدم", !r1.allocations.find((a) => a.bucketId === "no_exp"));

// ── عجز عند نقص الرصيد ──
const r2 = allocateConsumption([bucket("a", 1000, null)], 3000);
T("shortfall=2000 عند نقص", r2.consumed === 1000 && r2.shortfall === 2000);

// ── مبلغ صفر ──
const r3 = allocateConsumption(bs, 0);
T("amount=0 → لا تخصيص", r3.consumed === 0 && r3.allocations.length === 0);

// ── تجاهل buckets الفارغة ──
const r4 = allocateConsumption([bucket("empty", 0, "2026-03-01T00:00:00Z"), bucket("full", 2000, "2026-09-01T00:00:00Z")], 1500);
T("يتخطّى الفارغ ويأخذ من الممتلئ", r4.consumed === 1500 && r4.allocations.length === 1 && r4.allocations[0].bucketId === "full");

// ── الأولوية كسر تعادل (نفس الانتهاء) ──
const tie = [
  bucket("low", 1000, "2026-06-01T00:00:00Z", 50),
  bucket("high", 1000, "2026-06-01T00:00:00Z", 200),
];
const tieSorted = sortBucketsForConsumption(tie).map((b) => b.id);
T("تعادل الانتهاء: الأعلى أولوية أولًا", tieSorted[0] === "high");

// ── التوزيع حسب المصدر ──
const mixed: CreditBucketRow[] = [
  { id: "t", sourceType: "TRIAL", remainingMilliUnits: 40000, expiresAt: null, priority: 100, createdAt: d("2026-01-01") },
  { id: "s", sourceType: "SUBSCRIPTION", remainingMilliUnits: 500000, expiresAt: null, priority: 100, createdAt: d("2026-01-01") },
  { id: "p", sourceType: "PURCHASE", remainingMilliUnits: 250000, expiresAt: null, priority: 100, createdAt: d("2026-01-01") },
];
const dist = distributeBySource(mixed);
T("توزيع: TRIAL=40000", dist.TRIAL === 40000);
T("توزيع: SUBSCRIPTION=500000", dist.SUBSCRIPTION === 500000);
T("توزيع: PURCHASE=250000", dist.PURCHASE === 250000);
T("توزيع: PROMOTION=0", dist.PROMOTION === 0);
T("sumRemaining = 790000", sumRemaining(mixed) === 790000);

// ── لا تخصيص سالب ──
T("لا تخصيص سالب", allocateConsumption([bucket("a", -5, null)], 100).consumed === 0);

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
