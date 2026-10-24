/**
 * HKM-044 المرحلة الأولى — الاستناد والبصمة والفهرس فوق SqlClient:
 *   hakeem_get_citation  صيغة الاستناد (مختصرة، كاملة، حاشية) لمادة أو حكم، مع أداة الإصدار وأداة التعديل.
 *   hakeem_check_ref     هل ما زال نص المادة كما اقتُبس؟ البصمة hakeem:art:<المعرّف>:<12 حرفًا من sha256>.
 *   hakeem_get_toc       أبواب النظام وفصوله (التقسيمات) وفهرس مواده صفحاتٍ بحالاتها.
 *
 * البصمة على النص الساري مطبَّعًا (normalizeAr، والمسافات موحدة)، فلا يغيّرها تشكيل ولا مسافة؛ وتتغير بأي تعديل.
 * بطاقة النظام وحالات المواد من getLawPageData (المصدر الواحد لصفحة النظام). قراءة فقط.
 */
import { createHash } from "node:crypto";
import type { SqlClient } from "../../modules/legal-core/sql-port";
import { articleKey, articleLabel, NON_ARTICLE_BIS } from "../../modules/legal-core/article-key";
import { getLawPageData, type IssueInstrument, type LawPageData } from "../../modules/legal-core/law-page-data";
import { rankLawNameMatches } from "../../modules/legal-core/law-name-match";
import { normalizeAr } from "./word-match";
import { hijriYearOf, loadLawCatalog } from "./catalog";
import type { EffectiveFn } from "./text-search";

export interface CitationDeps {
  effective?: EffectiveFn;
  siteUrl?: string;
}

async function effectiveOf(deps: CitationDeps): Promise<EffectiveFn> {
  if (deps.effective) return deps.effective;
  const m = await import("@/lib/modules/legal-core/effective-text");
  return (rows) => m.effectiveArticleTexts(rows);
}

// ── البصمة ──

export const REF_PREFIX = "hakeem:art:";

export function textFingerprint(text: string): string {
  const canon = normalizeAr(String(text ?? "")).replace(/\s+/g, " ").trim();
  return createHash("sha256").update(canon, "utf8").digest("hex").slice(0, 12);
}

export function articleRef(articleId: string, text: string): string {
  return `${REF_PREFIX}${articleId}:${textFingerprint(text)}`;
}

/** يقبل البصمة كاملة أو معرّف المادة وحده. */
export function parseRef(ref: string): { id: string; fp: string | null } | null {
  const s = String(ref ?? "").trim();
  const m = s.match(/^hakeem:art:([A-Za-z0-9_-]{6,64}):([0-9a-f]{12})$/i);
  if (m) return { id: m[1], fp: m[2].toLowerCase() };
  if (/^[A-Za-z0-9_-]{6,64}$/.test(s)) return { id: s, fp: null };
  return null;
}

interface ArticleRow {
  id: string;
  article_number: number;
  article_bis: number;
  law_id: string | null;
  law: string;
  content: string;
}

async function loadArticle(db: SqlClient, id: string): Promise<ArticleRow | null> {
  const r = await db.query<ArticleRow>(
    `SELECT a."id", a."articleNumber" AS article_number, a."articleBis" AS article_bis, a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law, a."content"
       FROM legal_articles a LEFT JOIN legal_systems l ON l."id" = a."legalSystemId"
      WHERE a."id" = $1`,
    [id],
  );
  return r[0] ?? null;
}

// ── hakeem_check_ref ──

export async function handleCheckRef(db: SqlClient, args: { ref: string }, deps: CitationDeps = {}) {
  const parsed = parseRef(args.ref);
  if (!parsed) {
    return { status: "invalid_ref", ref: args.ref, note: "الصيغة: hakeem:art:<article_id>:<بصمة من 12 حرفًا> كما يرجعها hakeem_get_citation أو hakeem_verify_citation، أو معرّف المادة وحده." };
  }
  const a = await loadArticle(db, parsed.id);
  if (!a) return { status: "not_found", ref: args.ref, article_id: parsed.id, note: "لا مادة بهذا المعرّف في المدونة الآن." };
  const label = articleLabel(Number(a.article_number), Number(a.article_bis));
  const base = { ref: args.ref, article_id: a.id, law: a.law, law_id: a.law_id, article: label };
  if (Number(a.article_bis) >= NON_ARTICLE_BIS) {
    return { ...base, status: "not_an_article", note: "المعرّف لصف ليس مادة (عنوان أو نسخة مكررة أو نص تاريخي) — لا يُستشهد به." };
  }
  const e = (await (await effectiveOf(deps))([{ id: a.id, content: a.content }])).get(a.id);
  const current = e?.text ?? a.content;
  const currentRef = articleRef(a.id, current);
  const out = {
    ...base,
    current_ref: currentRef,
    current_text: current,
    basis: e?.basis ?? null,
    amended: e?.source === "unit_version",
    repealed: e?.repealed ?? false,
  };
  if (e?.repealed) return { ...out, status: "repealed", note: `${e.basis}. لا يُحتجّ بها نصًّا قائمًا.` };
  if (!parsed.fp) return { ...out, status: "no_fingerprint", note: "معرّف بلا بصمة: current_ref بصمة النص الساري الآن؛ احفظها مع الاقتباس." };
  if (parsed.fp === textFingerprint(current)) return { ...out, status: "valid", note: "النص الساري هو النص الذي أُخذت منه البصمة." };
  if (parsed.fp === textFingerprint(a.content))
    return { ...out, status: "changed", change: "amended_since_ref", note: `البصمة لنص المادة قبل تعديلها؛ النص الساري الآن مختلف (${e?.basis ?? "معدّلة"}).` };
  return { ...out, status: "changed", change: "text_differs", note: "النص الساري يختلف عن النص الذي أُخذت منه البصمة (تعديل أو تصحيح في المدونة). اقرأ current_text قبل الاعتماد." };
}

// ── hakeem_get_citation ──

const KIND_LABEL: Record<string, string> = {
  royal_decree: "المرسوم الملكي",
  royal_order: "الأمر الملكي",
  cabinet_decision: "قرار مجلس الوزراء",
};

/** «الصادر بالمرسوم الملكي رقم (م/51) وتاريخ 23/8/1426هـ»، أو «الصادر بموجب <نص الأداة>». */
export function issuedPhrase(i: IssueInstrument | null): string | null {
  if (!i) return null;
  const label = i.kind ? KIND_LABEL[i.kind] : undefined;
  if (label && i.number) {
    const date = i.dateHijri ? ` وتاريخ ${i.dateHijri.replace(/هـ?$/, "")}هـ` : "";
    return `الصادر ب${label} رقم (${i.number})${date}`;
  }
  return i.text ? `الصادر بموجب ${i.text.trim()}` : null;
}

const viewOpts = { withText: false, withOutgoingRepeals: false, resolveRepealingSystems: false } as const;

export type CitationStyle = "short" | "full" | "footnote";

async function articleCitation(db: SqlClient, id: string, style: CitationStyle, deps: CitationDeps) {
  const a = await loadArticle(db, id);
  if (!a || Number(a.article_bis) >= NON_ARTICLE_BIS) return { kind: "article", article_id: id, error: "لا مادة بهذا المعرّف في المدونة." };
  const n = Number(a.article_number);
  const bis = Number(a.article_bis);
  const label = articleLabel(n, bis);
  const data: LawPageData | null = a.law_id ? await getLawPageData(db, a.law_id, viewOpts) : null;
  const view = data?.body.divisions.flatMap((d) => d.articles).find((x) => x.id === a.id) ?? null;
  const lawName = data?.card.officialName ?? data?.system.name ?? a.law;
  const instrument = data?.card.instruments[0] ?? null;
  const issued = issuedPhrase(instrument);
  const e = (await (await effectiveOf(deps))([{ id: a.id, content: a.content }])).get(a.id);
  const amendedBy = e?.source === "unit_version" ? e.evidenceInstrument ?? view?.amendment?.instrument ?? null : null;
  const repealed = e?.repealed ?? view?.status === "ملغى";
  const repealedBy = repealed ? e?.evidenceInstrument ?? view?.repeal?.instrument ?? null : null;
  const site = (deps.siteUrl ?? "").replace(/\/$/, "");
  const url = view?.url ? `${site}${view.url}` : data ? `${site}/legal/${encodeURIComponent(data.system.slug)}/${articleKey(n, bis)}` : null;
  const asOf = data?.asOf ?? new Date().toISOString().slice(0, 10);

  const short = `المادة (${label}) من ${lawName}`;
  const tail = [issued, amendedBy ? `والمعدّلة بموجب ${amendedBy}` : null].filter(Boolean).join("، ");
  const full = `${short}${tail ? `، ${tail}` : ""}${repealed ? ` (ملغاة${repealedBy ? ` بموجب ${repealedBy}` : ""})` : ""}`;
  const footnote = `${full}. منصة حكيم${url ? `: ${url}` : ""}، النص الساري في ${asOf}م.`;
  const ref = articleRef(a.id, e?.text ?? a.content);
  const chosen = style === "short" ? short : style === "footnote" ? footnote : full;
  const gaps = [!issued ? "أداة الإصدار غير مسجّلة في بطاقة النظام" : null, !data ? "المادة غير مربوطة بنظام في المدونة" : null].filter(Boolean);
  return {
    kind: "article",
    style,
    citation: chosen,
    short,
    full,
    footnote,
    ref,
    url,
    article_id: a.id,
    law_id: a.law_id,
    law: lawName,
    article: label,
    status: repealed ? "ملغاة" : amendedBy ? "معدّلة" : view?.statusLabel ?? null,
    issue_instrument: instrument ? { kind: instrument.kind, number: instrument.number, date_h: instrument.dateHijri, text: instrument.text } : null,
    amended_by: amendedBy,
    as_of: asOf,
    note:
      "الصيغة من بطاقة النظام وسجل التعديل في حكيم. ref بصمة النص الساري: hakeem_check_ref يكشف لاحقًا أي تغيّر فيه." +
      (gaps.length ? ` ناقص: ${gaps.join("؛ ")} — أكمله من المصدر الرسمي قبل الإيداع.` : ""),
  };
}

const RULING_SOURCE: Record<string, string> = { ahkam_moj: "مجموعة الأحكام القضائية المنشورة — وزارة العدل" };

async function rulingCitation(db: SqlClient, id: string, style: CitationStyle) {
  const r = (
    await db.query<{ id: string; court: string | null; city: string | null; case_no: string | null; decision_no: string | null; date_text: string | null; source: string | null }>(
      `SELECT id, court, "cityName" AS city, "caseNo" AS case_no, "decisionNo" AS decision_no, "decisionDateText" AS date_text, source
         FROM judicial_cases WHERE id = $1`,
      [id],
    )
  )[0];
  if (!r) return { kind: "ruling", ruling_id: id, error: "لا حكم بهذا المعرّف." };
  const court = (r.court ?? "المحكمة").trim();
  const courtCity = r.city && !court.includes(r.city) ? `${court} في ${r.city}` : court;
  const year = hijriYearOf(r.date_text);
  const num = r.decision_no ?? r.case_no;
  const short = `حكم ${court}${num ? ` رقم (${num})` : ""}${year ? ` لعام ${year}هـ` : ""}`;
  const full =
    `حكم ${courtCity}` +
    (r.case_no ? ` في القضية رقم (${r.case_no})` : "") +
    (r.decision_no ? `، القرار رقم (${r.decision_no})` : "") +
    (r.date_text ? ` وتاريخ ${r.date_text.replace(/هـ?$/, "")}هـ` : "");
  const source = RULING_SOURCE[r.source ?? ""] ?? (r.source ? `المصدر: ${r.source}` : null);
  const footnote = `${full}${source ? `، ${source}` : ""}. منصة حكيم، معرّف الحكم ${r.id}.`;
  return {
    kind: "ruling",
    style,
    citation: style === "short" ? short : style === "footnote" ? footnote : full,
    short,
    full,
    footnote,
    ruling_id: r.id,
    court: r.court,
    case_number: r.case_no,
    decision_number: r.decision_no,
    year_h: year,
    note: "أسماء الأطراف لا تدخل الاستناد. التاريخ كما ورد في المصدر.",
  };
}

export async function handleGetCitation(
  db: SqlClient,
  args: { article_id?: string; ruling_id?: string; style?: CitationStyle },
  deps: CitationDeps = {},
) {
  const style: CitationStyle = args.style ?? "full";
  if (args.article_id) return articleCitation(db, args.article_id, style, deps);
  if (args.ruling_id) return rulingCitation(db, args.ruling_id, style);
  return { error: "مرّر article_id أو ruling_id." };
}

// ── hakeem_get_toc ──

export const TOC_DEFAULT_LIMIT = 100;
export const TOC_MAX_LIMIT = 300;

export async function handleGetToc(
  db: SqlClient,
  args: { law_id?: string; name?: string; offset?: number; limit?: number },
  deps: CitationDeps = {},
) {
  let lawId = args.law_id ?? null;
  let alternatives: Array<{ law_id: string; name: string }> = [];
  if (!lawId && args.name) {
    const all = await loadLawCatalog(db);
    const ranked = rankLawNameMatches(
      all.map((l) => ({ id: l.law_id, name: l.name, articleCount: l.articles_count })),
      args.name,
      { retired: new Set(all.filter((l) => l.status === "لاغي").map((l) => l.law_id)) },
    );
    lawId = ranked.match?.id ?? null;
    alternatives = ranked.alternatives.map((x) => ({ law_id: x.id, name: x.name }));
  }
  if (!lawId) return { error: "النظام غير محدد: مرّر law_id أو name (أو استعمل hakeem_resolve).", alternatives };
  const data = await getLawPageData(db, lawId, viewOpts);
  if (!data) return { error: "لا نظام بهذا المعرّف.", law_id: lawId };
  const site = (deps.siteUrl ?? "").replace(/\/$/, "");
  const lawUrl = `${site}/legal/${encodeURIComponent(data.system.slug)}`;
  const divisions = data.body.divisions.map((d, i) => ({
    index: i,
    heading: d.heading,
    from: d.articles[0]?.label ?? null,
    to: d.articles[d.articles.length - 1]?.label ?? null,
    articles: d.articles.length,
    all_repealed: d.allRepealed,
  }));
  const flat = data.body.divisions.flatMap((d, i) => d.articles.map((a) => ({ a, i })));
  const limit = Math.min(Math.max(Math.floor(args.limit ?? TOC_DEFAULT_LIMIT), 1), TOC_MAX_LIMIT);
  const offset = Math.max(0, Math.floor(args.offset ?? 0));
  const slice = flat.slice(offset, offset + limit);
  const next = offset + slice.length < flat.length ? offset + slice.length : null;
  return {
    law_id: data.system.id,
    name: data.system.name,
    kind: data.card.kind,
    status: data.card.status.label,
    ...(alternatives.length ? { alternatives } : {}),
    divisions,
    articles: slice.map(({ a, i }) => ({
      article_id: a.id,
      key: a.key,
      label: a.label,
      heading: a.heading,
      division: i,
      status: a.status,
      status_label: a.statusLabel,
    })),
    articles_page: { offset, limit, returned: slice.length, total: flat.length, next_offset: next },
    counts: data.body.counts,
    url: lawUrl,
    article_url_template: `${lawUrl}/{key}`,
    as_of: data.asOf,
    note:
      (divisions.length <= 1 && !divisions[0]?.heading ? "لا تقسيمات (أبواب/فصول) مسجّلة لهذا النظام. " : "") +
      "الحالة لكل مادة من سجل التحقق؛ status=null غير مؤكد. لنص المواد hakeem_get_articles_range." +
      (next !== null ? " تابع بـ offset=articles_page.next_offset." : ""),
  };
}
