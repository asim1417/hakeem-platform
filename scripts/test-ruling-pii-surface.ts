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
rows.push({
  // HKM-012: اسم بلا ترقيم يليه رابط جملة؛ الحجب يجب ألا يمحو مرسى «الأسباب» فيضيع الجزء في الجلب.
  ...base, id: "r6", sourceId: 6, createdAt: new Date("2023-12-31"),
  judgmentTitle: "حكم مقاولة باطن",
  judgmentText: `الدعوى: أقام المدعي/ غانم الموسوي وحيث إن المدعى عليه/ زيدان بن سالم الفلاني لم يسدد مستحقات مقاولة الباطن.\nالأسباب: وحيث إن الدائرة اطلعت على العقد، ولما كان المدعى عليه/ زيدان الفلاني فأجاب بالإنكار.\nمنطوق الحكم: حكمت الدائرة بإلزام المدعى عليه بأن يدفع للمدعي مستحقات الباطن.`,
  appealText: null,
  caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠٦", decisionNo: null, court: "المحكمة التجارية", decisionDateText: null,
});
rows.push({
  // HKM-012: الاسم في الاستئناف وحده (search_norm في الإنتاج يضم الاستئناف، والموصل لا يعرضه).
  ...base, id: "r7", sourceId: 7, createdAt: new Date("2023-12-30"),
  judgmentTitle: "حكم أجرة محل تجاري",
  judgmentText: "الوقائع: نزاع على أجرة محل تجاري متأخرة.\nالأسباب: وحيث ثبت التأخر في السداد.\nمنطوق الحكم: حكمت الدائرة بإلزام المستأجر بالأجرة.",
  appealText: "اعترض المستأنف/ مروان السندي على الحكم لأسباب إجرائية.",
  caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠٧", decisionNo: null, court: "المحكمة التجارية", decisionDateText: "١٤٤٤/٠٢/٠١هـ",
});
rows.push({
  // HKM-012: أعضاء الدائرة بـ«ﷲ» حرفًا واحدًا في التوقيع.
  ...base, id: "r8", sourceId: 8, createdAt: new Date("2023-12-29"),
  judgmentTitle: "حكم شراكة",
  judgmentText: "الأسباب: وحيث إن الشراكة ثابتة بالعقد.\nمنطوق الحكم: حكمت الدائرة بتصفية الشراكة. عضو قيصر بن عبدﷲ الطاهري\tرئيس الدائرة سالم بن عبدﷲ الفلاني",
  appealText: null,
  caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠٨", decisionNo: null, court: "المحكمة العامة", decisionDateText: "١٤٤٣/٠١/٠١هـ",
});
rows.push({
  // «سالم» كلمة عامة هنا («سالم من العيوب»)، واسم في r6 وr8: لفظ يطابق داخل الأسماء غالبًا لا يطابق شيئًا.
  ...base, id: "r9", sourceId: 9, createdAt: new Date("2023-12-28"),
  judgmentTitle: "حكم توريد إسعاف",
  judgmentText: "الأسباب: وحيث إن المبيع سالم من العيوب عند توريد سيارات الإسعاف.\nمنطوق الحكم: حكمت الدائرة برفض الدعوى.",
  appealText: null,
  caseNo: "رقم القضية - القرار: ٤٤٧٠٠٠٠٠٠٩", decisionNo: null, court: "المحكمة العامة", decisionDateText: null,
});
for (const [id, court, text] of [
  // «الخياط» مهنة في حكمين، واسم في الثالث: لفظ غير ملوّث (ثلث عيّنته)، فالعدد الصغير يُحسب من المرئي.
  ["r10", "المحكمة العامة", "الأسباب: وحيث إن محل الخياط مستأجر بعقد مكتوب.\nمنطوق الحكم: حكمت الدائرة بفسخ الإيجار."],
  ["r11", "المحكمة التجارية", "الأسباب: وحيث إن الخياط سلّم الأثواب متأخرًا.\nمنطوق الحكم: حكمت الدائرة بالتعويض."],
  ["r12", "المحكمة العمالية", "الوقائع: أقام المدعي/ قيصر الخياط دعواه بطلب أجر متأخر.\nمنطوق الحكم: حكمت الدائرة برفض الدعوى."],
  // «حسن» اسم في ثلاثة أحكام فيها «النية» أيضًا، و«حسن النية» عبارة في حكمين.
  ["r14", "المحكمة التجارية", "الأسباب: وحيث إن المشتري حسن النية فلا يُلزم بالرد.\nمنطوق الحكم: حكمت الدائرة برفض الدعوى."],
  ["r15", "المحكمة العامة", "الأسباب: وحيث إن الحائز حسن النية يتملك الثمار.\nمنطوق الحكم: حكمت الدائرة بما يلي."],
  ["r16", "المحكمة العامة", "الوقائع: أقام المدعي/ حسن مروان دعواه.\nالأسباب: وحيث إن النية لا تثبت إلا ببينة.\nمنطوق الحكم: حكمت الدائرة بالرفض."],
  ["r17", "المحكمة العامة", "الوقائع: حضر المدعى عليه/ حسن هلال.\nالأسباب: وحيث إن النية محلها القلب.\nمنطوق الحكم: حكمت الدائرة بالرفض."],
  ["r18", "المحكمة العامة", "الوقائع: حضر الشاهد/ حسن زيدان.\nالأسباب: وحيث إن النية غير ظاهرة.\nمنطوق الحكم: حكمت الدائرة بالرفض."],
  // اسم بالأشكال المعروضة (نص مستخرج من PDF).
  ["r13", "المحكمة العامة", "ﺍﻟﻮﻗﺎﺋﻊ: ﺃﻗﺎﻡ ﺍﻟﻤﺪﻋﻲ/ ﻣﺮﻭﺍﻥ ﺍﻟﺴﻨﺪﻱ ﺩﻋﻮﺍﻩ.\nمنطوق الحكم: حكمت الدائرة بإلزام المدعى عليه."],
] as const) {
  rows.push({ ...base, id, sourceId: Number(id.slice(1)), createdAt: new Date("2023-12-01"), judgmentTitle: "حكم", judgmentText: text, appealText: null,
    caseNo: `رقم القضية - القرار: ٤٤٧٠٠٠٠٠${id.slice(1).padStart(2, "٠")}`, decisionNo: null, court, decisionDateText: null });
}
// جولة المراجعة الثالثة: أحكام كثيرة بمعرّفات بعد أحكام المرجع (فلا تدخل عيّنات ألفاظها).
// «الحوالة» ظاهرة في 230 حكمًا واسم في 5 (سقف العدّ)؛ «البناء» و«النجار» ظاهرتان في 12 حكمًا، واسمٌ مكرر في 60 و110
// حكمًا تتقدّم في الترتيب (نافذة البحث الثابتة وعلم الحد الأدنى).
const bulk = (id: string, court: string, text: string) =>
  rows.push({ ...base, id, sourceId: 1000 + rows.length, createdAt: new Date("2023-11-01"), judgmentTitle: "حكم", judgmentText: text, appealText: null,
    caseNo: `رقم القضية - القرار: ${id}`, decisionNo: null, court, decisionDateText: null });
const COURTS3 = ["المحكمة العامة", "المحكمة التجارية", "المحكمة العمالية"];
const pad3 = (n: number) => String(n).padStart(3, "0");
for (let i = 1; i <= 230; i++) bulk(`z${pad3(i)}`, COURTS3[i % 3], "وحيث إن الحوالة نافذة.");
for (let i = 231; i <= 235; i++) bulk(`z${pad3(i)}`, "المحكمة العامة", "أقام المدعي/ نايف الحوالة دعواه.");
const repeatedName = (w: string) => `حضر المدعي/ سعد ${w} ثم حضر المدعى عليه/ فهد ${w} ثم حضر الشاهد/ خالد ${w}.`;
for (let i = 1; i <= 12; i++) bulk(`y${pad3(i)}`, "المحكمة العامة", "وحيث إن البناء مخالف للترخيص.");
for (let i = 101; i <= 160; i++) bulk(`y${pad3(i)}`, "المحكمة العامة", repeatedName("البناء"));
for (let i = 1; i <= 12; i++) bulk(`x${pad3(i)}`, "المحكمة العامة", "وحيث إن النجار أنجز العمل.");
for (let i = 101; i <= 210; i++) bulk(`x${pad3(i)}`, "المحكمة العامة", repeatedName("النجار"));
// «القصار» مهنة في حكمين واسم في ثالث (لفظ غير ملوّث)، ورقم «77331» يطابق قضية المهنة وقضية الاسم وحدهما.
for (const [id, text, caseNo] of [
  ["w001", "وحيث إن القصار سلّم الثياب متأخرًا.", "٧٧٣٣١٠٠١"],
  ["w002", "أقام المدعي/ فهد القصار دعواه.", "٧٧٣٣١٠٠٢"],
  ["w003", "وحيث إن القصار ضامن لما تلف.", "٨٨٤٤٠٠٠١"],
] as const) {
  bulk(id, "المحكمة العامة", text);
  rows[rows.length - 1].caseNo = `رقم القضية - القرار: ${caseNo}`;
}
const NAME_WORDS = ["غانم", "الموسوي", "زيدان", "الفلاني", "قيصر", "الطاهري", "رجاء", "السندي", "مروان", "هلال"];
const nameLeak = (t: string) => NAME_WORDS.filter((w) => t.includes(w));
const frozen = JSON.stringify(rows);

function setupDb() {
  const values = rows
    .map((r) =>
      `(${[r.id, r.sourceId, r.judgmentTitle, r.judgmentText, r.appealText, r.caseNo, r.decisionNo, r.court, r.cityName, r.decisionDateText, r.source, r.reviewStatus, r.createdAt.toISOString(),
        // search_norm بباني الإنتاج (scripts/backfill-rulings-search-norm.ts) بلا حجب (أسوأ حالة قبل تنظيف #704):
        // المحكمة والعنوان والمتن والاستئناف والرقمان والمدينة.
        normalizeArabicText([r.court, r.judgmentTitle, r.judgmentText.slice(0, 20_000), (r.appealText ?? "").slice(0, 20_000), r.caseNo, r.decisionNo ?? "", r.cityName].filter(Boolean).join("\n"))]
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
// مبادئ مصطنعة لأداة «تخريج الحكم» (takhrij_hukm) في طبقة MCP للوكلاء.
const principles = [
  { id: "p1", title: "مبدأ فسخ عقد التوريد في دعوى المدعي/ زيدان الفلاني", principleText: `إذا أخل المورد بالتسليم جاز الفسخ. ${"ـ نص ".repeat(100)}وقرر المدعي/ غانم الموسوي ذلك أمام الدائرة.`, court: "المحكمة التجارية", topic: "توريد" },
  { id: "p2", title: "مبدأ في الإثبات", principleText: "شهدت الشاهدة/ رجاء السندي بالتسليم، والشهادة وحدها لا تكفي.", court: "المحكمة العامة", topic: "إثبات" },
  // اسم بلا صفة قبل «سجل مدني» يقطعه حد ٦٠٠: القص قبل الحجب يُسقط المرسى فيبقى الاسم.
  { id: "p3", title: "مبدأ في الكفالة", principleText: `${"ـ".repeat(574)} قيصر مروان الطاهري سجل مدني رقم (...) كفيل غارم.`, court: "المحكمة العامة", topic: "كفالة" },
];
const frozenPrinciples = JSON.stringify(principles);
// تعذّر جلب نص الأحكام في البحث، أو استعلام العيّنة (لاختبار السقوط مغلقًا).
let failTextFetch = false;
let failTaint = false;
const fakePrisma = {
  judicialPrinciple: {
    findMany: async ({ where, take }: { where: { OR: Array<Record<string, { contains: string }>> }; take?: number }) =>
      principles
        .filter((p) => where.OR.some((c) => { const [f, op] = Object.entries(c)[0]; return String((p as Record<string, unknown>)[f] ?? "").toLowerCase().includes(op.contains.toLowerCase()); }))
        .slice(0, take ?? 50),
    update: noWrite, create: noWrite, delete: noWrite,
  },
  judicialCase: {
    findMany: async ({ where }: { where: Where }) => {
      if (failTextFetch && where.id?.in) throw new Error("تعذّر الجلب (اختبار)");
      return rows.filter((r) => matches(r, where));
    },
    findUnique: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
    update: noWrite, updateMany: noWrite, create: noWrite, delete: noWrite, deleteMany: noWrite,
  },
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    if (failTaint && /ORDER BY "id" LIMIT 12\) s ON/.test(sql)) throw new Error("تعذّر استعلام العيّنة (اختبار)");
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
  (await import("../lib/mcp/name-taint")).clearTaintCache();
  // أدنى زمن العيّنة يُختبر وحده أدناه، وصفر في بقية الاختبارات.
  (await import("../lib/mcp/name-taint")).setTaintSampleFloorMs(0);
  const before = dbFingerprint();
  const { redactPII, stripPiiFromQuery, splitRulingQuery, searchRulingsDirect, findRulingIdsRedacted } = await import("../lib/modules/legal-core/rulings-search");
  const { searchJudgments, buildJudgmentSnippet } = await import("../lib/modules/legal-core/judgment-search");
  const { enumerateRulings, getRuling, clearEnumerateCountCache } = await import("../lib/mcp/tools/rulings");
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
  // r6: الأجزاء بعد الحجب كما يكشفها المقطِّع في الخام، والأسباب تُجلب.
  const { segmentRuling } = await import("../lib/rulings/research/segment");
  const g6 = (await getRuling("r6", 0, 5000)) as { parts?: Array<{ type: string }> };
  const raw6 = segmentRuling(rows.find((r) => r.id === "r6")!.judgmentText).segments.map((x) => x.type).join(",");
  ok((g6.parts ?? []).map((x) => x.type).join(",") === raw6, `MCP get_ruling: أجزاء r6 بعد الحجب كما في الخام (${raw6})`);
  const r6reasons = (await getRuling("r6", 0, 5000, "reasons")) as { text?: string; error?: string };
  ok(!r6reasons.error && (r6reasons.text ?? "").includes("الأسباب") && nameLeak(r6reasons.text ?? "").length === 0, "MCP get_ruling: جزء الأسباب في r6 يُجلب محجوبًا");
  const s6 = await mcpSearchRulings("مقاولة الباطن", undefined, undefined, 20);
  const s6hit = s6.results.find((x) => x.ruling_id === "r6");
  ok(Boolean(s6hit) && JSON.stringify(s6hit?.parts) === JSON.stringify((g6 as { parts?: unknown }).parts), "MCP search: أجزاء r6 بإزاحات النص المحجوب نفسها في الجلب");
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
  // HKM-012 (متابعة): لا يُعثر على حكم باسم فرد عبر الموصل، ولا يكشف العدد عدد أحكام الاسم.
  ok((await searchRulingsDirect({ query: "زيدان", limit: 20 })).hits.length > 0, "المرجع: المسار الداخلي يجد الحكم بالاسم (الإسقاط في الموصل وحده)");
  for (const q of ["غانم الموسوي", "زيدان", "توريد غانم", "قيصر الطاهري", "رجاء"]) {
    const s = await mcpSearchRulings(q, undefined, undefined, 20);
    ok(s.results.length === 0 && s.total === 0, `MCP search: «${q}» (اسم) لا يعيد حكمًا ولا عددًا (${s.results.length}/${s.total})`);
  }
  type Enum = {
    terms: string[]; total: number; total_is_lower_bound: boolean; by_court: Array<{ court: string | null; count: number }>;
    results?: Array<{ ruling_id: string; snippet: string }>; next_cursor?: string | null; counts_page_only?: boolean;
  };
  for (const q of ["غانم", "الموسوي", "رجاء السندي", "الطاهري"]) {
    const e = (await enumerateRulings([q])) as Enum;
    ok((e.results ?? []).length === 0 && e.total === 0 && e.by_court.length === 0, `MCP enumerate: «${q}» (اسم) لا يعيد حكمًا ولا عددًا ولا توزيعًا`);
    const c = (await enumerateRulings([q], undefined, undefined, true)) as Enum;
    ok(c.total === 0 && c.by_court.length === 0, `MCP enumerate count_only: «${q}» لا يكشف عددًا`);
  }
  // جولة المراجعة الأولى على #785: المؤشر، والعدد بمؤشر بعد الآخر وبالحشو، وأوراكل العضوية، والحشو في البحث.
  const e1 = (await enumerateRulings(["الموسوي"], undefined, undefined, false, 1)) as Enum & { next_cursor: string | null };
  ok((e1.results ?? []).length === 0 && e1.next_cursor === null, `MCP enumerate: اسم بصفحة 1 — لا نتيجة ولا مؤشر (المؤشر=${e1.next_cursor})`);
  let cur: string | undefined;
  const seen: string[] = [];
  let leakedCursor = false;
  for (let g = 0; g < 20; g++) {
    const pg = (await enumerateRulings(["توريد", "الموسوي", "الباطن"], undefined, undefined, false, 1, cur)) as Enum & { next_cursor: string | null };
    const ids = (pg.results ?? []).map((x) => x.ruling_id);
    seen.push(...ids);
    if (pg.next_cursor !== null && !ids.includes(pg.next_cursor)) leakedCursor = true;
    if (!pg.next_cursor) break;
    cur = pg.next_cursor;
  }
  ok(!leakedCursor && seen.every((id) => ["r5", "r6", "r9"].includes(id)) && seen.includes("r5") && seen.includes("r9"), `MCP enumerate: المؤشر دائمًا صف معروض، والترقيم يعيد المرئي فقط (${seen.join("،")})`);
  for (const q of [["الموسوي"], ["غانم", "الفلاني"]]) {
    const past = (await enumerateRulings(q, undefined, undefined, false, 1, "\uffff")) as Enum;
    ok(past.total === 0 && past.by_court.length === 0, `MCP enumerate: مؤشر بعد آخر معرّف لا يكشف عدد «${q.join("+")}»`);
  }
  for (const pad of ["4470000005", "توريد", "إيجار"]) {
    const a = (await enumerateRulings([pad, "الموسوي"], undefined, undefined, true)) as Enum;
    const b = (await enumerateRulings([pad], undefined, undefined, true)) as Enum;
    ok(a.total === b.total && JSON.stringify(a.by_court) === JSON.stringify(b.by_court), `MCP enumerate: الحشو «${pad}» OR اسم = «${pad}» وحده (${a.total}/${b.total})`);
  }
  const o1 = await enumerateRulings(["الموسوي 4470000005"], undefined, undefined, true);
  const o2 = await enumerateRulings(["الموسوي 4470000099"], undefined, undefined, true);
  const o3 = await enumerateRulings(["الموسوي"], "التجارية", 1445, true);
  const o4 = await enumerateRulings(["الموسوي"], "العمالية", 1440, true);
  ok(JSON.stringify(o1).replace(/4470000005/g, "N") === JSON.stringify(o2).replace(/4470000099/g, "N"), "MCP enumerate: اسم + رقم قضية الهدف = اسم + رقم آخر (لا أوراكل)");
  ok(JSON.stringify({ ...o3, filters: null }) === JSON.stringify({ ...o4, filters: null }), "MCP enumerate: اسم + محكمة/سنة الهدف = غيرها (لا أوراكل)");
  const allOut = JSON.stringify([e1, o1, o3, await mcpSearchRulings("الموسوي", undefined, undefined, 20), await mcpSearchRulings("توريد", undefined, undefined, 20)]);
  ok(!allOut.includes("counts_page_only"), "لا علم counts_page_only في أي مخرج (شكل واحد)");
  for (const q of ["غانم شي", "غانم القضا", "الموسوي حكم", "عبد الطاهري", "عبدﷲ الطاهري", "الفلاني", "السندي", "مروان السندي"]) {
    const s = await mcpSearchRulings(q, undefined, undefined, 20);
    ok(s.results.length === 0 && s.total === 0, `MCP search: «${q}» لا يعيد حكمًا ولا عددًا (${s.results.length}/${s.total})`);
  }
  for (const q of ["الموسوي", "السندي", "عبدﷲ الطاهري"]) {
    const e = (await enumerateRulings([q])) as Enum;
    ok((e.results ?? []).length === 0 && e.total === 0, `MCP enumerate: «${q}» (في المتن أو الاستئناف أو التوقيع) لا يعيد حكمًا ولا عددًا`);
  }
  const { lexicalQueryTainted, enumerateTermTainted } = await import("../lib/mcp/name-taint");
  const { checkedLexicalGroups, enumeratePhrase, phraseTsQuery } = await import("../lib/mcp/ruling-privacy");
  const LQ = (t: string) => lexicalQueryTainted(checkedLexicalGroups(t), enumeratePhrase(t));
  ok(await LQ("الموسوي"), "عيّنة الاستعلام: «الموسوي» اسم");
  ok(!(await LQ("توريد")), "عيّنة الاستعلام: «توريد» ليس اسمًا");
  ok(!(await LQ("سونجشانج")), "عيّنة الاستعلام: لفظ غائب ليس اسمًا (عيّنة فارغة)");
  ok(await LQ("حسن") && !(await LQ("حسن النية")), "عيّنة الاستعلام: «حسن» اسم غالبًا، و«حسن النية» عبارة ظاهرة خارج الأسماء");
  const phS = enumeratePhrase("السندي")!;
  ok(
    await enumerateTermTainted({ text: "السندي", numbers: [], sensitive: false, phrase: phS }, `to_tsvector('simple', coalesce(r."search_norm",'')) @@ to_tsquery('simple', $1)`, [phraseTsQuery(phS)]),
    "عيّنة الحصر: «السندي» (في الاستئناف وحده) لفظ اسم",
  );
  // جولة الأمن الثانية: الإجمالي في البحث لا يكشف عدد القاعدة، والعدد الصغير في الحصر من المرئي، والأشكال المعروضة.
  const k1 = await mcpSearchRulings("الخياط", undefined, undefined, 1);
  const k20 = await mcpSearchRulings("الخياط", undefined, undefined, 20);
  ok(k1.total === 1 && k1.total_is_lower_bound === true, `MCP search: limit=1 — الإجمالي عدد ما أُعيد (${k1.total}، ${k1.total_is_lower_bound})`);
  ok(k20.total === 2 && k20.total_is_lower_bound === false && !k20.results.some((x) => x.ruling_id === "r12"), `MCP search: limit=20 — المرئي وحده (${k20.results.map((x) => x.ruling_id).join("،")})`);
  const ek = (await enumerateRulings(["الخياط"])) as Enum;
  ok(ek.total === 2 && !ek.by_court.some((c) => c.court === "المحكمة العمالية"), `MCP enumerate: العدد الصغير من المرئي (${ek.total}، ${ek.by_court.map((c) => c.court).join("،")})`);
  ok((ek.results ?? []).length === 2 && !(ek.results ?? []).some((x) => x.ruling_id === "r12"), "MCP enumerate: صفحة «الخياط» بلا حكم الاسم (فحص كل صف)");
  const ekc = (await enumerateRulings(["الخياط"], "العمالية", undefined, true)) as Enum;
  ok(ekc.total === 0 && ekc.by_court.length === 0, "MCP enumerate: خلية المحكمة التي فيها الاسم وحده = 0");
  const em = (await enumerateRulings(["موس"])) as Enum;
  ok(em.total === 0, "MCP enumerate: لا جزء كلمة («موس» لا تطابق «الموسوي»)");
  const eq = (await enumerateRulings(["؟؟"])) as Enum;
  ok(eq.total === 0 && (eq.results ?? []).length === 0 && eq.terms.length === 0, "MCP enumerate: لفظ بلا كلمة دالّة لا يُحصر");
  const g13 = (await getRuling("r13", 0, 5000)) as { text?: string };
  ok((g13.text ?? "").length > 0 && !/مروان|السندي/.test(g13.text ?? ""), "MCP get_ruling: اسم بالأشكال المعروضة محجوب (NFKC)");
  for (const q of ["ﻣﺮﻭﺍﻥ ﺍﻟﺴﻨﺪﻱ", "ﺍﻟﺴﻨﺪﻱ"]) {
    const sp = await mcpSearchRulings(q, undefined, undefined, 20);
    const ep = (await enumerateRulings([q])) as Enum;
    ok(sp.results.length === 0 && sp.total === 0 && ep.total === 0, `MCP: استعلام بالأشكال المعروضة «${q}» لا يعيد حكمًا ولا عددًا`);
  }
  const sN = await mcpSearchRulings("حسن النية", undefined, undefined, 20);
  ok(sN.results.map((x) => x.ruling_id).sort().join(",") === "r14,r15", `MCP search: «حسن النية» يجد العبارة ولا يجد أحكام الاسم (${sN.results.map((x) => x.ruling_id).join("،")})`);
  const sHs = await mcpSearchRulings("حسن", undefined, undefined, 20);
  ok(sHs.results.length === 0 && sHs.total === 0, "MCP search: «حسن» وحده اسم غالبًا فلا يطابق شيئًا");
  const sH = await mcpSearchRulings("سالم", undefined, undefined, 20);
  ok(sH.results.length === 0 && sH.total === 0, `MCP search: لفظ يطابق داخل الأسماء غالبًا («سالم») لا يطابق شيئًا ولو ورد كلمةً عامة في حكم آخر (${sH.results.length}/${sH.total})`);
  const s7 = await mcpSearchRulings("أجرة متأخرة", undefined, undefined, 20);
  ok(s7.results.some((x) => x.ruling_id === "r7"), "MCP search: لفظ عام في حكم اسمه في الاستئناف يجده");
  const s8 = await mcpSearchRulings("تصفية الشراكة", undefined, undefined, 20);
  const s8hit = s8.results.find((x) => x.ruling_id === "r8");
  ok(Boolean(s8hit) && nameLeak(`${s8hit?.snippet ?? ""} ${s8hit?.disposition ?? ""}`).length === 0, "MCP search: توقيع الدائرة بـ«ﷲ» محجوب في المقتطف والمنطوق");
  const { clearTaintCache, taintedBySample } = await import("../lib/mcp/name-taint");
  ok(taintedBySample([1, 2], (x) => x === 1) && !taintedBySample([1, 2, 3], (x) => x !== 3) && !taintedBySample([], () => false), "عتبة العيّنة: النصف فأكثر لفظ اسم، والثلث لا، والفارغة لا");
  clearTaintCache();
  failTaint = true;
  const sft = await mcpSearchRulings("توريد", undefined, undefined, 20);
  let eft = false;
  try {
    await enumerateRulings(["توريد"]);
  } catch {
    eft = true;
  }
  failTaint = false;
  clearTaintCache();
  ok(sft.results.length === 0 && sft.total === 0 && eft, "تعذّر استعلام العيّنة: البحث بلا نتيجة، والحصر خطأ (السقوط مغلقًا)");
  failTextFetch = true;
  const sf = await mcpSearchRulings("توريد", undefined, undefined, 20);
  failTextFetch = false;
  ok(sf.results.length === 0, "MCP search: تعذّر جلب النص = لا نتيجة (السقوط مغلقًا)");
  const cIgn = (await enumerateRulings(["توريد"], undefined, undefined, true, 50, "\uffff")) as Enum;
  const cNo = (await enumerateRulings(["توريد"], undefined, undefined, true)) as Enum;
  ok(cIgn.total === cNo.total && cNo.total >= 1, "MCP enumerate count_only: المؤشر لا يغيّر العدد");
  const mixE = (await enumerateRulings(["غانم", "توريد"])) as Enum;
  ok((mixE.results ?? []).some((x) => x.ruling_id === "r5") && (mixE.results ?? []).every((x) => nameLeak(x.snippet).length === 0), "MCP enumerate: اسم مع لفظ عام (OR) — الحكم يبقى بلفظه العام محجوبًا");
  const keepS = await mcpSearchRulings("توريد", undefined, undefined, 20);
  ok(keepS.results.some((x) => x.ruling_id === "r5") && !("counts_page_only" in keepS) && keepS.total >= 1, "MCP search: اللفظ العام يجد الحكم بعدد القاعدة كما كان");
  const keepE = (await enumerateRulings(["توريد"], undefined, undefined, true)) as Enum;
  ok(keepE.total >= 1 && keepE.counts_page_only === undefined, "MCP enumerate count_only: اللفظ العام بعدد القاعدة كما كان");
  // السنة الهجرية: التاريخ مخزَّن بالأرقام الهندية، فالمرشح اللاتيني يطابقه.
  const y45 = (await enumerateRulings(["إيجار"], undefined, 1445)) as Enum;
  ok((y45.results ?? []).some((x) => x.ruling_id === "r1"), "MCP enumerate: year_h=1445 يجد حكمًا تاريخه «١٤٤٥/…»");
  const y44 = (await enumerateRulings(["إيجار"], undefined, 1444, true)) as Enum;
  ok(y44.total === 0, "MCP enumerate: year_h=1444 لا يجده");
  // ── جولة المراجعة الثالثة على #785 ──
  // ع١: العدد والتوزيع للفظ فيه حرف من الأحكام الظاهرة وحدها (مسقوفًا)، فلا فرق بينه وبين ما تعيده الصفحات،
  // ولا يكشف الحشو بـ OR ولا الشمول والاستبعاد عدد ما لا يطابق إلا داخل اسم.
  const gather = async (terms: string[], size = 2) => {
    const ids: string[] = [];
    let cur: string | undefined;
    for (let g = 0; g < 400; g++) {
      const pg = (await enumerateRulings(terms, undefined, undefined, false, size, cur)) as Enum;
      ids.push(...(pg.results ?? []).map((x) => x.ruling_id));
      if (!pg.next_cursor) break;
      cur = pg.next_cursor;
    }
    return ids;
  };
  const cnt = async (terms: string[], court?: string) => (await enumerateRulings(terms, court, undefined, true)) as Enum;
  const nA = await cnt(["النجار"]);
  const gA = await gather(["النجار"]);
  ok(nA.total === 12 && !nA.total_is_lower_bound && gA.length === 12 && gA.every((id) => id < "x100"), `ع١: «النجار» (12 ظاهرًا و110 اسمًا) — العدد = الصفحات (${nA.total}/${gA.length})`);
  const nP = await cnt(["الحوالة"]);
  const nAP = await cnt(["النجار", "الحوالة"]);
  ok(nP.total === 200 && nP.total_is_lower_bound && nAP.total === 200 && nAP.total_is_lower_bound, `ع١: الحشو فوق السقف — ${nAP.total}/${nP.total}، حد أدنى (لا فرق يكشف المسقط)`);
  ok(nP.by_court.reduce((a, c) => a + c.count, 0) === 200, "ع١: التوزيع من الظاهر نفسه (مجموعه = العدد)");
  const gP = await gather(["الحوالة"], 100);
  ok(gP.length === 230 && new Set(gP).size === 230 && !gP.some((id) => id > "z230"), `ع١: الصفحات بلا سقف — 230 ظاهرًا، ولا حكم اسم (${gP.length})`);
  const nK = await cnt(["الخياط"]);
  const nM = await cnt(["منطوق"]);
  const nKM = await cnt(["الخياط", "منطوق"]);
  const gK = await gather(["الخياط"]);
  const gM = await gather(["منطوق"]);
  const inter = gK.filter((id) => gM.includes(id)).length;
  ok(nK.total + nM.total - nKM.total === inter && nM.total === gM.length && nKM.total === new Set([...gK, ...gM]).size, `ع١: الشمول والاستبعاد = تقاطع الظاهر (${nK.total}+${nM.total}−${nKM.total}=${inter})`);
  ok((await cnt(["النجار"], "العامة")).total === 12, "ع١: مرشح المحكمة لا يكشف المسقط");
  // ع٢: لا عودة مبكرة — عدد الاستعلامات والمخرج واحد للفظ الاسم والغائب، في أول نداء وبعد الحفظ.
  const qn = async <T>(fn: () => Promise<T>) => {
    const n = sqlLog.length;
    const out = await fn();
    return { n: sqlLog.length - n, out };
  };
  for (const countOnly of [true, false]) {
    const res: Array<{ first: number; second: number; out: string }> = [];
    for (const v of [["الموسوي 4470000005"], ["الموسوي 4470000099"], ["القرشي 4470000005"], ["غانم الموسوي"], ["غانم القرشي"]]) {
      clearTaintCache();
      clearEnumerateCountCache();
      const a = await qn(() => enumerateRulings(v, undefined, undefined, countOnly));
      const b = await qn(() => enumerateRulings(v, undefined, undefined, countOnly));
      res.push({ first: a.n, second: b.n, out: JSON.stringify({ ...a.out, terms: null }) });
    }
    ok(res.every((r) => r.first === res[0].first && r.second === res[0].second && r.out === res[0].out), `ع٢: الحصر${countOnly ? " (count_only)" : ""} — الاسم والغائب بعدد استعلامات واحد (${res.map((r) => `${r.first}/${r.second}`).join(" ")})`);
  }
  for (const group of [["غانم الموسوي", "زيدان الفلاني", "غانم القرشي"], ["الموسوي", "القرشي"]]) {
    const res: Array<{ first: number; second: number; out: string }> = [];
    for (const q of group) {
      clearTaintCache();
      const a = await qn(() => mcpSearchRulings(q, undefined, undefined, 20));
      const b = await qn(() => mcpSearchRulings(q, undefined, undefined, 20));
      res.push({ first: a.n, second: b.n, out: JSON.stringify({ ...a.out, query: null }) });
    }
    ok(res.every((r) => r.first === res[0].first && r.second === res[0].second && r.out === res[0].out), `ع٢: البحث «${group.join("» و«")}» بعدد استعلامات واحد (${res.map((r) => `${r.first}/${r.second}`).join(" ")})`);
  }
  // أدنى زمن العيّنة: لفظ الاسم (عيّنته تُحجب) والغائب (عيّنته فارغة) في أول نداء.
  const { setTaintSampleFloorMs } = await import("../lib/mcp/name-taint");
  setTaintSampleFloorMs(250);
  const timed: number[] = [];
  for (const v of ["غانم الموسوي", "غانم القرشي"]) {
    clearTaintCache();
    clearEnumerateCountCache();
    const t0 = performance.now();
    await enumerateRulings([v], undefined, undefined, true);
    timed.push(performance.now() - t0);
  }
  setTaintSampleFloorMs(0);
  ok(timed.every((t) => t >= 245), `أدنى زمن العيّنة: الاسم والغائب ≥ 250ms (${timed.map((t) => t.toFixed(0)).join("/")})`);
  // التوازي: النداءان المتزامنان على اللفظ نفسه يحسبان عيّنة واحدة.
  clearTaintCache();
  const dd2 = await qn(() => Promise.all([LQ("توريد"), LQ("توريد")]));
  ok(dd2.n === 1 && dd2.out.every((x) => !x), `التوازي: عيّنة واحدة لنداءين متزامنين (${dd2.n})`);
  // م١: نافذة البحث ثابتة لا تتبع limit؛ و«حد أدنى» إن انتهت النافذة ومرشحوها باقون.
  const b1 = await mcpSearchRulings("البناء", undefined, undefined, 1);
  const b20 = await mcpSearchRulings("البناء", undefined, undefined, 20);
  ok(b1.results.length === 1 && b20.results.length === 12 && !b20.total_is_lower_bound && [...b1.results, ...b20.results].every((x) => x.ruling_id < "y100"), `م١: «البناء» (60 اسمًا تتقدّم الترتيب) — limit=1 يعيد ${b1.results.length}، وlimit=20 يعيد ${b20.results.length}`);
  for (const lim of [1, 20]) {
    const n = await mcpSearchRulings("النجار", undefined, undefined, lim);
    ok(n.results.length === 0 && n.total === 0 && n.total_is_lower_bound === true, `م١: «النجار» limit=${lim} — النافذة (100) أسماء كلها: لا نتيجة، والعلم true (${n.total_is_lower_bound})`);
  }
  // ن١: لا صفحة أخيرة فارغة — المتابعة إن وُجد بعد آخر صف معروض صف ظاهر.
  const k2 = (await enumerateRulings(["الخياط"], undefined, undefined, false, 2)) as Enum;
  ok((k2.results ?? []).length === 2 && k2.next_cursor === null, `ن١: «الخياط» بصفحة 2 — بعد الصفين حكم اسم فقط، فلا مؤشر (${k2.next_cursor})`);
  const k1p = (await enumerateRulings(["الخياط"], undefined, undefined, false, 1)) as Enum;
  ok((k1p.results ?? []).length === 1 && k1p.next_cursor === (k1p.results ?? [])[0]?.ruling_id, "ن١: صفحة 1 وبعدها ظاهر — المؤشر آخر صف معروض");
  // عيّنة لفظ الحصر من نصه وحده: رقمٌ في اللفظ لا يوجّهها إلى قضية بعينها (كانت «القصار 77331» تُعدّ اسمًا بعيّنة الرقم).
  const qs1 = (await enumerateRulings(["القصار 77331"])) as Enum;
  ok(qs1.total === 1 && (qs1.results ?? []).map((x) => x.ruling_id).join() === "w001", `عيّنة الحصر من النص وحده: «القصار 77331» يجد حكم المهنة لا حكم الاسم (${(qs1.results ?? []).map((x) => x.ruling_id).join("،")})`);
  // بوابة التلوث في الحصر: لفظ اسم غالبًا لا يُحصر ولو ظهر كلمةً عامة في حكم آخر (r9 «سالم من العيوب»، وr14/r15 «حسن النية»).
  for (const q of ["سالم", "حسن"]) {
    const e = (await enumerateRulings([q])) as Enum;
    ok(e.total === 0 && (e.results ?? []).length === 0, `بوابة التلوث: الحصر بـ«${q}» لا يعيد حكمًا ولا عددًا (${e.total})`);
  }
  // تخريج الحكم (takhrij_hukm): العنوان ونص المبدأ محجوبان، والمطابقة داخل اسم وحدها لا تُعاد.
  const { takhrijHukm } = await import("../lib/agent-runtime/live/engine-tools");
  const pNames = ["غانم", "الموسوي", "زيدان", "الفلاني", "رجاء", "السندي"];
  const pLeak = (t: string) => pNames.filter((w) => t.includes(w));
  for (const q of ["غانم", "رجاء السندي", "الفلاني"]) {
    const t = await takhrijHukm(q);
    ok(t.principles.length === 0, `takhrij_hukm: «${q}» (اسم) لا يعيد مبدأ`);
  }
  const tf = await takhrijHukm("الفسخ");
  ok(tf.principles.length === 1 && pLeak(`${tf.principles[0].title} ${tf.principles[0].principle}`).length === 0 && tf.principles[0].title.includes("[اسم]"), `takhrij_hukm: «الفسخ» يعيد المبدأ وعنوانه ونصه بلا اسم (${pLeak(JSON.stringify(tf.principles)).join("،") || "لا تسرّب"})`);
  ok(tf.principles.every((p) => p.principle.length <= 640), "takhrij_hukm: نص المبدأ مقصوص بعد الحجب (≈٦٠٠ حرف)");
  const tk = await takhrijHukm("الكفالة");
  ok(tk.principles.length === 1 && pLeak(tk.principles[0].principle).length === 0 && !/قيصر|مروان|الطاهري/.test(tk.principles[0].principle), "takhrij_hukm: اسم قبل مرسى يقطعه حد ٦٠٠ محجوب (الحجب قبل القص)");
  const t2 = await takhrijHukm("الفلاني الإثبات", 1);
  ok(t2.principles.length === 1 && t2.principles[0].title === "مبدأ في الإثبات", "takhrij_hukm: جلب ضعف المطلوب — المبدأ الأول المطابق داخل اسم لا يحجب الثاني");
  const tw = await takhrijHukm("الشهادة");
  ok(tw.principles.length === 1 && pLeak(tw.principles[0].principle).length === 0, "takhrij_hukm: «الشهادة» يعيد المبدأ بلا اسم الشاهدة");
  ok(JSON.stringify(principles) === frozenPrinciples, "المبادئ الأصلية في الذاكرة كما هي");

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
