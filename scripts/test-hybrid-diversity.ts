/**
 * اختبار تنوّع أنواع نتائج الدمج الهجين (بلا قاعدة).
 * التشغيل: npx tsx scripts/test-hybrid-diversity.ts
 */
import { pickDiverseByType, type MergedResult } from "../lib/modules/legal-search/hybrid-search";

let failed = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("✗ " + msg);
  } else console.log("✓ " + msg);
}

function mk(type: MergedResult["type"], id: string, confidence: number): MergedResult {
  return {
    type,
    id,
    title: `${type}-${id}`,
    confidence,
    sources: ["postgres"],
    reasons: ["test"],
    meta: { sourceType: type },
  };
}

const sorted: MergedResult[] = [
  ...Array.from({ length: 25 }, (_, i) => mk("article", `a${i}`, 1 - i * 0.01)),
  ...Array.from({ length: 15 }, (_, i) => mk("ruling", `r${i}`, 0.5 - i * 0.01)),
  ...Array.from({ length: 8 }, (_, i) => mk("principle", `p${i}`, 0.4 - i * 0.01)),
];

const picked = pickDiverseByType(sorted, 20);
const counts = picked.reduce(
  (m, r) => {
    m[r.type] = (m[r.type] || 0) + 1;
    return m;
  },
  {} as Record<string, number>,
);

ok(picked.length === 20, "القائمة بطول السقف 20");
ok((counts.ruling ?? 0) >= 4, `حصّة أحكام ≥ 4 (فعليًا ${counts.ruling ?? 0})`);
ok((counts.principle ?? 0) >= 2, `حصّة مبادئ ≥ 2 (فعليًا ${counts.principle ?? 0})`);
ok((counts.article ?? 0) >= 1, `مواد موجودة (${counts.article ?? 0})`);

const articlesOnly = pickDiverseByType(
  Array.from({ length: 30 }, (_, i) => mk("article", `x${i}`, 1 - i * 0.01)),
  10,
);
ok(articlesOnly.every((r) => r.type === "article") && articlesOnly.length === 10, "بلا أحكام: تبقى المواد فقط");

const short = pickDiverseByType(sorted.slice(0, 5), 20);
ok(short.length === 5, "أقصر من السقف: تُعاد كما هي");

console.log(failed === 0 ? "\n✓ نجح اختبار تنوّع الدمج" : `\n✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
