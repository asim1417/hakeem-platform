/**
 * HKM-065: السجل المخلوط المستبعد من العرض («سجل مخلوط — لا يُعرض») لا يحسم إليه hakeem_resolve، ويظهر بحالته في الفهرس.
 * الحالة الحية 29/10: «نظام السجل التجاري» كان يحسم إلى السجل المخلوط (مطابقة تامة، «غير مؤكد») قبل إصدار 1446 الساري.
 * قاعدة وهمية (SqlClient)؛ لا شبكة ولا قاعدة.
 * التشغيل: npx tsx scripts/test-resolve-hidden.ts
 */
import { handleResolve, HIDDEN_STATUS, lawScopeForFilters, loadLawCatalog, resetCatalogCache } from "../lib/mcp/tools/catalog";
import { editionTitle, normalizeLawName, rankLawNameMatches } from "../lib/modules/legal-core/law-name-match";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

const row = (id: string, name: string, verified_status: string | null, card_issued: string | null, article_count: number) => ({
  id, name, code: null, domain: null, domain_title: null, classification: "أنظمة التجارة والاقتصاد والاستثمار", article_count,
  instrument_kind: null, verified_status, card_issued, issuance_date: null, royal_decree: null,
});

const ROWS = [
  row("mixed", "نظام السجل التجاري", HIDDEN_STATUS, null, 29),
  row("cur", "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ", "ساري", "1446/03/19", 29),
  row("old", "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/1) وتاريخ 1416/2/21هـ", "مستبدل", null, 20),
  row("labor", "نظام العمل", "ساري", "1426/08/23", 245),
];

const db = {
  async query<T>(sql: string): Promise<T[]> {
    if (sql.includes("to_regclass")) return [{ ok: true }] as unknown as T[];
    if (sql.includes("FROM legal_systems s") && sql.includes("ORDER BY s.name")) return ROWS as unknown as T[];
    return [];
  },
};

async function main() {
  resetCatalogCache();
  const cat = await loadLawCatalog(db);
  ok(cat.find((l) => l.law_id === "mixed")?.status === HIDDEN_STATUS, "السجل المخلوط يظهر بحالته لا «غير مؤكد»");
  ok(cat.find((l) => l.law_id === "cur")?.status === "ساري" && cat.find((l) => l.law_id === "old")?.status === "لاغي", "حالات بقية الأنظمة كما هي");

  const r = await handleResolve(db, { q: "نظام السجل التجاري" });
  ok(r.candidates[0]?.law_id === "cur", `الحسم إلى الإصدار الساري (${r.candidates.map((c) => c.law_id).join(",")})`);
  ok(!r.candidates.some((c) => c.law_id === "mixed"), "السجل المخلوط ليس مرشحًا");
  ok(r.candidates.findIndex((c) => c.law_id === "old") > r.candidates.findIndex((c) => c.law_id === "cur"), "الملغى يتأخر عن الساري");
  ok((await handleResolve(db, { q: "نظام العمل" })).candidates[0]?.law_id === "labor", "حسم الأسماء الأخرى كما هو");

  const scope = await lawScopeForFilters(db, {});
  ok(scope.exclude.includes("mixed") && !scope.exclude.includes("cur"), "نطاق «الساري» يستبعد السجل المخلوط");

  // HKM-065ب: اسم الإصدار «X الصادر بالمرسوم …» يطابق «X» مطابقةً تامة (كان «نظام التنفيذ» ← «نظام التنفيذ أمام ديوان المظالم»).
  ok(editionTitle(normalizeLawName("نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ")) === "نظام التنفيذ", "عنوان الإصدار بلا لاحقة المرسوم");
  ok(editionTitle(normalizeLawName("تنظيم هيئة الأفلام الصادر بقرار مجلس الوزراء رقم 1")) === "تنظيم هيئه الافلام", "عنوان الإصدار بلا لاحقة القرار");
  ok(editionTitle(normalizeLawName("نظام التنفيذ أمام ديوان المظالم")) === "نظام التنفيذ امام ديوان المظالم", "اسم بلا لاحقة إصدار لا يتغير");
  const enf = [
    { id: "griev", name: "نظام التنفيذ أمام ديوان المظالم", articleCount: 37 },
    { id: "cur", name: "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ", articleCount: 65 },
    { id: "old", name: "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ", articleCount: 98 },
  ];
  const r1 = rankLawNameMatches(enf, "نظام التنفيذ", { retired: new Set(["old"]) });
  ok(r1.matchType === "exact" && r1.match?.id === "cur" && r1.alternatives[0]?.id === "old", `«نظام التنفيذ» ← الإصدار الساري (${r1.match?.id}، ${r1.alternatives.map((a) => a.id).join(",")})`);
  ok(rankLawNameMatches(enf, "نظام التنفيذ 1433", { retired: new Set(["old"]) }).match?.id === "old", "السنة في السؤال ما زالت تختار إصدارها");
  ok(rankLawNameMatches(enf, "نظام التنفيذ أمام ديوان المظالم").match?.id === "griev", "الاسم الأطول يحسم إلى نظامه");

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log("\nكل اختبارات HKM-065 نجحت");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
