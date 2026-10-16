/**
 * 02-segment-v4 — مقارنة التقطيع v3 بـ v4 على كل judicial_cases، قراءة فقط، أعداد ونسب فقط.
 *
 * • الاتصال من DATABASE_URL (رابط مباشر بـ options=-c default_transaction_read_only=on)، ويتوقف التشغيل
 *   ما لم تُرجع SHOW transaction_read_only القيمة on. لا كتابة في أي جدول.
 * • تصفّح بالمعرّف ٥٠٠ في الدفعة. لا يُطبع ولا يُودَع نص حكم ولا معرّف ولا رابط اتصال.
 * • المخرج: reports/rulings-research/02-segment-v4.data.json وسطر ملخص أخير على stdout.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { stripTatweel } from "../../lib/rulings/research/anchors";
import {
  checkStructure, isProceduralDecision, segmentRuling, SEGMENT_EXTRACTOR_VERSION, type Segmentation,
} from "../../lib/rulings/research/segment";
import { segmentRulingV3, SEGMENT_V3_VERSION } from "./segment-v3-baseline";

const OUT = process.argv[2] ?? path.join(process.cwd(), "reports/rulings-research/02-segment-v4.data.json");
const BATCH = 500;
const PARTS = ["claims", "defense", "reasons", "disposition", "appeal", "other"] as const;

const A = "[اأإآ]";
const H = "[ةه]";
const Y = "[يى]";
/**
 * صيغ مرشحة لبداية الدعوى (تشخيص فقط، لا تدخل التقطيع): لكل صيغة عدد الأحكام ذات الديباجة الكبيرة
 * التي ترد فيها داخل الديباجة ووسيط موضع أول ظهور (نسبة من طول النص)، وعدد الأحكام الأخرى التي
 * يسبق فيها ظهورُها بدايةَ الدعوى في v4 (أي ستتحرك لو اعتُمدت).
 */
const CANDIDATES: Record<string, RegExp> = {
  "وفي الجلسة المنعقدة": new RegExp(`وف${Y}\\s+(?:ال)?جلس${H}\\s+(?:ال)?منعقد${H}`, "u"),
  "حيث تقدم": /حيث\s+تقدم/u,
  "تقدم/أقام … المدعي (≤٣ كلمات)": new RegExp(`(?:تقدم|تقدمت|${A}قام|${A}قامت)\\s+(?:\\S+\\s+){1,3}?(?:ال)?مدع${Y}`, "u"),
  "فعل … دعواه": new RegExp(`(?:${A}قام|${A}قامت|رفع|رفعت|قيد|قيدت|تقدم|تقدمت|قدم|قدمت)\\s+(?:\\S+\\s+){0,3}?(?:ب)?دعوا(?:ه|ها|هم)`, "u"),
  "ادعى/ادعت": new RegExp(`ادع(?:${Y}|ت)\\s`, "u"),
  "صحيفة/لائحة دعوى": new RegExp(`(?:صحيف${H}|لائح${H})\\s+(?:ال)?دعو${Y}`, "u"),
  "وقائع الدعوى/القضية": new RegExp(`وقائع\\s+(?:هذه\\s+)?(?:ال)?(?:دعو${Y}|قضي${H})`, "u"),
  "وقائع (أي سياق)": /وقائع/u,
  "ملخص الدعوى/الوقائع": new RegExp(`ملخص\\s+(?:ال)?(?:دعو${Y}|وقائع|قضي${H})`, "u"),
  "افتتحت/عقدت الجلسة": new RegExp(`(?:افتتحت|عقدت|انعقدت)\\s+(?:ال)?جلس${H}`, "u"),
  "حضر … المدعي (≤٤ كلمات)": new RegExp(`حضر\\s+(?:\\S+\\s+){0,4}?(?:ال)?مدع${Y}`, "u"),
  "المدعي … يطلب": new RegExp(`(?:ال)?مدع${Y}\\S*\\s+(?:\\S+\\s+){0,3}?(?:يطلب|تطلب|طالب|يطالب|تطالب)`, "u"),
  "طلب(ات) المدعي": new RegExp(`طلب(?:ات)?\\s+(?:ال)?مدع${Y}`, "u"),
};
const BIG_HEADER = 0.25;
/**
 * أمثلة الفحص الحي، مُعرَّفة ببصمة sha256 (أول ١٦ حرفًا) لمعرّف الحكم — لا يُودَع المعرّف نفسه.
 * يُبلَّغ عنها بالترتيب (#1…) وبأطوال الأجزاء فقط.
 */
const EXAMPLE_HASHES = [
  "78463455b44cdea9", "e2b861865ca16603", "a1fadbbcd5ebea4d", "690594b0e44fb361", "23f69ddd4f7c1baa",
  "a2c5f7943e8ecd5c", "24989c171d31b362", "20a01c0e92624a03", "8008832d9435be39",
];
const idHash = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 16);
const lengths = (s: Segmentation) => Object.fromEntries(s.segments.map((x) => [x.type, x.end - x.start]));

function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Number(s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))].toFixed(4));
}

function tally() {
  return {
    found: Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<string, number>,
    ruleOnly: 0,
    structureOk: 0,
    dispProcedural: 0,
    headerShares: [] as number[],
    bigHeader: 0,
    reasonsUnder100: 0,
    dispositionOver5k: 0,
    headerOver5k: 0,
    otherOver5k: 0,
  };
}

const startOf = (s: Segmentation, t: string) => s.segments.find((x) => x.type === t)?.start ?? null;

function account(t: ReturnType<typeof tally>, s: Segmentation, original: string) {
  for (const p of PARTS) if (s.found[p]) t.found[p]++;
  if (!s.needsModel) t.ruleOnly++;
  const st = checkStructure(s, original.length);
  if (st.contiguous && st.ordered) t.structureOk++;
  const d = startOf(s, "disposition");
  if (d !== null) {
    // هل يبدأ المنطوق بقرار إجرائي («قررت الدائرة تأجيل…»)؟ يُفحص على النص المنقّى من الكشيدة.
    if (isProceduralDecision(stripTatweel(original.slice(d, d + 400)).text, 0)) t.dispProcedural++;
  }
  const h = s.segments[0]?.type === "header" ? s.segments[0].end / Math.max(1, original.length) : 0;
  t.headerShares.push(h);
  if (h > BIG_HEADER) t.bigHeader++;
  const len = lengths(s);
  if (len.reasons !== undefined && len.reasons < 100) t.reasonsUnder100++;
  if ((len.disposition ?? 0) > 5000) t.dispositionOver5k++;
  if ((len.header ?? 0) > 5000) t.headerOver5k++;
  if ((len.other ?? 0) > 5000) t.otherOver5k++;
}

const pct = (x: number, n: number) => Number(((100 * x) / Math.max(1, n)).toFixed(2));

function summarize(t: ReturnType<typeof tally>, n: number) {
  return {
    foundPct: Object.fromEntries(Object.entries(t.found).map(([k, v]) => [k, pct(v, n)])),
    ruleOnlyPct: pct(t.ruleOnly, n),
    structurePct: pct(t.structureOk, n),
    dispositionProcedural: t.dispProcedural,
    headerShare: { median: quantile(t.headerShares, 0.5), p90: quantile(t.headerShares, 0.9), p99: quantile(t.headerShares, 0.99) },
    headerOver25: t.bigHeader,
    reasonsUnder100: t.reasonsUnder100,
    dispositionOver5k: t.dispositionOver5k,
    headerOver5k: t.headerOver5k,
    otherOver5k: t.otherOver5k,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("لا يوجد DATABASE_URL — أوقفتُ التشغيل.");
    process.exit(2);
  }
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
  try {
    const [ro] = await prisma.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
    if (ro?.transaction_read_only !== "on") {
      console.error("الجلسة ليست للقراءة فقط — أوقفتُ التشغيل.");
      process.exit(3);
    }
    console.log("🔒 transaction_read_only=on");

    const v3 = tally();
    const v4 = tally();
    let n = 0;
    let empty = 0;
    let anyChanged = 0;
    let dispChanged = 0;
    let dispLost = 0;
    let dispGained = 0;
    let reasonsChanged = 0;
    let reasonsEarlier = 0;
    let fallbackClaims = 0;
    let claimsChanged = 0;
    let headerShrunk = 0;
    let headerGrew = 0;
    let v4StructureBroken = 0;
    const candPos = Object.fromEntries(Object.keys(CANDIDATES).map((k) => [k, [] as number[]])) as Record<string, number[]>;
    const candMoves = Object.fromEntries(Object.keys(CANDIDATES).map((k) => [k, 0])) as Record<string, number>;
    let bigHeaderV4 = 0;
    let bigHeaderNoClaims = 0;
    const examples: Record<string, { length: number; v3: Record<string, number>; v4: Record<string, number> }> = {};
    let last = "";
    for (;;) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; text: string | null }>>(
        `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last);
      if (!rows.length) break;
      last = rows[rows.length - 1].id;
      for (const r of rows) {
        const text = r.text ?? "";
        n++;
        if (!text.trim()) empty++;
        const a = segmentRulingV3(text);
        const b = segmentRuling(text);
        account(v3, a, text);
        account(v4, b, text);
        const ex = EXAMPLE_HASHES.indexOf(idHash(r.id));
        if (ex >= 0) examples[`#${ex + 1}`] = { length: text.length, v3: lengths(a), v4: lengths(b) };
        const st = checkStructure(b, text.length);
        if (text.length && !(st.contiguous && st.ordered)) v4StructureBroken++;
        const key = (s: Segmentation) => s.segments.map((x) => `${x.type}:${x.start}-${x.end}`).join("|");
        if (key(a) !== key(b)) anyChanged++;
        if (startOf(a, "disposition") !== startOf(b, "disposition")) dispChanged++;
        if (a.found.disposition && !b.found.disposition) dispLost++;
        if (!a.found.disposition && b.found.disposition) dispGained++;
        if (startOf(a, "reasons") !== startOf(b, "reasons")) reasonsChanged++;
        const ra = startOf(a, "reasons");
        const rb = startOf(b, "reasons");
        if (ra !== null && rb !== null && rb < ra) reasonsEarlier++;
        if (b.segments.some((x) => x.type === "claims" && x.confidence < 0.8)) fallbackClaims++;
        if (startOf(a, "claims") !== startOf(b, "claims")) claimsChanged++;
        const ha = a.segments[0]?.end ?? 0;
        const hb = b.segments[0]?.end ?? 0;
        if (hb < ha) headerShrunk++;
        if (hb > ha) headerGrew++;
        // تشخيص الديباجة الكبيرة في v4: أي الصيغ المرشحة ترد داخلها وأين.
        if (text.length && b.segments[0]) {
          const big = hb / text.length > BIG_HEADER;
          if (big) {
            bigHeaderV4++;
            if (!b.found.claims) bigHeaderNoClaims++;
          }
          const head = stripTatweel(text.slice(0, hb)).text;
          for (const [k, re] of Object.entries(CANDIDATES)) {
            const m = re.exec(head);
            if (!m) continue;
            if (big) candPos[k].push(m.index / text.length);
            else candMoves[k]++;
          }
        }
      }
      process.stdout.write(`\r… ${n}`);
    }
    process.stdout.write("\n");

    const data = {
      measuredAt: new Date().toISOString(),
      mode: "read-only (transaction_read_only=on)",
      versions: { before: SEGMENT_V3_VERSION, after: SEGMENT_EXTRACTOR_VERSION },
      rulings: n,
      emptyText: empty,
      v3: summarize(v3, n),
      v4: summarize(v4, n),
      changes: {
        anySegmentChanged: anyChanged,
        dispositionChanged: dispChanged,
        dispositionLost: dispLost,
        dispositionGained: dispGained,
        reasonsStartChanged: reasonsChanged,
        reasonsStartEarlier: reasonsEarlier,
        claimsFromFallback: fallbackClaims,
        claimsStartChanged: claimsChanged,
        headerShrunk,
        headerGrew,
        v4StructureBroken,
      },
      liveQaExamples: { found: Object.keys(examples).length, of: EXAMPLE_HASHES.length, partLengths: examples },
      bigHeaderDiagnostics: {
        threshold: BIG_HEADER,
        rulings: bigHeaderV4,
        withoutClaims: bigHeaderNoClaims,
        candidates: Object.fromEntries(Object.keys(CANDIDATES).map((k) => [k, {
          inBigHeader: candPos[k].length, medianFirstShare: quantile(candPos[k], 0.5), earlierThanClaimsElsewhere: candMoves[k],
        }])),
      },
    };
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
    console.log(JSON.stringify(data));
    const s3 = data.v3;
    const s4 = data.v4;
    console.log(
      `n=${n} rule-only ${s3.ruleOnlyPct}%→${s4.ruleOnlyPct}% structure ${s3.structurePct}%→${s4.structurePct}% ` +
      `disp found ${s3.foundPct.disposition}%→${s4.foundPct.disposition}% procedural-disp ${s3.dispositionProcedural}→${s4.dispositionProcedural} ` +
      `disp changed ${dispChanged} (lost ${dispLost}) header median ${s3.headerShare.median}→${s4.headerShare.median} ` +
      `header>25% ${s3.headerOver25}→${s4.headerOver25} header>5k ${s3.headerOver5k}→${s4.headerOver5k} ` +
      `disp>5k ${s3.dispositionOver5k}→${s4.dispositionOver5k} reasons<100 ${s3.reasonsUnder100}→${s4.reasonsUnder100} segments changed ${anyChanged}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("فشل:", (e as Error).message.replace(/postgres(?:ql)?:\/\/\S+/g, "[url]"));
  process.exitCode = 1;
});
