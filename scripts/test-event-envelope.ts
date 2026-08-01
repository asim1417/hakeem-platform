// اختبار مغلّف الحدث (§6) — بلا قاعدة بيانات: يتحقّق من نقاء البناء.
import {
  buildEnvelope,
  newCorrelationId,
  CURRENT_EVENT_SCHEMA_VERSION,
} from "../lib/modules/audit/event-envelope";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures += 1;
    console.error("✗", msg);
  } else {
    console.log("✓", msg);
  }
}

const now = "2026-08-01T00:00:00.000Z";

// 1) توليد معرّف ارتباط فريد وثابت النوع.
const a = newCorrelationId();
const b = newCorrelationId();
assert(typeof a === "string" && a.length > 0, "newCorrelationId ينتج نصًّا غير فارغ");
assert(a !== b, "معرّفات الارتباط فريدة");

// 2) المغلّف يملأ الإصدار الافتراضي ويولّد correlationId عند غيابه.
const env1 = buildEnvelope({ type: "SuggestionAccepted", subject: "ADMIN", occurredAt: now });
assert(env1.schemaVersion === CURRENT_EVENT_SCHEMA_VERSION, "schemaVersion الافتراضيّ يُطبَّق");
assert(Boolean(env1.correlationId), "correlationId يُولَّد تلقائيًّا");
assert(env1.occurredAt === now, "occurredAt يُمرَّر كما هو (لا Date.now خفيّ)");

// 3) احترام القيم الممرَّرة (السببية والارتباط).
const env2 = buildEnvelope({
  type: "FindingAdded",
  subject: "ADMIN",
  occurredAt: now,
  correlationId: "corr-1",
  causationId: "cause-1",
  entityId: "e1",
  actorId: "u1",
  payload: { severity: "HIGH" },
});
assert(env2.correlationId === "corr-1", "يحترم correlationId الممرَّر");
assert(env2.causationId === "cause-1", "يحترم causationId الممرَّر");
assert(env2.payload?.severity === "HIGH", "الحمولة تُحفَظ");

if (failures > 0) {
  console.error(`\nفشل ${failures} تحقّق.`);
  process.exit(1);
}
console.log("\nمغلّف الحدث: كل التحقّقات ناجحة.");
