/**
 * rulings-search — مسار بحث مستقلّ للأحكام القضائية (البند 1.7 من خطة الإصلاح).
 *
 * يستعلم من judicial_cases مباشرةً، ولا يمرّ بدمج المواد/الأنظمة إطلاقًا.
 *   • تطبيع عربيّ + أرقام هندية (على الاستعلام وعلى العمود وقت البحث).
 *   • فلاتر المحكمة والسنة الهجرية (تُستخرج من نصّ التاريخ الهجريّ).
 *   • حجب PDPL: تُنقّى أرقام الهوية/الإقامة والجوال من المقتطف قبل الإرجاع، ولا تُسجَّل.
 *
 * الأداء: يفضّل عمود search_norm المفهرس إن وُجد؛ وإلّا يسقط إلى تطبيع فوريّ
 * صالح للقراءة بلا فهرس (أبطأ).
 */
import { prisma } from "@/lib/prisma";
import { normalizeArabic } from "./bm25-tokenizer";
import { buildRulingExcerpts, buildRulingTsQuery, findMatches, queryTokens, type RulingPart } from "./ruling-excerpts";
import type { SegmentType } from "@/lib/rulings/research/segment";
import type { MergedResult } from "@/lib/modules/legal-search/hybrid-search";

export interface RulingHit {
  id: string;
  decisionNo: string | null;
  caseNo: string | null;
  court: string | null;
  cityName: string | null;
  dateText: string | null;
  hijriYear: number | null;
  title: string | null;
  snippet: string; // منقّى من PDPL — من موضع المطابقة في الأسباب أولًا، لا من الديباجة
  matchedIn: SegmentType | null; // الجزء الذي أُخذ منه المقتطف
  disposition: string | null; // بداية المنطوق (منقّاة)
  parts: RulingPart[]; // خريطة أجزاء الحكم بإزاحاتها
  score: number; // 0..1 نسبة الألفاظ المتطابقة (+ حافز موضع المطابقة)
}

const PII_DIGIT = "[0-9\\u0660-\\u0669]";
const PII_GAP = "[\\s\\u00a0\\u200c]*";

/** يحمي أرقام المواد والصكوك والتواريخ من الحجب ثم يعيدها. */
function shieldLegalNumbers(text: string): { text: string; restore: (s: string) => string } {
  const held: string[] = [];
  const keep = (chunk: string) => {
    const token = `\u0000H${held.length}\u0000`;
    held.push(chunk);
    return token;
  };
  let src = text;
  src = src.replace(new RegExp(`${PII_DIGIT}{1,2}${PII_GAP}[\\/\\-]${PII_GAP}${PII_DIGIT}{1,2}${PII_GAP}[\\/\\-]${PII_GAP}${PII_DIGIT}{3,4}`, "g"), keep);
  src = src.replace(new RegExp(`(?:المادة|مادة|صك|صكوك)\\s*\\(?\\s*${PII_DIGIT}(?:${PII_GAP}${PII_DIGIT}){0,12}\\s*\\)?`, "g"), keep);
  return {
    text: src,
    restore: (s) => s.replace(/\u0000H(\d+)\u0000/g, (_, i) => held[Number(i)] ?? ""),
  };
}

/** حجب الهوية والجوال والآيبان والبريد في طبقة العرض. النص الأصلي في القاعدة لا يُمس. */
export function redactPII(text: string): string {
  if (!text) return "";
  const src = String(text).replace(/\u0640/g, "");
  const shielded = shieldLegalNumbers(src);
  const digit = PII_DIGIT;
  const gap = PII_GAP;
  const notDigit = `(?<!${digit})`;
  const notDigitAfter = `(?!${digit})`;
  const redacted = shielded.text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[بريد محجوب]")
    .replace(new RegExp(`${notDigit}[12\\u0661\\u0662](?:${gap}${digit}){9}${notDigitAfter}`, "g"), "•••••••••• [هوية محجوبة]")
    .replace(new RegExp(`(?:\\+?966|00966)?${gap}[0\\u0660]${gap}[5\\u0665](?:${gap}${digit}){8}${notDigitAfter}`, "g"), "[جوال محجوب]")
    .replace(new RegExp(`\\bSA(?:${gap}${digit}){22}\\b`, "gi"), "[آيبان محجوب]");
  return shielded.restore(redacted);
}

/**
 * نص فهرس الأحكام: حجب ثم تطبيع ثم حجب ثانٍ.
 * التطبيع يحوّل الأرقام الهندية ويزيل الفواصل، فيُظهر أرقاماً لم يطابقها الحجب الأول.
 */
export function buildRulingSearchNorm(title: string | null | undefined, text: string | null | undefined): string {
  const raw = `${title ?? ""} ${text ?? ""}`;
  return redactPII(normalizeArabic(redactPII(raw)));
}

/** استخراج السنة الهجرية (1300..1500) من نصّ تاريخ عربيّ (أرقام هندية أو لاتينية). */
export function extractHijriYear(dateText: string | null | undefined): number | null {
  const norm = normalizeArabic(String(dateText ?? ""));
  for (const m of norm.matchAll(/\b(1[34]\d{2})\b/g)) {
    const y = Number(m[1]);
    if (y >= 1300 && y <= 1500) return y;
  }
  return null;
}

/** تعبير SQL يطبّع نصّ عمود عربيّ (يوافق normalizeArabic في JS تقريبًا). */
function sqlNormalize(col: string): string {
  // إزالة التشكيل والتطويل والهمزة المفردة، ثم توحيد الحروف والأرقام الهندية.
  return `lower(translate(regexp_replace(coalesce(${col},''), '[\\u064B-\\u0652\\u0640\\u0621]', '', 'g'),
    'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩', 'اااايهوي0123456789'))`;
}

export interface RulingSearchOptions {
  query: string;
  court?: string;
  yearH?: number;
  limit?: number;
  offset?: number;
}

// كشف وجود عمود search_norm المفهرس (يُخزَّن مرّة). عند وجوده نستخدم المسار المفهرس السريع؛
// وإلّا نطبّع فوريًّا (صالح للقراءة بلا فهرس، أبطأ) — الفهرس يُطبَّق عبر هجرة على Neon branch.
let _hasSearchNorm: boolean | null = null;
async function hasSearchNormColumn(): Promise<boolean> {
  if (_hasSearchNorm !== null) return _hasSearchNorm;
  const r = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint c FROM information_schema.columns WHERE table_name='judicial_cases' AND column_name='search_norm'`,
  ).catch(() => [{ c: BigInt(0) }]);
  _hasSearchNorm = Number(r?.[0]?.c ?? 0) > 0;
  return _hasSearchNorm;
}

// الألفاظ الشائعة («مدعي»، «عقد») تطابق عشرات الآلاف: العدّ الدقيق وحساب الترتيب عليها كلها
// تجاوزا مهلة MCP (٣٢ ثانية لـ«مدعي»). فالعدّ مسقوف، والترتيب على مرشحين محدودين، والاستعلامان متوازيان.
const COUNT_CAP = 5000;
const RANK_CANDIDATES = 400;

export async function searchRulingsDirect(opts: RulingSearchOptions): Promise<{ hits: RulingHit[]; total: number; totalCapped: boolean; ms: number }> {
  const started = Date.now();
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const tokens = normalizeArabic(opts.query).split(/\s+/).filter((t) => t.length >= 2);
  const rawTokens = queryTokens(opts.query);
  if (!tokens.length || !rawTokens.length) return { hits: [], total: 0, totalCapped: false, ms: Date.now() - started };

  // مطابقة على مستوى الكلمة الكاملة (لا احتواء جزئيّ) عبر البحث النصيّ الكامل بإعداد 'simple'
  // الذي يقسم على الفراغات/الترقيم فقط بلا جذوع إنجليزية — يتفادى إيجابيات مثل «نجش» داخل «سونجشانج».
  // مع العمود المفهرس: tsquery بصيغ كل لفظ (السوابق + التطبيعان اللذان قد يُبنى بهما العمود).
  const normQuery = tokens.join(" ");
  const indexed = await hasSearchNormColumn();
  const tsQuery = indexed ? buildRulingTsQuery(opts.query) : null;
  // المسار المفهرس: عمود search_norm (منقّى PDPL ومطبَّع) مع فهرس GIN. وإلّا تطبيع فوريّ.
  const tsv = indexed
    ? `to_tsvector('simple', coalesce("search_norm",''))`
    : `to_tsvector('simple', ${sqlNormalize(`"judgmentText"`)} || ' ' || ${sqlNormalize(`"judgmentTitle"`)})`;
  const params: unknown[] = [];
  const conds: string[] = [];
  params.push(tsQuery ?? normQuery);
  const tsqIdx = params.length;
  const tsq = tsQuery ? `to_tsquery('simple', $${tsqIdx})` : `plainto_tsquery('simple', $${tsqIdx})`;
  conds.push(`${tsv} @@ ${tsq}`);
  if (opts.court && opts.court.trim()) {
    params.push(`%${normalizeArabic(opts.court)}%`);
    conds.push(`(${sqlNormalize(`"court"`)} LIKE $${params.length} OR ${sqlNormalize(`"courtOfAppeal"`)} LIKE $${params.length})`);
  }
  if (opts.yearH && Number.isInteger(opts.yearH)) {
    params.push(`%${opts.yearH}%`);
    conds.push(`(regexp_replace(translate(coalesce("decisionDateText",'')||' '||coalesce("caseDateText",''), '٠١٢٣٤٥٦٧٨٩','0123456789'), '[^0-9 ]','','g') LIKE $${params.length})`);
  }
  const where = conds.join(" AND ");

  const totalQ = prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint AS c FROM (SELECT 1 FROM "judicial_cases" WHERE ${where} LIMIT ${COUNT_CAP + 1}) s`, ...params,
  ).catch(() => [{ c: BigInt(0) }]);

  // الترتيب على مرشحين محدودين من الفهرس (لا حساب rank لآلاف الأحكام في الألفاظ الشائعة).
  const rowsQ = prisma.$queryRawUnsafe<Array<{
    id: string; decisionNo: string | null; caseNo: string | null; court: string | null;
    cityName: string | null; decisionDateText: string | null; caseDateText: string | null;
    judgmentTitle: string | null; judgmentText: string | null;
  }>>(
    `WITH c AS (SELECT "id" FROM "judicial_cases" WHERE ${where} LIMIT ${RANK_CANDIDATES})
     SELECT j."id",j."decisionNo",j."caseNo",j."court",j."cityName",j."decisionDateText",j."caseDateText",j."judgmentTitle",j."judgmentText",
            ts_rank_cd(${tsv.replace(/"search_norm"|"judgmentText"|"judgmentTitle"/g, (m) => `j.${m}`)}, ${tsq}) AS rank
     FROM c JOIN "judicial_cases" j ON j."id" = c."id"
     ORDER BY rank DESC, j."decisionDate" DESC NULLS LAST
     LIMIT ${limit} OFFSET ${offset}`, ...params,
  ).catch(() => []);
  const [totalRow, rows] = await Promise.all([totalQ, rowsQ]);
  const counted = Number(totalRow?.[0]?.c ?? 0);
  const totalCapped = counted > COUNT_CAP;
  const total = Math.min(counted, COUNT_CAP);

  const hits: RulingHit[] = rows.map((r) => {
    const raw = r.judgmentText ?? "";
    // كم لفظًا من الاستعلام ورد كلمةً كاملة (مع السوابق) في النص أو العنوان.
    const present = rawTokens.filter((t) => findMatches(`${r.judgmentTitle ?? ""} ${raw}`, t).length > 0).length;
    // ما يقرؤه حكيم: مقتطف من الأسباب أو المنطوق، والمنطوق مرفق، وخريطة الأجزاء — منقّاة من PDPL.
    const ex = buildRulingExcerpts(raw, opts.query);
    const placeBoost = ex.matchedIn === "reasons" || ex.matchedIn === "disposition" ? 0.1 : 0;
    return {
      id: r.id,
      decisionNo: r.decisionNo,
      caseNo: r.caseNo,
      court: r.court,
      cityName: r.cityName,
      dateText: r.decisionDateText ?? r.caseDateText,
      hijriYear: extractHijriYear(r.decisionDateText ?? r.caseDateText),
      title: r.judgmentTitle,
      snippet: redactPII(ex.snippet),
      matchedIn: ex.matchedIn,
      disposition: ex.disposition ? redactPII(ex.disposition) : null,
      parts: ex.parts,
      score: Math.min(1, present / rawTokens.length + placeBoost),
    };
  });
  hits.sort((a, b) => b.score - a.score);

  return { hits, total, totalCapped, ms: Date.now() - started };
}

/** يحوّل نتيجة الأحكام المباشرة إلى الشكل الموحّد للبحث الشامل وأدوات الوكيل. */
export function rulingHitToMerged(h: RulingHit): MergedResult {
  return {
    type: "ruling",
    id: h.id,
    title: `حكم ${h.decisionNo ?? h.caseNo ?? h.id}${h.court ? ` — ${h.court}` : ""}`,
    snippet: h.snippet,
    confidence: h.score,
    sources: ["postgres"],
    reasons: [`مطابقة كلمات كاملة في ${h.matchedIn === "reasons" ? "الأسباب" : h.matchedIn === "disposition" ? "المنطوق" : "نص الحكم"}`],
    meta: {
      matchedBy: "lexical",
      sourceType: "ruling",
      caseNo: h.caseNo,
      decisionNo: h.decisionNo,
      court: h.court ?? undefined,
      year: h.hijriYear ? String(h.hijriYear) : undefined,
      decisionDateText: h.dateText ?? undefined,
      matchedIn: h.matchedIn ?? undefined,
      disposition: h.disposition ?? undefined,
    },
  };
}
