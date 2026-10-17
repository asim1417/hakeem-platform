/**
 * HKM-012: حجب الهوية والجوال على الخادم في نص الحكم والاستئناف والمقتطفات، ومنع العثور على الحكم
 * بالبيانات المحجوبة (المسار المفهرس والسقوط المعجمي وMCP والعناية الواجبة).
 * بيانات مصطنعة بالكامل: الأرقام ليست لأشخاص حقيقيين. قاعدة وهمية مكان prisma؛ لا اتصال بأي خدمة.
 * التشغيل: npx tsx scripts/test-ruling-pii-surface.ts
 */
export {}; // وحدة لا سكربت عام (يمنع تصادم الأسماء مع سكربتات أخرى في tsc)

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

// ── بيانات مصطنعة ──
const ID_LAT = "1987654320";
const ID_IND = "١٩٨٧٦٥٤٣٢٠";
const IQAMA_LAT = "2123456789";
const MOB_LAT = "0551234567";
const MOB_IND = "٠٥٥١٢٣٤٥٦٧";
const CASE_NO = "4471234567"; // رقم قضية بعشر خانات يبدأ بـ 4 (شكل الأرقام في القاعدة)
const filler = (n: number) => "ـ نص ".repeat(n);

type Row = {
  id: string; judgmentTitle: string; judgmentText: string; appealText: string | null;
  caseNo: string; decisionNo: string | null; court: string; cityName: string; classification: null;
  decisionDate: Date | null; createdAt: Date; articleLinks: [];
};
const rows: Row[] = [
  {
    id: "r1",
    judgmentTitle: "حكم في دعوى إيجار",
    judgmentText: `أقام المدعي صاحب الهوية الوطنية رقم ${ID_IND} وجواله ${MOB_IND} دعوى إيجار، واستند إلى المادة 77 من النظام. ${filler(40)}`,
    appealText: `اعترض المدعى عليه (رقم الإقامة: ${IQAMA_LAT}) على الحكم.`,
    caseNo: `رقم القضية - القرار: ${CASE_NO}`,
    decisionNo: "1234",
    court: "المحكمة العامة", cityName: "الرياض", classification: null, decisionDate: null, createdAt: new Date(0), articleLinks: [],
  },
  {
    id: "r2",
    // المطابقة في الموضع 200، والقص يبدأ من 60 وينتهي عند 580؛ الهوية تبدأ في 575 فيقطعها القص الخام.
    judgmentTitle: "حكم تجاري",
    judgmentText: `${"س".repeat(200)}مقاولات${"ص".repeat(575 - 207)}${ID_LAT} تتمة النص`,
    appealText: null,
    caseNo: "رقم القضية - القرار: 9876",
    decisionNo: null,
    court: "المحكمة التجارية", cityName: "جدة", classification: null, decisionDate: null, createdAt: new Date(0), articleLinks: [],
  },
];
const frozen = rows.map((r) => r.judgmentText + "|" + (r.appealText ?? ""));

// ── قاعدة وهمية ──
const lexicalNeedles: string[] = [];
const rawSqlParams: unknown[][] = [];
type Where = { OR?: Array<Record<string, { contains?: string }>>; id?: { in: string[] } };
function matches(r: Row, where: Where): boolean {
  if (where.id?.in) return where.id.in.includes(r.id);
  return (where.OR ?? []).some((cond) => {
    const [field, op] = Object.entries(cond)[0];
    const needle = op.contains ?? "";
    lexicalNeedles.push(needle);
    const v = String((r as unknown as Record<string, unknown>)[field] ?? "");
    return needle !== "" && v.toLowerCase().includes(needle.toLowerCase());
  });
}
const fakePrisma = {
  judicialCase: {
    findMany: async ({ where }: { where: Where }) => rows.filter((r) => matches(r, where)),
    update: async () => { throw new Error("لا كتابة مسموحة في الاختبار"); },
    updateMany: async () => { throw new Error("لا كتابة مسموحة في الاختبار"); },
  },
  // المسار المفهرس: كأن search_norm حُجب (#704)، فلا يجد شيئًا ويسقط إلى المعجمي.
  async $queryRawUnsafe(_sql: string, ...params: unknown[]) {
    rawSqlParams.push(params);
    return [];
  },
  async $queryRaw(sql: { sql?: string; strings?: string[] }) {
    const text = sql.sql ?? (sql.strings ?? []).join("?");
    if (/GROUP BY/.test(text)) return [];
    if (/COUNT\(\*\)/.test(text)) return [{ n: BigInt(rows.length) }];
    return rows.map((r) => ({ id: r.id, caseNo: r.caseNo, decisionNo: r.decisionNo, court: r.court, decisionDateText: null, judgmentText: r.judgmentText }));
  },
  async $executeRawUnsafe() { throw new Error("لا كتابة مسموحة في الاختبار"); },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

const PII_LEAK = new RegExp(`${ID_LAT}|${ID_IND}|${IQAMA_LAT}|${MOB_LAT}|${MOB_IND}|19876|١٩٨٧٦`);

async function main() {
  const { redactPII, stripPiiFromQuery, searchRulingsDirect } = await import("../lib/modules/legal-core/rulings-search");
  const { searchJudgments, buildJudgmentSnippet } = await import("../lib/modules/legal-core/judgment-search");
  const { enumerateRulings } = await import("../lib/mcp/tools/rulings");
  const { HakeemPublishedJudgmentsConnector } = await import("../lib/modules/due-diligence/judgments");

  // ① الحجب على النص (لاتيني، هندي، داخل عبارة، بين أقواس) مع إبقاء أرقام المواد والقضايا والتواريخ.
  const r1 = redactPII(rows[0].judgmentText);
  ok(!r1.includes(ID_IND) && r1.includes("[هوية محجوبة]"), "هوية بأرقام هندية داخل عبارة تُحجب");
  ok(!r1.includes(MOB_IND) && r1.includes("[جوال محجوب]"), "جوال بأرقام هندية يُحجب");
  ok(r1.includes("المادة 77"), "رقم المادة يبقى");
  const appeal = redactPII(rows[0].appealText ?? "");
  ok(!appeal.includes(IQAMA_LAT) && appeal.includes("[هوية محجوبة]"), "رقم إقامة لاتيني بين قوسين في نص الاستئناف يُحجب");
  ok(!redactPII(`جوال +966551234567 و00966551234567`).match(/551234567/), "جوال بمفتاح الدولة (+966 و00966) يُحجب");
  ok(!redactPII("للتواصل +٩٦٦٥٥١٢٣٤٥٦٧ أو 966551234567").match(/551234567|٥٥١٢٣٤٥٦٧/), "جوال دولي بلا صفر (لاتيني وهندي) يُحجب");
  ok(redactPII("رقم الصك 9665123456789").includes("9665123456789"), "رقم صك يبدأ بـ 966 يبقى");
  ok(redactPII(`رقم القضية ${CASE_NO}`).includes(CASE_NO), "رقم قضية بعشر خانات يبدأ بـ 4 يبقى");
  ok(redactPII("صدر في ١٤٤٥/٠٣/١٢هـ").includes("١٤٤٥/٠٣/١٢"), "التاريخ الهجري بأرقام هندية يبقى");

  // ② تنقية الاستعلام.
  for (const q of [ID_LAT, ID_IND, MOB_LAT, MOB_IND, "+966551234567", "٠٠٩٦٦٥٥١٢٣٤٥٦٧", `هوية ${ID_IND}`]) {
    const s = stripPiiFromQuery(q);
    ok(s.hadPii && !PII_LEAK.test(s.query), `الاستعلام «${q}» يُنقّى من الرقم`);
  }
  ok(stripPiiFromQuery(`دعوى إيجار ${MOB_IND}`).query === "دعوى إيجار", "الألفاظ مع الرقم تبقى بعد إزالته");
  ok(stripPiiFromQuery(CASE_NO).query === CASE_NO && !stripPiiFromQuery(CASE_NO).hadPii, "رقم القضية لا يُعدّ بيانات شخصية");
  ok(stripPiiFromQuery("المادة 77 نظام العمل").query === "المادة 77 نظام العمل", "استعلام رقم المادة كما هو");

  // ③ بحث /api/legal-core/search (المفهرس ثم السقوط المعجمي على النص الخام).
  for (const q of [ID_LAT, ID_IND, MOB_LAT, MOB_IND, IQAMA_LAT]) {
    lexicalNeedles.length = 0;
    rawSqlParams.length = 0;
    const res = await searchJudgments(q, 1, 20);
    ok(res.length === 0, `البحث بـ «${q}» لا يعيد حكمًا`);
    ok(!lexicalNeedles.some((n) => PII_LEAK.test(n)) && !rawSqlParams.flat().some((p) => PII_LEAK.test(String(p))), `الرقم «${q}» لا يصل إلى أي استعلام`);
  }
  lexicalNeedles.length = 0;
  const mixed = await searchJudgments(`إيجار ${ID_IND}`, 1, 20);
  ok(!lexicalNeedles.some((n) => PII_LEAK.test(n)), "استعلام مختلط: يصل لفظه فقط إلى السقوط المعجمي");
  ok(mixed.every((m) => !PII_LEAK.test(m.snippet)), "مقتطفات الاستعلام المختلط بلا رقم");
  const byCase = await searchJudgments(CASE_NO, 1, 20);
  ok(byCase.some((m) => m.id === "r1"), "البحث برقم القضية يجد الحكم");
  const byArticle = await searchJudgments("المادة 77", 1, 20);
  ok(byArticle.some((m) => m.id === "r1") && byArticle.every((m) => !PII_LEAK.test(m.snippet)), "البحث برقم المادة يجد الحكم ومقتطفه محجوب");
  const boundary = await searchJudgments("مقاولات", 1, 20);
  ok(boundary.some((m) => m.id === "r2") && boundary.every((m) => !PII_LEAK.test(m.snippet)), "القص عند حدود الرقم لا يُسرّب جزءًا منه");
  ok(!PII_LEAK.test(buildJudgmentSnippet(rows[1].judgmentText, "مقاولات")), "buildJudgmentSnippet يحجب قبل القص");

  // ④ بحث المحادثة والأدوات: الاستعلام برقم فقط لا يصل إلى القاعدة ولا إلى مزوّد المتجهات.
  rawSqlParams.length = 0;
  const direct = await searchRulingsDirect({ query: ID_IND, limit: 5 });
  ok(direct.hits.length === 0 && rawSqlParams.length === 0, "searchRulingsDirect برقم هوية: لا استعلام ولا نتيجة");

  // ⑤ MCP: لفظ برقم لا يُطابَق، والمقتطف يُحجب قبل القص.
  const mcpId = (await enumerateRulings([ID_LAT, MOB_IND])) as { total: number; results?: unknown[] };
  ok(mcpId.total === 0 && (mcpId.results ?? []).length === 0, "MCP: ألفاظ هوية/جوال فقط لا تعيد شيئًا");
  const mcp = (await enumerateRulings(["مقاولات"], undefined, undefined, false, 50, undefined, 520)) as { results: Array<{ snippet: string }> };
  ok(mcp.results.every((r) => !PII_LEAK.test(r.snippet)), "MCP: المقتطفات بلا رقم ولا جزء منه");

  // ⑥ العناية الواجبة: اسم كيان هو رقم هوية لا يُبحث به.
  lexicalNeedles.length = 0;
  const dd = await new HakeemPublishedJudgmentsConnector().collect({ name: ID_IND });
  ok(dd.observations.length === 0 && !lexicalNeedles.some((n) => PII_LEAK.test(n)), "العناية الواجبة: رقم هوية لا يصل إلى البحث");

  // ⑦ النص الأصلي لم يتغير.
  ok(rows.every((r, i) => r.judgmentText + "|" + (r.appealText ?? "") === frozen[i]), "النص الأصلي المخزَّن كما هو");

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log("\nكل الاختبارات ناجحة");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
