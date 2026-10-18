/**
 * HKM-012: حجب الهوية والجوال على الخادم في نص الحكم والاستئناف والمقتطفات، ومنع العثور على الحكم
 * بالبيانات المحجوبة: بالرقم كاملًا، وبجزء منه، وبإضافة «المادة» أو «صك» قبله، عبر كل المسارات
 * (/api/legal-core/search بمساريه، searchRulingsDirect، MCP، العناية الواجبة، صفحة الأحكام).
 *
 * بيانات مصطنعة بالكامل: الأرقام ليست لأشخاص حقيقيين. الاستعلامات الخام تُنفَّذ على PostgreSQL محلي
 * (أنماط الحجب في SQL تُختبر بمحرّكها الحقيقي)، وsearch_norm فيه غير محجوب عمدًا = أسوأ حالة قبل #704.
 * لا اتصال بأي قاعدة بعيدة: PII_TEST_DB اسم قاعدة محلية فقط، ويُرفض أي عنوان اتصال.
 * التشغيل: PII_TEST_DB=hkm012_test npx tsx scripts/test-ruling-pii-surface.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeArabicText } from "../lib/modules/legal-core/arabic-morphology";

let failed = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    failed += 1;
    console.error("✗ " + m);
  } else console.log("✓ " + m);
};

// ── قاعدة محلية فقط ──
const DB = process.env.PII_TEST_DB || "hkm012_test";
if (!/^[a-z0-9_]+$/i.test(DB)) {
  console.error("PII_TEST_DB يقبل اسم قاعدة محلية فقط (لا عنوان اتصال).");
  process.exit(2);
}
process.env.RULINGS_SEMANTIC = "off";
const tmp = mkdtempSync(join(tmpdir(), "hkm012-"));
function psql(sql: string): string {
  const f = join(tmp, "q.sql");
  writeFileSync(f, sql);
  return execFileSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-d", DB, "-f", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PGHOST: "", PGPORT: "" } });
}
const lit = (v: unknown): string => {
  if (Array.isArray(v)) return `ARRAY[${v.map(lit).join(",")}]::text[]`;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  const s = String(v);
  if (s.includes("$pii$")) throw new Error("قيمة غير صالحة");
  return `$pii$${s}$pii$`;
};
const sqlLog: string[] = [];
function runSelect<T>(sql: string, params: unknown[]): T {
  const inlined = sql.replace(/\$(\d+)/g, (_, i) => lit(params[Number(i) - 1]));
  sqlLog.push(inlined);
  const out = psql(`SELECT coalesce(json_agg(t), '[]'::json) FROM (${inlined}) t;`).trim();
  return JSON.parse(out) as T;
}

// ── بيانات مصطنعة ──
const ID_LAT = "1987654320";
const ID_IND = "١٩٨٧٦٥٤٣٢٠";
const IQAMA_LAT = "2123456789";
const MOB_IND = "٠٥٥١٢٣٤٥٦٧";
const CASE_NO = "4471234567"; // رقم قضية بعشر خانات يبدأ بـ 4 (شكل الأرقام في القاعدة)
const CASE_NO_IND = "٤٤٧١٢٣٤٥٦٧";
const filler = (n: number) => "ـ نص ".repeat(n);

type Row = {
  id: string; judgmentTitle: string; judgmentText: string; appealText: string | null;
  caseNo: string; decisionNo: string | null; court: string; cityName: string; classification: null;
  decisionDateText: string | null; decisionDate: Date | null; createdAt: Date; articleLinks: []; source: string;
  sourceId: number | null; sourceLink: null; reviewStatus: string;
};
const base = { cityName: "الرياض", classification: null, decisionDate: null, articleLinks: [] as [], source: "ahkam_moj", sourceLink: null, reviewStatus: "needs_review" };
const rows: Row[] = [
  {
    ...base, id: "r1", sourceId: 1, createdAt: new Date("2024-01-05"),
    judgmentTitle: "حكم في دعوى إيجار",
    judgmentText: `أقام المدعي صاحب الهوية الوطنية رقم ${ID_IND} وجواله ${MOB_IND} دعوى إيجار، واستند إلى المادة 77 من النظام. ${filler(40)}`,
    appealText: `اعترض المدعى عليه (رقم الإقامة: ${IQAMA_LAT}) على الحكم.`,
    caseNo: `رقم القضية - القرار: ${CASE_NO_IND}`,
    decisionNo: "١٢٣٤", court: "المحكمة العامة", decisionDateText: "١٤٤٥/٠٣/١٢هـ",
  },
  {
    // المطابقة في الموضع 200، والقص يبدأ من 60 وينتهي عند 580؛ الهوية تبدأ في 575 فيقطعها القص الخام.
    ...base, id: "r2", sourceId: 2, createdAt: new Date("2024-01-04"),
    judgmentTitle: "حكم تجاري",
    judgmentText: `${"س".repeat(200)} مقاولات ${"ص".repeat(575 - 210)}${ID_LAT} تتمة النص`,
    appealText: null,
    caseNo: "رقم القضية - القرار: ٩٨٧٦", decisionNo: null, court: "المحكمة التجارية", decisionDateText: null,
  },
  {
    // هوية وبريد وجوال مفصول بمسافات وآيبان في متن واحد.
    ...base, id: "r3", sourceId: 3, createdAt: new Date("2024-01-03"),
    judgmentTitle: "حكم عقد مقاولة",
    judgmentText: `عقد مقاولة بين الطرفين، وهوية المدعي ${ID_LAT}، وبريده ahmed.test@example.com وجواله 055 123 4567 وحسابه SA03 8000 0000 6080 1016 7519.`,
    appealText: null,
    caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠١", decisionNo: "٥٥٥", court: "المحكمة العامة", decisionDateText: null,
  },
  {
    // البيانات الشخصية في الاستئناف وحده.
    ...base, id: "r4", sourceId: 4, createdAt: new Date("2024-01-02"),
    judgmentTitle: "حكم عمالي",
    judgmentText: "نزاع عمالي على الأجر المتأخر.",
    appealText: `قدّم المستأنف صاحب الإقامة ${IQAMA_LAT} لائحة استئناف.`,
    caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠٢", decisionNo: null, court: "المحكمة العمالية", decisionDateText: null,
  },
  {
    // HKM-012 (الأمر ٠٨): أسماء أفراد مصطنعة بعد صفات الأطراف، بلا أرقام شخصية.
    ...base, id: "r5", sourceId: 5, createdAt: new Date("2024-01-01"),
    judgmentTitle: "حكم توريد",
    judgmentText: `الوقائع: أقام المدعي/ غانم الموسوي دعواه ضد المدعى عليه/ زيدان الفلاني بطلب ثمن توريد بضاعة.\nوحضر وكيل المدعي المحامي قيصر الطاهري وقرر ما جاء في الصحيفة.\nوفي الجلسة حضر المدعي/ غانم الموسوي والمدعى عليه/ زيدان الفلاني والشاهدة/ رجاء السندي.\nالأسباب: وحيث إن المدعي/ غانم الموسوي أثبت توريد البضاعة، وحيث شهدت الشاهدة/ رجاء السندي بالتسليم.\nمنطوق الحكم: حكمت الدائرة بإلزام المدعى عليه زيدان الفلاني بأن يدفع للمدعي/ غانم الموسوي ثمن التوريد.`,
    appealText: null,
    caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠٥", decisionNo: null, court: "المحكمة التجارية", decisionDateText: null,
  },
];
const NAME_WORDS = ["غانم", "الموسوي", "زيدان", "الفلاني", "قيصر", "الطاهري", "رجاء", "السندي"];
const nameLeak = (t: string) => NAME_WORDS.filter((w) => t.includes(w));
const frozen = JSON.stringify(rows);

function setupDb() {
  const values = rows
    .map((r) =>
      `(${[r.id, r.sourceId, r.judgmentTitle, r.judgmentText, r.appealText, r.caseNo, r.decisionNo, r.court, r.cityName, r.decisionDateText, r.source, r.reviewStatus, r.createdAt.toISOString(),
        // search_norm بلا حجب (أسوأ حالة قبل تنظيف #704).
        normalizeArabicText(`${r.judgmentTitle} ${r.judgmentText}`)]
        .map((v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : lit(v))).join(",")})`,
    )
    .join(",\n");
  psql(`DROP TABLE IF EXISTS judicial_cases;
CREATE TABLE judicial_cases ("id" text PRIMARY KEY, "sourceId" int, "judgmentTitle" text, "judgmentText" text NOT NULL, "appealText" text,
  "caseNo" text, "decisionNo" text, "court" text, "courtOfAppeal" text, "cityName" text, "decisionDateText" text, "caseDateText" text,
  "decisionDate" timestamptz, "source" text, "reviewStatus" text, "createdAt" timestamptz, "classification" jsonb, search_norm text);
INSERT INTO judicial_cases ("id","sourceId","judgmentTitle","judgmentText","appealText","caseNo","decisionNo","court","cityName","decisionDateText","source","reviewStatus","createdAt",search_norm) VALUES
${values};`);
}
const dbFingerprint = () => psql(`SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM judicial_cases t;`).trim();

// ── قاعدة وهمية لنماذج Prisma؛ الاستعلامات الخام إلى PostgreSQL المحلي ──
const noWrite = async () => { throw new Error("لا كتابة مسموحة في الاختبار"); };
type Where = { OR?: Array<Record<string, { contains?: string }>>; id?: { in: string[] }; source?: { in: string[] } };
function matches(r: Row, where: Where): boolean {
  if (where.id?.in) return where.id.in.includes(r.id);
  if (where.source?.in && !where.source.in.includes(r.source)) return false;
  return (where.OR ?? []).some((cond) => {
    const [field, op] = Object.entries(cond)[0];
    const needle = op.contains ?? "";
    const v = String((r as unknown as Record<string, unknown>)[field] ?? "");
    return needle !== "" && v.toLowerCase().includes(needle.toLowerCase());
  });
}
const fakePrisma = {
  judicialCase: {
    findMany: async ({ where }: { where: Where }) => rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
    update: noWrite, updateMany: noWrite, create: noWrite, delete: noWrite, deleteMany: noWrite,
  },
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    return runSelect(sql, params);
  },
  async $executeRawUnsafe(sql: string) {
    if (/^\s*SET LOCAL /i.test(sql)) return 0;
    throw new Error("لا كتابة مسموحة في الاختبار");
  },
  async $transaction(ps: Promise<unknown>[]) {
    return Promise.all(ps);
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

const PII_LEAK = new RegExp(`${ID_LAT}|${ID_IND}|${IQAMA_LAT}|${MOB_IND}|0551234567|055 123 4567|ahmed\\.test|SA03|19876|١٩٨٧٦|21234`);

async function main() {
  setupDb();
  const before = dbFingerprint();
  const { redactPII, stripPiiFromQuery, splitRulingQuery, searchRulingsDirect, findRulingIdsRedacted } = await import("../lib/modules/legal-core/rulings-search");
  const { searchJudgments, buildJudgmentSnippet } = await import("../lib/modules/legal-core/judgment-search");
  const { enumerateRulings, getRuling } = await import("../lib/mcp/tools/rulings");
  const { searchRulings: mcpSearchRulings } = await import("../lib/mcp/adapter");
  const { HakeemPublishedJudgmentsConnector } = await import("../lib/modules/due-diligence/judgments");

  type Path = { name: string; run: (q: string) => Promise<{ ids: string[]; texts: string[]; total?: number }> };
  const paths: Path[] = [
    { name: "/api/legal-core/search", run: async (q) => { const r = await searchJudgments(q, 1, 20); return { ids: r.map((x) => x.id), texts: r.map((x) => x.snippet) }; } },
    { name: "searchRulingsDirect", run: async (q) => { const r = await searchRulingsDirect({ query: q, limit: 20 }); return { ids: r.hits.map((h) => h.id), texts: r.hits.map((h) => `${h.snippet} ${h.disposition ?? ""}`), total: r.total }; } },
    { name: "MCP search", run: async (q) => { const r = await mcpSearchRulings(q, undefined, undefined, 20); return { ids: r.results.map((x) => x.ruling_id), texts: r.results.map((x) => `${x.snippet} ${x.disposition ?? ""}`), total: r.total }; } },
    { name: "MCP enumerate", run: async (q) => { const r = (await enumerateRulings([q])) as { total: number; results?: Array<{ ruling_id: string; snippet: string }> }; return { ids: (r.results ?? []).map((x) => x.ruling_id), texts: (r.results ?? []).map((x) => x.snippet), total: r.total }; } },
    { name: "صفحة الأحكام (المعرّفات المنقّحة)", run: async (q) => { const p = splitRulingQuery(q); const ids = p.sensitive || p.numbers.length ? await findRulingIdsRedacted(p, { limit: 5000 }) : []; return { ids, texts: [], total: ids.length }; } },
  ];

  // ① الحجب على النص (لاتيني، هندي، داخل عبارة، بين أقواس) مع إبقاء أرقام المواد والقضايا والتواريخ.
  const r1 = redactPII(rows[0].judgmentText);
  ok(!r1.includes(ID_IND) && r1.includes("[هوية محجوبة]"), "هوية بأرقام هندية داخل عبارة تُحجب");
  ok(!r1.includes(MOB_IND) && r1.includes("[جوال محجوب]"), "جوال بأرقام هندية يُحجب");
  ok(r1.includes("المادة 77"), "رقم المادة يبقى");
  const appeal = redactPII(rows[0].appealText ?? "");
  ok(!appeal.includes(IQAMA_LAT) && appeal.includes("[هوية محجوبة]"), "رقم إقامة لاتيني بين قوسين في نص الاستئناف يُحجب");
  ok(!redactPII(`جوال +966551234567 و00966551234567`).match(/551234567/), "جوال بمفتاح الدولة (+966 و00966) يُحجب");
  ok(!redactPII("للتواصل +٩٦٦٥٥١٢٣٤٥٦٧ أو 966551234567").match(/551234567|٥٥١٢٣٤٥٦٧/), "جوال دولي بلا صفر (لاتيني وهندي) يُحجب");
  ok(redactPII(`رقم القضية ${CASE_NO}`).includes(CASE_NO), "رقم قضية بعشر خانات يبدأ بـ 4 يبقى");
  ok(redactPII("صدر في ١٤٤٥/٠٣/١٢هـ").includes("١٤٤٥/٠٣/١٢"), "التاريخ الهجري بأرقام هندية يبقى");

  // ② تقسيم الاستعلام: الأرقام الطويلة إلى حقلي القضية والقرار، والهوية تُزال.
  ok(stripPiiFromQuery(`دعوى إيجار ${MOB_IND}`).query === "دعوى إيجار", "الألفاظ مع الجوال تبقى بعد إزالته");
  const sp = splitRulingQuery(`المادة ${ID_LAT}`);
  ok(sp.text === "المادة" && sp.numbers.join() === ID_LAT, "«المادة» + رقم بشكل هوية: الرقم لا يصل إلى المتن");
  ok(splitRulingQuery("19876").text === "" && splitRulingQuery("١٩٨٧٦").numbers.join() === "19876", "جزء رقم من ٥ خانات (لاتيني وهندي) لا يصل إلى المتن");
  ok(splitRulingQuery("المادة 77 نظام العمل").text === "المادة 77 نظام العمل", "استعلام رقم المادة كما هو");

  // ③ الحالة الأولى — البحث بأجزاء الأرقام المحجوبة (لاتينية وهندية، مجردة وداخل عبارة).
  const partials = ["19876", "١٩٨٧٦", "987654", "1987", "21234", "55123", "055 123", "6080", "ahmed.test", "example", "إيجار 19876", "هوية ٩٨٧٦٥٤"];
  // ④ الحالة الثانية — تجاوز الحجب بإضافة «المادة» أو «صك» قبل الرقم.
  const prefixed = [`المادة ${ID_LAT}`, `صك ${ID_LAT}`, `المادة ${ID_IND}`, `صك${ID_LAT}`, `مادة (${IQAMA_LAT})`, `صكوك ${IQAMA_LAT}`, `المادة 0551234567`, `صك ${MOB_IND}`];
  for (const p of paths) {
    for (const q of [...partials, ...prefixed]) {
      const r = await p.run(q);
      ok(r.ids.length === 0 && !r.total, `${p.name}: «${q}» لا يعيد حكمًا ولا عددًا`);
    }
  }
  const dd = new HakeemPublishedJudgmentsConnector();
  for (const q of ["19876", `صك ${ID_LAT}`, "ahmed.test", "21234 استئناف"]) {
    const r = await dd.collect({ name: q });
    ok(r.observations.length === 0, `العناية الواجبة: «${q}» لا يعيد حكمًا`);
  }

  // ⑤ الإبقاء على البحث بأرقام القضايا والقرارات في حقولها، وبأرقام المواد والألفاظ.
  const keep: Array<[string, string]> = [
    [CASE_NO, "r1"], [CASE_NO_IND, "r1"], [`إيجار ${CASE_NO}`, "r1"], ["4470000001", "r3"], ["المادة 77", "r1"], ["عقد مقاولة", "r3"], ["مقاولات", "r2"], ["لائحة استئناف", "r4"],
  ];
  for (const p of paths) {
    for (const [q, id] of keep) {
      if (p.name.startsWith("صفحة") && !splitRulingQuery(q).sensitive && !splitRulingQuery(q).numbers.length) continue; // الصفحة: النص العربي الخالص على الخام كما كان
      // MCP وsearchRulingsDirect يبحثان في العنوان والمتن (search_norm) لا الاستئناف، كما كانا.
      if ((p.name === "MCP enumerate" || p.name === "MCP search" || p.name === "searchRulingsDirect") && q === "لائحة استئناف") continue;
      const r = await p.run(q);
      ok(r.ids.includes(id), `${p.name}: «${q}» يجد ${id}`);
      ok(r.texts.every((t) => !PII_LEAK.test(t)), `${p.name}: مقتطفات «${q}» بلا بيانات محجوبة`);
    }
  }
  const byDecision = await findRulingIdsRedacted(splitRulingQuery("1234"), { limit: 10 });
  ok(byDecision.includes("r1"), "رقم قرار قصير يُطابَق في حقل القرار");
  ok((await searchRulingsDirect({ query: "4470000002", limit: 5 })).hits.some((h) => h.id === "r4"), "رقم القضية وحده يجد الحكم في searchRulingsDirect");

  // ⑥ القص عند حدود الرقم، والنص الأصلي.
  ok(!PII_LEAK.test(buildJudgmentSnippet(rows[1].judgmentText, "مقاولات")), "buildJudgmentSnippet يحجب قبل القص");
  const mcp = (await enumerateRulings(["مقاولات", "مقاولة"], undefined, undefined, false, 50, undefined, 520)) as { results: Array<{ snippet: string }> };
  ok(mcp.results.length > 0 && mcp.results.every((r) => !PII_LEAK.test(r.snippet)), "MCP: المقتطفات بلا رقم ولا جزء منه");
  // HKM-012 (الأمر ٠٨، المسار ٣): أدوات الأحكام في الموصل لا تُخرج اسم فرد (البحث والحصر والجلب بكل شرائحه وأجزائه).
  const s5 = await mcpSearchRulings("توريد", undefined, undefined, 20);
  const s5hit = s5.results.find((x) => x.ruling_id === "r5");
  ok(Boolean(s5hit) && nameLeak(`${s5hit?.snippet ?? ""} ${s5hit?.disposition ?? ""}`).length === 0, `MCP search: مقتطف r5 ومنطوقه بلا اسم فرد (${nameLeak(`${s5hit?.snippet ?? ""} ${s5hit?.disposition ?? ""}`).join("،") || "لا تسرّب"})`);
  const e5 = (await enumerateRulings(["توريد"])) as { results: Array<{ ruling_id: string; snippet: string }> };
  const e5hit = e5.results.find((x) => x.ruling_id === "r5");
  ok(Boolean(e5hit) && nameLeak(e5hit?.snippet ?? "").length === 0, "MCP enumerate: مقتطف r5 بلا اسم فرد");
  for (const part of [undefined, "reasons", "disposition"] as const) {
    for (const size of [9, 23, 61, 400]) {
      let offset: number | null = 0;
      let joined = "";
      for (let g = 0; offset !== null && g < 400; g++) {
        const r = (await getRuling("r5", offset, size, part)) as { text?: string; next_offset?: number | null };
        joined += r.text ?? "";
        offset = r.next_offset ?? null;
      }
      ok(joined.length > 0 && nameLeak(joined).length === 0, `MCP get_ruling: r5${part ? ` (${part})` : ""} بشرائح ${size} بلا اسم فرد`);
    }
  }
  const g5 = (await getRuling("r5", 0, 50)) as { total_chars?: number; parts?: Array<{ start: number; end: number }> };
  ok((g5.parts ?? []).length > 0 && (g5.parts ?? []).every((p) => p.end <= (g5.total_chars ?? 0)), "MCP get_ruling: إزاحات الأجزاء في النص المحجوب (لا تتجاوز طوله)");
  // HKM-012 (الأمر ٠٨): hakeem_get_ruling بشرائح قصيرة متتالية لا يسرّب رقمًا ولا جزءًا منه على حد شريحة.
  for (const row of rows) {
    for (const size of [17, 41, 97]) {
      let offset: number | null = 0;
      let leak = false;
      for (let g = 0; offset !== null && g < 400; g++) {
        const r = (await getRuling(row.id, offset, size)) as { text?: string; next_offset?: number | null };
        if (PII_LEAK.test(r.text ?? "")) leak = true;
        offset = r.next_offset ?? null;
      }
      ok(!leak, `MCP get_ruling: ${row.id} بشرائح ${size} حرفًا بلا رقم محجوب`);
    }
  }
  ok(JSON.stringify(rows) === frozen, "النص الأصلي في الذاكرة كما هو");
  ok(dbFingerprint() === before, "النص الأصلي في القاعدة كما هو (بصمة الجدول قبل الاختبار وبعده)");
  ok(sqlLog.every((s) => !/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP|ALTER)\b/i.test(s)), "كل الاستعلامات قراءة فقط");

  if (failed) {
    console.error(`\n${failed} فشل`);
    process.exit(1);
  }
  console.log(`\nكل الاختبارات ناجحة (${sqlLog.length} استعلامًا على PostgreSQL المحلي)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
