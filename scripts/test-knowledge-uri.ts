// اختبار الهوية السيادية والمنشأ (§7) — نواة نقيّة.
import { buildUri, parseUri, isKnowledgeEntityType } from "../lib/modules/knowledge/uri";
import { buildProvenance, isProvenance } from "../lib/modules/knowledge/provenance";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

assert(buildUri("article", "abc123") === "platform://article/abc123", "بناء URI");
const p = parseUri("platform://ruling/xyz");
assert(p?.type === "ruling" && p?.id === "xyz", "تحليل URI صحيح");
assert(parseUri("http://x/y") === null, "رفض مخطط غير سياديّ");
assert(parseUri("platform://unknown/1") === null, "رفض نوع غير معروف");
assert(isKnowledgeEntityType("finding"), "نوع معروف");
assert(!isKnowledgeEntityType("zzz"), "نوع مجهول مرفوض");

const prov = buildProvenance({ source: "moj", externalId: "9", contentHash: "deadbeef" });
assert(prov.verification === "unverified", "verification افتراضيّ unverified");
assert(isProvenance(prov), "تحقّق بنيويّ للمنشأ");
assert(!isProvenance({ x: 1 }), "رفض كائن ليس منشأً");

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nالهوية السيادية والمنشأ: كل التحقّقات ناجحة.");
