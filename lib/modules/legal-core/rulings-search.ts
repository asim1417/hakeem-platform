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
import { sanitizeJudgmentDisplay } from "./display-text";

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

export async function searchRulingsDirect(opts: RulingSearchOptions): Promise<{ hits: RulingHit[]; total: number; ms: number }> {
  const started = Date.now();
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const tokens = normalizeArabic(opts.query).split(/\s+/).filter((t) => t.length >= 2);
  if (!tokens.length) return { hits: [], total: 0, ms: Date.now() - started };

  // مطابقة على مستوى الكلمة الكاملة (لا احتواء جزئيّ) عبر البحث النصيّ الكامل بإعداد 'simple'
  // الذي يقسم على الفراغات/الترقيم فقط بلا جذوع إنجليزية — يتفادى إيجابيات مثل «نجش» داخل «سونجشانج».
  const normQuery = tokens.join(" ");
  const indexed = await hasSearchNormColumn();
  // المسار المفهرس: عمود search_norm (منقّى PDPL ومطبَّع) مع فهرس GIN. وإلّا تطبيع فوريّ.
  const tsv = indexed
    ? `to_tsvector('simple', coalesce("search_norm",''))`
    : `to_tsvector('simple', ${sqlNormalize(`"judgmentText"`)} || ' ' || ${sqlNormalize(`"judgmentTitle"`)})`;
  const params: unknown[] = [];
  const conds: string[] = [];
  params.push(normQuery);
  const tsqIdx = params.length;
  conds.push(`${tsv} @@ plainto_tsquery('simple', $${tsqIdx})`);
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
            ts_rank(${tsv}, plainto_tsquery('simple', $${tsqIdx})) AS rank
     FROM "judicial_cases" WHERE ${where}
     ORDER BY rank DESC, "decisionDate" DESC NULLS LAST
     LIMIT ${limit} OFFSET ${offset}`, ...params,
  ).catch(() => []);

  const hits: RulingHit[] = rows.map((r) => {
    const bodyWords = new Set(normalizeArabic(r.judgmentText ?? "").split(/\s+/));
    const titleWords = new Set(normalizeArabic(r.judgmentTitle ?? "").split(/\s+/));
    const present = tokens.filter((t) => bodyWords.has(t) || titleWords.has(t)).length;
    const titleBoost = tokens.some((t) => titleWords.has(t)) ? 0.1 : 0;
    // مقتطف حول أوّل لفظ مطابق (مطابقة كلمة كاملة)، منقّى من PDPL.
    const raw = r.judgmentText ?? "";
    const normRaw = normalizeArabic(raw);
    let idx = -1;
    for (const t of tokens) { const i = normRaw.search(new RegExp(`(^|\\s)${t}(\\s|$)`)); if (i >= 0) { idx = i; break; } }
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
      score: Math.min(1, present / tokens.length + titleBoost),
    };
  });
  hits.sort((a, b) => b.score - a.score);

  return { hits, total, ms: Date.now() - started };
}
