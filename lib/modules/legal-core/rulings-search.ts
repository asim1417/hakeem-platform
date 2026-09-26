/**
 * rulings-search — مسار بحث مستقلّ للأحكام القضائية (البند 1.7 من خطة الإصلاح).
 *
 * يستعلم من judicial_cases مباشرةً، ولا يمرّ بدمج المواد/الأنظمة إطلاقًا.
 *   • تطبيع عربيّ + أرقام هندية (على الاستعلام وعلى العمود وقت البحث).
 *   • توسيع صرفيّ للاستعلام (اشتقاقات/جذر/ساق…) على search_norm — بلا تعديل judgmentText.
 *   • فلاتر المحكمة والسنة الهجرية (تُستخرج من نصّ التاريخ الهجريّ).
 *   • حجب PDPL: تُنقّى أرقام الهوية/الإقامة والجوال من المقتطف قبل الإرجاع، ولا تُسجَّل.
 *
 * الأداء: يفضّل عمود search_norm المفهرس إن وُجد؛ وإلّا يسقط إلى تطبيع فوريّ
 * صالح للقراءة بلا فهرس (أبطأ).
 */
import { prisma } from "@/lib/prisma";
import { normalizeArabic } from "./bm25-tokenizer";
import { sanitizeJudgmentDisplay } from "./display-text";
import {
  buildArabicSearchVariants,
  findRootCandidates,
  getArabicStem,
  stripArabicAffixes,
  type ArabicSearchType,
} from "./arabic-morphology";

export interface RulingHit {
  id: string;
  decisionNo: string | null;
  caseNo: string | null;
  court: string | null;
  cityName: string | null;
  dateText: string | null;
  hijriYear: number | null;
  title: string | null;
  snippet: string; // منقّى من PDPL
  score: number; // 0..1 نسبة الألفاظ المتطابقة (+ حافز العنوان)
}

/** كلمات وقف لا تُوسَّع صرفيًا ولا تُفرَض في AND. */
const RULING_STOPWORDS = new Set([
  "في", "من", "علي", "الي", "عن", "مع", "هذا", "هذه", "ذلك", "التي", "الذي",
  "او", "ام", "ان", "كل", "بين", "عند", "لكن", "قد", "ما", "لا", "الا",
  "هو", "هي", "كان", "يكون", "ثم", "اي", "كما", "حتي", "اذا", "هل", "بسبب",
]);

/** حجب البيانات الشخصية الحساسة (PDPL): أرقام الهوية/الإقامة (10 خانات) والجوال. */
export function redactPII(text: string): string {
  if (!text) return "";
  // التطويل يكسر تسلسل الأرقام فيُفلت من النمط ثم يُحذف عند التطبيع فيلتصق الرقم.
  const src = String(text).replace(/\u0640/g, "");
  const digit = "[0-9\\u0660-\\u0669]";
  const notDigit = `(?<!${digit})`;
  const notDigitAfter = `(?!${digit})`;
  return src
    // هوية/إقامة: 10 خانات تبدأ بـ 1 أو 2، لاتينية أو عربية-هندية، ومن أي موضع في التسلسل.
    .replace(new RegExp(`${notDigit}[12\\u0661\\u0662]${digit}{9}${notDigitAfter}`, "g"), "•••••••••• [هوية محجوبة]")
    // جوال سعودي: 05######## أو +9665######## أو 009665######## (أرقام لاتينية أو هندية)
    .replace(new RegExp(`(?:\\+?966|00966)?[0\\u0660]?[5\\u0665]${digit}{8}${notDigitAfter}`, "g"), "[جوال محجوب]")
    // آيبان سعودي SA + 22 خانة
    .replace(new RegExp(`\\bSA${digit}{22}\\b`, "gi"), "[آيبان محجوب]");
}

/**
 * نص فهرس الأحكام: تنقية عرض آمنة → حجب PDPL → تطبيع → حجب ثانٍ.
 * التطبيع يحوّل الأرقام الهندية ويزيل الفواصل، فيُظهر أرقاماً لم يطابقها الحجب الأول.
 * لا يُعدَّل judgmentText الأصلي — هذا للنصّ المُفهرَس فقط.
 */
export function buildRulingSearchNorm(title: string | null | undefined, text: string | null | undefined): string {
  const raw = sanitizeJudgmentDisplay(`${title ?? ""} ${text ?? ""}`);
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
  return `lower(translate(regexp_replace(coalesce(${col},''), '[\\u064B-\\u0652\\u0640\\u0621]', '', 'g'),
    'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩', 'اااايهوي0123456789'))`;
}

/** ينظّف لفظًا ليصلح لـ to_tsquery('simple') — حروف عربية/لاتينية وأرقام فقط. */
function tsTerm(raw: string): string {
  return normalizeArabic(raw).replace(/[^ء-ي0-9a-z]/gi, "");
}

/**
 * يوسّع كل كلمة دالّة في الاستعلام بمتحوّرات صرفية، ويبني tsquery:
 * (فسخ|الفسخ|بفسخ) & (عقد|العقد)
 */
export function buildRulingMorphQuery(
  query: string,
  searchType: ArabicSearchType = "derivatives",
): { tokens: string[]; variantGroups: string[][]; allVariants: string[]; tsQuery: string } {
  const rawTokens = normalizeArabic(query)
    .split(/\s+/)
    .map((t) => tsTerm(t))
    .filter((t) => t.length >= 2 && !RULING_STOPWORDS.has(t));

  const tokens = Array.from(new Set(rawTokens));
  const variantGroups: string[][] = [];
  const allVariants: string[] = [];

  for (const token of tokens) {
    let expanded: string[] = [token];
    if (searchType === "exact") {
      expanded = [token];
    } else if (searchType === "contains") {
      expanded = [token, `ال${token}`, `ب${token}`, `و${token}`, `ل${token}`, `${token}ات`, `${token}ين`];
    } else if (searchType === "stem" || searchType === "affixes") {
      expanded = [
        token,
        tsTerm(stripArabicAffixes(token)),
        tsTerm(getArabicStem(token)),
        ...buildArabicSearchVariants(token, searchType).map(tsTerm),
      ];
    } else if (searchType === "root") {
      expanded = [token, ...findRootCandidates(token).map(tsTerm), ...buildArabicSearchVariants(token, "root").map(tsTerm)];
    } else {
      // derivatives (الافتراضي لبحث الأحكام)
      expanded = [token, ...buildArabicSearchVariants(token, "derivatives").map(tsTerm)];
    }

    const cleaned = Array.from(
      new Set(expanded.map(tsTerm).filter((v) => v.length >= 2 && (v === token || v.length >= 3))),
    ).slice(0, 14);

    if (!cleaned.length) continue;
    variantGroups.push(cleaned);
    allVariants.push(...cleaned);
  }

  const tsQuery = variantGroups
    .map((group) => (group.length === 1 ? group[0] : `(${group.join("|")})`))
    .join("&");

  return {
    tokens,
    variantGroups,
    allVariants: Array.from(new Set(allVariants)),
    tsQuery,
  };
}

export interface RulingSearchOptions {
  query: string;
  court?: string;
  yearH?: number;
  limit?: number;
  offset?: number;
  /** نوع التوسيع الصرفي — افتراضيًا اشتقاقات. */
  searchType?: ArabicSearchType;
}

let _hasSearchNorm: boolean | null = null;
async function hasSearchNormColumn(): Promise<boolean> {
  if (_hasSearchNorm !== null) return _hasSearchNorm;
  const r = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint c FROM information_schema.columns WHERE table_name='judicial_cases' AND column_name='search_norm'`,
  ).catch(() => [{ c: BigInt(0) }]);
  _hasSearchNorm = Number(r?.[0]?.c ?? 0) > 0;
  return _hasSearchNorm;
}

export async function searchRulingsDirect(opts: RulingSearchOptions): Promise<{ hits: RulingHit[]; total: number; ms: number }> {
  const started = Date.now();
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const searchType = opts.searchType ?? "derivatives";
  const morph = buildRulingMorphQuery(opts.query, searchType);
  if (!morph.tsQuery || !morph.tokens.length) return { hits: [], total: 0, ms: Date.now() - started };

  const indexed = await hasSearchNormColumn();
  const tsv = indexed
    ? `to_tsvector('simple', coalesce("search_norm",''))`
    : `to_tsvector('simple', ${sqlNormalize(`"judgmentText"`)} || ' ' || ${sqlNormalize(`"judgmentTitle"`)})`;
  const params: unknown[] = [];
  const conds: string[] = [];
  params.push(morph.tsQuery);
  const tsqIdx = params.length;
  // to_tsquery: OR داخل المجموعة الصرفية وAND بين كلمات السؤال.
  conds.push(`${tsv} @@ to_tsquery('simple', $${tsqIdx})`);
  if (opts.court && opts.court.trim()) {
    params.push(`%${normalizeArabic(opts.court)}%`);
    conds.push(`(${sqlNormalize(`"court"`)} LIKE $${params.length} OR ${sqlNormalize(`"courtOfAppeal"`)} LIKE $${params.length})`);
  }
  if (opts.yearH && Number.isInteger(opts.yearH)) {
    params.push(`%${opts.yearH}%`);
    conds.push(`(regexp_replace(translate(coalesce("decisionDateText",'')||' '||coalesce("caseDateText",''), '٠١٢٣٤٥٦٧٨٩','0123456789'), '[^0-9 ]','','g') LIKE $${params.length})`);
  }
  const where = conds.join(" AND ");

  const totalRow = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint AS c FROM "judicial_cases" WHERE ${where}`, ...params,
  ).catch(() => [{ c: BigInt(0) }]);
  const total = Number(totalRow?.[0]?.c ?? 0);

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; decisionNo: string | null; caseNo: string | null; court: string | null;
    cityName: string | null; decisionDateText: string | null; caseDateText: string | null;
    judgmentTitle: string | null; judgmentText: string | null;
  }>>(
    `SELECT "id","decisionNo","caseNo","court","cityName","decisionDateText","caseDateText","judgmentTitle","judgmentText",
            ts_rank(${tsv}, to_tsquery('simple', $${tsqIdx})) AS rank
     FROM "judicial_cases" WHERE ${where}
     ORDER BY rank DESC, "decisionDate" DESC NULLS LAST
     LIMIT ${limit} OFFSET ${offset}`, ...params,
  ).catch(() => []);

  const hits: RulingHit[] = rows.map((r) => {
    const bodyWords = new Set(normalizeArabic(r.judgmentText ?? "").split(/\s+/));
    const titleWords = new Set(normalizeArabic(r.judgmentTitle ?? "").split(/\s+/));
    const present = morph.variantGroups.filter((group) =>
      group.some((v) => bodyWords.has(v) || titleWords.has(v)),
    ).length;
    const titleBoost = morph.variantGroups.some((group) => group.some((v) => titleWords.has(v))) ? 0.1 : 0;
    const raw = r.judgmentText ?? "";
    const normRaw = normalizeArabic(raw);
    let idx = -1;
    for (const v of morph.allVariants) {
      const i = normRaw.search(new RegExp(`(^|\\s)${v}(\\s|$)`));
      if (i >= 0) { idx = i; break; }
    }
    const start = idx > 60 ? idx - 60 : 0;
    const snippet = redactPII(raw.slice(start, start + 240)).replace(/\s+/g, " ").trim();
    return {
      id: r.id,
      decisionNo: r.decisionNo,
      caseNo: r.caseNo,
      court: r.court,
      cityName: r.cityName,
      dateText: r.decisionDateText ?? r.caseDateText,
      hijriYear: extractHijriYear(r.decisionDateText ?? r.caseDateText),
      title: r.judgmentTitle,
      snippet,
      score: Math.min(1, (morph.variantGroups.length ? present / morph.variantGroups.length : 0) + titleBoost),
    };
  });
  hits.sort((a, b) => b.score - a.score);

  return { hits, total, ms: Date.now() - started };
}

/** يحوّل نتيجة بحث الأحكام المفهرس إلى شكل نتائج البحث الموحّد (مواد/أحكام/مبادئ). */
export function rulingHitToMerged(h: RulingHit): {
  type: "ruling";
  id: string;
  title: string;
  snippet?: string;
  confidence: number;
  sources: ["postgres"];
  reasons: string[];
  meta: Record<string, unknown>;
} {
  return {
    type: "ruling",
    id: h.id,
    title: `حكم ${h.decisionNo ?? h.caseNo ?? h.id}${h.court ? ` — ${h.court}` : ""}`,
    snippet: h.snippet || undefined,
    confidence: Math.max(0.4, Math.min(1, h.score || 0.7)),
    sources: ["postgres"],
    reasons: ["تطابق مفهرس صرفي في الأحكام القضائية (search_norm)"],
    meta: {
      matchedBy: "lexical",
      sourceType: "ruling",
      caseNo: h.caseNo ?? undefined,
      decisionNo: h.decisionNo ?? undefined,
      court: h.court ?? undefined,
      year: h.hijriYear != null ? String(h.hijriYear) : undefined,
      decisionDateText: h.dateText ?? undefined,
      citationKey: `حكم ${h.decisionNo ?? h.caseNo ?? h.id}`,
    },
  };
}
