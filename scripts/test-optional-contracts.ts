// اختبار العقود الاختياريّة (§9/§11/§16/§20/§23/§17/§27) — نواة نقيّة.
import { supports, NotSupportedError, type SourceAdapter } from "../lib/modules/sources/source-adapter";
import { docSupports, DocNotSupportedError, type DocumentProvider } from "../lib/modules/documents/document-provider";
import { evaluateAbac } from "../lib/modules/auth/abac-policy";
import { resolveRules } from "../lib/modules/governance/rule-priority";
import { increment, observeDuration, snapshot, __resetMetrics } from "../lib/modules/observability/metrics";
import { estimateCost } from "../lib/modules/ai/cost-estimator";
import { validateCompatibility } from "../lib/modules/governance/compatibility";

let failures = 0;
function assert(c: boolean, m: string) { if (!c) { failures++; console.error("✗", m); } else console.log("✓", m); }

// §9 SourceAdapter
const src: SourceAdapter = { provider: "X", capabilities: ["fetchMetadata"] };
assert(supports(src, "fetchMetadata"), "§9 supports يقرأ القدرة");
assert(!supports(src, "discover"), "§9 قدرة غير معلنة");
assert(new NotSupportedError("discover", "X").name === "NotSupportedError", "§9 خطأ عدم الدعم");

// §11 DocumentProvider
const dp: DocumentProvider = { name: "d", capabilities: ["exportDocument"] };
assert(docSupports(dp, "exportDocument"), "§11 docSupports");
assert(!docSupports(dp, "renderPreview"), "§11 قدرة غير معلنة");
assert(new DocNotSupportedError("renderPreview", "d").name === "DocNotSupportedError", "§11 خطأ عدم الدعم");

// §20 ABAC
assert(evaluateAbac({ userId: "u1", role: "LAWYER" }, { ownerId: "u1" }, "write").allowed, "§20 المالك يكتب");
assert(!evaluateAbac({ userId: "u2", role: "LAWYER" }, { ownerId: "u1" }, "write").allowed, "§20 غير المالك لا يكتب");
assert(evaluateAbac({ userId: "a", role: "ADMIN", isAdmin: true }, { ownerId: "u1" }, "delete").allowed, "§20 المدير يتجاوز");
assert(!evaluateAbac({ userId: "u2", role: "LAWYER", clearance: "INTERNAL" }, { ownerId: "u1", dataClass: "RESTRICTED" }, "read").allowed, "§20 تصنيف غير كافٍ يمنع القراءة");

// §16 rule-priority
const resolved = resolveRules([
  { key: "deadline", layer: "domain", value: 30 },
  { key: "deadline", layer: "official", value: 60 },
]);
assert(resolved.length === 1 && resolved[0].value === 60 && resolved[0].layer === "official", "§16 الطبقة الرسميّة تتقدّم");
assert(resolved[0].overrode.length === 1, "§16 يسجّل ما تجاوزته");

// §23 metrics
__resetMetrics();
increment("test.count", 2);
increment("test.count");
observeDuration("test.op", 100);
observeDuration("test.op", 300);
const snap = snapshot();
assert(snap.counters.find((c) => c.name === "test.count")?.value === 3, "§23 العدّاد يجمع");
assert(snap.timers.find((t) => t.name === "test.op")?.avgMs === 200, "§23 متوسّط الزمن");

// §17 cost-estimator
const est = estimateCost("anthropic", "claude-3-5-sonnet-latest", 1000, 1000);
assert(est.costUsd !== null && est.costUsd > 0, "§17 تكلفة مقدَّرة لنموذج مسجَّل");
assert(estimateCost("anthropic", "ghost-model", 1000, 1000).costUsd === null, "§17 نموذج غير مسجَّل → null");

// §27 compatibility
assert(validateCompatibility().ok, `§27 مصفوفة التوافق صحيحة: ${validateCompatibility().errors.join("، ")}`);

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nالعقود الاختياريّة: كل التحقّقات ناجحة.");
