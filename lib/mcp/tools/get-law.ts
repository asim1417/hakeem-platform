/**
 * hakeem_get_law (HKM-023-B ع-١٣) — بطاقة النظام وفهرسه فوق getLawPageData.
 *
 * العقد إضافي: الحقول القديمة كلها باقية بأسمائها (law_id، name، classification، issue_instrument، issue_date_h،
 * status، articles_count، toc[{article_id، number، title}]). ما كان null ثابتًا صار يُملأ إن توفرت بياناته:
 *   issue_instrument = نص أول أداة إصدار؛ issue_date_h = تاريخ الإصدار الهجري؛ status = حالة النظام من قائمة الهيئة
 *   الست (أو null إن لم تقابلها حالة موثّقة).
 * المضاف: match (طريقة المطابقة والبدائل)، official_name، kind، status_detail، issue_instruments[]، dates (الأربعة)،
 *   replaced_by/replaces/repeal، preamble (وحدات أو نص مع وسم الاكتمال)، counts، url، article_url_template، as_of.
 *
 * الفهرس مضغوط (مراجعة الجودة ع٢: النسخة الأولى كبّرت المخرج 3.6 مرات). كل عنصر يبقى بحقوله القديمة الثلاثة، ولا
 * يُضاف إليه إلا ما له قيمة:
 *   bis وkey      للمادة المكررة فقط (HKM-028: «12 مكرر» ← bis=1، key="12_bis")؛ وللأصل key = number.
 *   status        «ساري» أو «معدّل» أو «ملغى» أو «مستبدل» (HKM-030: باهتة بنصها، لا ملغاة) إن كانت موثّقة؛ غيابه = غير مؤكد (عدّاده counts.unverified).
 *   repealed_by وrepeal_effective_date   للمادة الملغاة بأداة خاصة بها (لا للملغاة تبعًا لإلغاء النظام كله، فبيانها في repeal).
 *   repealed_from  إن كان إلغاؤها مؤجلًا إلى تاريخ بعد as_of.
 * رابط المادة لا يتكرر: article_url_template + key.
 * لا يُقرأ نص أي مادة (withText=false)، ولا تُمسح جداول التحقق والبطاقات كلها.
 * لا Prisma هنا (SqlClient)، ليُختبر على قاعدة محلية.
 *
 * HKM-044 (وضع مختصر): بطاقة المعاملات المدنية كانت ١٠٣ آلاف حرف فقُطعت عند العميل. الفهرس الآن صفحات
 * (toc_offset/toc_limit، الافتراض ١٠٠ والأقصى ٣٠٠) مع toc_page، ونص المقدمة لا يُعاد إلا بـ include_preamble=true
 * (يبقى وصفها: النوع والاكتمال والطول). والحقول القديمة كلها باقية بأسمائها.
 * وحارس أداة الإلغاء: أداة إلغاء مسجلة تطابق أداة إصدار النظام نفسه (الرقم والسنة) لا تُعرض أداةَ إلغاء
 * («نظام الاستثمار الأجنبي» ظهر ملغى بمرسومه م/1 لعام 1421)؛ تُرفع في data_warnings حتى تُصحَّح البيانات.
 */
import { getLawPageData, instrumentKey, type LawPageData, type RepealInfo } from "../../modules/legal-core/law-page-data";
import { findLawByName, type LawMatchType } from "../../modules/legal-core/law-name-match";
import type { SqlClient } from "../../modules/legal-core/sql-port";

/** سقف نص المقدمة في مخرج الأداة (المقدمات المتسرّب إليها متن قد تبلغ 178 ألف حرف). */
export const MCP_PREAMBLE_MAX_CHARS = 12_000;
/** حقل مقدمة قديم يحوي متنًا لا مقدمة: يُعاد منه هذا القدر فقط مع body_leak=true. */
export const MCP_BODY_LEAK_MAX_CHARS = 1_000;
/** صفحة الفهرس الافتراضية وأقصاها (HKM-044: سقف المخرج نحو ٢٠ ألف حرف). */
export const MCP_TOC_DEFAULT_LIMIT = 100;
export const MCP_TOC_MAX_LIMIT = 300;

export interface LawViewOptions {
  tocOffset?: number;
  tocLimit?: number;
  includePreamble?: boolean;
}

export interface McpTocEntry {
  article_id: string;
  number: number;
  title: string | null;
  bis?: number;
  key?: string;
  status?: string;
  repealed_by?: string;
  repeal_effective_date?: string;
  repealed_from?: string;
}

type ArticleLike = LawPageData["body"]["divisions"][number]["articles"][number];

/** عنصر فهرس مضغوط: الحقول القديمة، وما له قيمة فقط. ownKeys: مفاتيح أدوات إصدار النظام (حارس الإلغاء). */
export function tocEntry(a: ArticleLike, ownKeys: ReadonlySet<string> = new Set()): McpTocEntry {
  const e: McpTocEntry = { article_id: a.id, number: a.number, title: a.title };
  if (a.bis > 0) {
    e.bis = a.bis;
    e.key = a.key;
  }
  if (a.status) e.status = a.status;
  if (a.repeal && !a.inheritedFromWork) {
    if (a.repeal.instrument && !isOwnInstrument(a.repeal.instrument, ownKeys)) e.repealed_by = a.repeal.instrument;
    if (a.repeal.effectiveDate) e.repeal_effective_date = a.repeal.effectiveDate;
  }
  if (a.repealedLaterOn) e.repealed_from = a.repealedLaterOn;
  return e;
}

export interface GetLawInput {
  lawId?: string;
  name?: string;
}

/**
 * مفتاح الأداة (الرقم والسنة الهجرية) بصيغها كلها: صيغة instrumentKey («مرسوم ملكي رقم (م/191) وتاريخ …»)،
 * والصيغة المختصرة في سجلات التحقق («م/1 وتاريخ 1421/1/5هـ — من 2025-02-07») التي لا يقرؤها instrumentKey.
 */
export function looseInstrumentKey(text: string | null | undefined): string | null {
  const k = instrumentKey(text);
  if (k || !text) return k;
  const t = text.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const num = t.match(/([مأإآا])\s*\/\s*(\d+)/);
  const yr = t.match(/(1[34]\d{2})\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}/) ?? t.match(/\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*(1[34]\d{2})/);
  if (!num || !yr) return null;
  return `${num[1].replace(/[أإآ]/, "ا")}/${num[2]}|${yr[1]}`;
}

/** أداة مسجلة تطابق إحدى أدوات إصدار النظام نفسه (الرقم والسنة الهجرية). */
export function isOwnInstrument(text: string | null | undefined, ownKeys: ReadonlySet<string>): boolean {
  const k = looseInstrumentKey(text);
  return k !== null && ownKeys.has(k);
}

const repealOut = (r: RepealInfo | null, ownKeys: ReadonlySet<string>) =>
  r
    ? {
        type: r.type,
        type_derived: r.typeDerived,
        // HKM-044: أداة الإصدار نفسها ليست أداة إلغاء — لا تُعرض حتى تُصحَّح (التحذير في data_warnings).
        instrument: isOwnInstrument(r.instrument, ownKeys) ? null : r.instrument,
        url: r.url,
        effective_date: r.effectiveDate,
        repealing_law: r.repealingSystem ? { law_id: r.repealingSystem.id, name: r.repealingSystem.name } : null,
      }
    : null;

/** طول نص المقدمة كاملًا (لوصفها في الوضع المختصر). */
function preambleChars(data: LawPageData): number {
  const p = data.preamble;
  if (p.kind === "units" && p.units)
    return [...p.units.outside, ...p.units.instruments.flatMap((i) => i.units)].reduce((n, u) => n + u.text.length, 0);
  if (p.kind === "source_blocks" && p.sourceBlocks) return p.sourceBlocks.blocks.map((b) => (b.heading ? `${b.heading}\n${b.text}` : b.text)).join("\n").length;
  if (p.kind === "legacy_text" && p.legacy) return p.legacy.text.length;
  return 0;
}

function preambleOut(data: LawPageData, include = true) {
  const p = data.preamble;
  const base = {
    kind: p.kind,
    label: p.label,
    completeness: p.completeness,
    complete: p.kind === "units" && p.completeness === "complete",
    source_url: p.officialSourceUrl,
  };
  if (!include) {
    // مراجعة الجودة ٤: المفاتيح القديمة باقية (بقيمة null بلا نص)، وما لا نص فيه يبقى: أدوات المقدمة وتحذير body_leak.
    const chars = preambleChars(data);
    const bodyLeak = p.kind === "legacy_text" && Boolean(p.legacy?.bodyLeak);
    return {
      ...base,
      ...(p.kind === "units" && p.units
        ? { instruments: p.units.instruments.map((i) => ({ index: i.index, kind: i.kind, number: i.number, date_h: i.dateHijri, heading: i.heading })), units: null }
        : { text: null }),
      ...(bodyLeak ? { body_leak: true } : {}),
      truncated: false,
      text_included: false as const,
      chars,
      hint: chars ? "نص المقدمة بـ include_preamble=true" : null,
    };
  }
  if (p.kind === "units" && p.units) {
    let budget = MCP_PREAMBLE_MAX_CHARS;
    let truncated = false;
    const flat = [
      ...p.units.outside.map((u) => ({ ...u, instrument: null as number | null })),
      ...p.units.instruments.flatMap((i) => i.units.map((u) => ({ ...u, instrument: i.index }))),
    ].sort((a, b) => a.ordinal - b.ordinal);
    const units = flat.map((u) => {
      const text = u.text.length <= budget ? u.text : u.text.slice(0, Math.max(0, budget));
      if (text.length < u.text.length) truncated = true;
      budget -= text.length;
      return { type: u.type, label: u.label, number: u.number, instrument: u.instrument, anchor: u.anchor, text };
    });
    return {
      ...base,
      instruments: p.units.instruments.map((i) => ({ index: i.index, kind: i.kind, number: i.number, date_h: i.dateHijri, heading: i.heading })),
      units,
      truncated,
      chars: flat.reduce((n, u) => n + u.text.length, 0),
    };
  }
  const full =
    p.kind === "source_blocks" && p.sourceBlocks
      ? p.sourceBlocks.blocks.map((b) => (b.heading ? `${b.heading}\n${b.text}` : b.text)).join("\n")
      : p.kind === "legacy_text" && p.legacy
        ? p.legacy.text
        : "";
  const bodyLeak = p.kind === "legacy_text" && Boolean(p.legacy?.bodyLeak);
  const cap = bodyLeak ? MCP_BODY_LEAK_MAX_CHARS : MCP_PREAMBLE_MAX_CHARS;
  return {
    ...base,
    ...(bodyLeak ? { body_leak: true } : {}),
    text: full ? full.slice(0, cap) : null,
    truncated: full.length > cap,
    chars: full.length,
  };
}

/** يحوّل بيانات الصفحة إلى مخرج الأداة. نقي. */
export function toMcpLaw(
  data: LawPageData,
  match: { by: LawMatchType; query: string | null; alternatives: Array<{ id: string; name: string }> },
  siteUrl = "",
  view: LawViewOptions = {},
) {
  const card = data.card;
  const first = card.instruments[0] ?? null;
  const articles = data.body.divisions.flatMap((d) => d.articles);
  const lawUrl = `${siteUrl}/legal/${encodeURIComponent(data.system.slug)}`;
  // مراجعة الجودة ٧: أدوات الإصدار في سنة إصدار النظام وحدها (بطاقة طبعة قديمة قد تحمل مرسوم نظام آخر).
  const issuedYear = (card.dates.issued.hijri ?? first?.dateHijri ?? "").split("/")[0] || null;
  const ownKeys = new Set(
    card.instruments
      .map((i) => looseInstrumentKey(i.text))
      .filter((k): k is string => k !== null && (!issuedYear || k.endsWith(`|${issuedYear}`))),
  );
  const offset = Math.max(0, Math.floor(view.tocOffset ?? 0));
  const limit = Math.min(Math.max(Math.floor(view.tocLimit ?? MCP_TOC_DEFAULT_LIMIT), 1), MCP_TOC_MAX_LIMIT);
  const tocSlice = articles.slice(offset, offset + limit);
  const nextOffset = offset + tocSlice.length < articles.length ? offset + tocSlice.length : null;
  const evidenceInstrument = card.status.evidence?.instrument ?? null;
  const warnings: string[] = [];
  const ownRepeal = isOwnInstrument(card.repeal?.instrument, ownKeys) || isOwnInstrument(evidenceInstrument, ownKeys);
  const ownArticleRepeals = articles.filter((a) => a.repeal && !a.inheritedFromWork && isOwnInstrument(a.repeal.instrument, ownKeys)).length;
  if (ownRepeal || ownArticleRepeals) {
    // يُقتبس ما طابق فعلًا (أداة الإلغاء، أو أداة السند، أو أداة المادة).
    const recorded =
      (isOwnInstrument(card.repeal?.instrument, ownKeys)
        ? card.repeal?.instrument
        : isOwnInstrument(evidenceInstrument, ownKeys)
          ? evidenceInstrument
          : articles.find((a) => a.repeal && !a.inheritedFromWork && isOwnInstrument(a.repeal.instrument, ownKeys))?.repeal?.instrument) ?? "";
    warnings.push(
      `أداة الإلغاء المسجلة${ownArticleRepeals ? ` (${ownRepeal ? "للنظام و" : "لـ"}${ownArticleRepeals} مادة)` : ""} تطابق أداة إصدار النظام نفسه، فلم تُعرض أداةً للإلغاء: «${recorded.slice(0, 300)}». الحالة والتاريخ باقيان بسندهما (evidence_url) حتى تُصحَّح البيانات.`,
    );
  }
  return {
    law_id: data.system.id,
    name: data.system.name,
    classification: data.system.classification ?? data.system.domainTitle ?? data.system.domain ?? null,
    issue_instrument: first?.text ?? null,
    issue_date_h: card.dates.issued.hijri ?? first?.dateHijri ?? null,
    status: card.status.boe,
    articles_count: data.system.articleCountStored || articles.length,
    toc: tocSlice.map((a) => tocEntry(a, ownKeys)),
    toc_page: { offset, limit, returned: tocSlice.length, total: articles.length, next_offset: nextOffset },
    match: { by: match.by, query: match.query, alternatives: match.alternatives.map((x) => ({ law_id: x.id, name: x.name })) },
    official_name: card.officialName,
    kind: card.kind,
    status_detail: {
      boe: card.status.boe,
      label: card.status.label,
      hakeem: card.status.hakeem,
      at_source: card.status.atSource,
      derived_by_date: card.status.derivedByDate,
      evidence_instrument: isOwnInstrument(evidenceInstrument, ownKeys) ? null : evidenceInstrument,
      evidence_url: card.status.evidence?.url ?? null,
    },
    issue_instruments: card.instruments.map((i) => ({ kind: i.kind, text: i.text, number: i.number, date_h: i.dateHijri, source: i.source })),
    dates: card.dates,
    replaced_by: card.replacedBy ? { law_id: card.replacedBy.id, name: card.replacedBy.name } : null,
    replaces: card.replaces.map((r) => ({ law_id: r.id, name: r.name })),
    repeal: repealOut(card.repeal, ownKeys),
    preamble: preambleOut(data, view.includePreamble ?? false),
    counts: data.body.counts,
    data_warnings: warnings,
    url: lawUrl,
    /** رابط المادة: استبدل {key} بـ key العنصر (أو number إن غاب key). */
    article_url_template: `${lawUrl}/{key}`,
    as_of: data.asOf,
  };
}

/** الأداة: المعرّف أولًا، وإلا المطابقة بالاسم (تامة ← يبدأ بـ ← احتواء). */
export async function getLawTool(db: SqlClient, input: GetLawInput, opts: { asOf?: string; siteUrl?: string } & LawViewOptions = {}) {
  const lawId = input.lawId?.trim();
  const name = input.name?.trim();
  let id: string | null = null;
  let match: { by: LawMatchType; query: string | null; alternatives: Array<{ id: string; name: string }> };
  if (lawId) {
    const row = (await db.query<{ id: string }>(`SELECT id FROM legal_systems WHERE id = $1`, [lawId]))[0];
    id = row?.id ?? null;
    match = { by: "id", query: lawId, alternatives: [] };
  } else if (name) {
    const m = await findLawByName(db, name);
    id = m.match?.id ?? null;
    match = { by: m.matchType, query: name, alternatives: m.alternatives };
  } else {
    return { error: "يلزم law_id أو name" };
  }
  if (!id) return { error: "النظام غير موجود", match: { by: match.by, query: match.query, alternatives: match.alternatives.map((x) => ({ law_id: x.id, name: x.name })) } };
  // الفهرس لا يحتاج نص المواد، ولا فهرس أدوات الإصدار ولا ما ألغاه النظام في غيره (مسح جداول كاملة).
  const data = await getLawPageData(db, id, { asOf: opts.asOf, withText: false, withOutgoingRepeals: false, resolveRepealingSystems: false });
  if (!data) return { error: "النظام غير موجود" };
  return toMcpLaw(data, match, opts.siteUrl ?? "", { tocOffset: opts.tocOffset, tocLimit: opts.tocLimit, includePreamble: opts.includePreamble });
}
