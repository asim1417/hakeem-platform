/**
 * hakeem_get_law (HKM-023-B ع-١٣) — بطاقة النظام وفهرسه فوق getLawPageData.
 *
 * العقد إضافي: الحقول القديمة كلها باقية بأسمائها (law_id، name، classification، issue_instrument، issue_date_h،
 * status، articles_count، toc[{article_id، number، title}]). ما كان null ثابتًا صار يُملأ إن توفرت بياناته:
 *   issue_instrument = نص أول أداة إصدار؛ issue_date_h = تاريخ الإصدار الهجري؛ status = حالة النظام من قائمة الهيئة
 *   الست (أو null إن لم تقابلها حالة موثّقة).
 * المضاف: match (طريقة المطابقة والبدائل)، official_name، kind، status_detail، issue_instruments[]، dates (الأربعة)،
 *   replaced_by/replaces/repeal، preamble (وحدات أو نص مع وسم الاكتمال)، counts، url، ولكل مادة في toc:
 *   status، status_label، status_source، repealed_by، repeal_type، repeal_effective_date، url.
 * لا Prisma هنا (SqlClient)، ليُختبر على قاعدة محلية.
 */
import { getLawPageData, type LawPageData, type RepealInfo } from "../../modules/legal-core/law-page-data";
import { findLawByName, type LawMatchType } from "../../modules/legal-core/law-name-match";
import type { SqlClient } from "../../modules/legal-core/sql-port";

/** سقف نص المقدمة في مخرج الأداة (المقدمات المتسرّب إليها متن قد تبلغ 178 ألف حرف). */
export const MCP_PREAMBLE_MAX_CHARS = 12_000;

export interface GetLawInput {
  lawId?: string;
  name?: string;
}

const repealOut = (r: RepealInfo | null) =>
  r
    ? {
        type: r.type,
        type_derived: r.typeDerived,
        instrument: r.instrument,
        url: r.url,
        effective_date: r.effectiveDate,
        repealing_law: r.repealingSystem ? { law_id: r.repealingSystem.id, name: r.repealingSystem.name } : null,
      }
    : null;

function preambleOut(data: LawPageData) {
  const p = data.preamble;
  const base = {
    kind: p.kind,
    label: p.label,
    completeness: p.completeness,
    complete: p.kind === "units" && p.completeness === "complete",
    source_url: p.officialSourceUrl,
  };
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
  return {
    ...base,
    text: full ? full.slice(0, MCP_PREAMBLE_MAX_CHARS) : null,
    truncated: full.length > MCP_PREAMBLE_MAX_CHARS,
    chars: full.length,
  };
}

/** يحوّل بيانات الصفحة إلى مخرج الأداة. نقي. */
export function toMcpLaw(data: LawPageData, match: { by: LawMatchType; query: string | null; alternatives: Array<{ id: string; name: string }> }, siteUrl = "") {
  const card = data.card;
  const first = card.instruments[0] ?? null;
  const articles = data.body.divisions.flatMap((d) => d.articles);
  return {
    law_id: data.system.id,
    name: data.system.name,
    classification: data.system.classification ?? data.system.domainTitle ?? data.system.domain ?? null,
    issue_instrument: first?.text ?? null,
    issue_date_h: card.dates.issued.hijri ?? first?.dateHijri ?? null,
    status: card.status.boe,
    articles_count: data.system.articleCountStored || articles.length,
    toc: articles.map((a) => ({
      article_id: a.id,
      number: a.number,
      title: a.title,
      status: a.status,
      status_label: a.statusLabel,
      status_source: a.statusSource,
      repealed_by: a.repeal?.instrument ?? null,
      repeal_type: a.repeal?.type ?? null,
      repeal_effective_date: a.repeal?.effectiveDate ?? null,
      url: `${siteUrl}${a.url}`,
    })),
    match: { by: match.by, query: match.query, alternatives: match.alternatives.map((x) => ({ law_id: x.id, name: x.name })) },
    official_name: card.officialName,
    kind: card.kind,
    status_detail: {
      boe: card.status.boe,
      label: card.status.label,
      hakeem: card.status.hakeem,
      at_source: card.status.atSource,
      derived_by_date: card.status.derivedByDate,
      evidence_instrument: card.status.evidence?.instrument ?? null,
      evidence_url: card.status.evidence?.url ?? null,
    },
    issue_instruments: card.instruments.map((i) => ({ kind: i.kind, text: i.text, number: i.number, date_h: i.dateHijri, source: i.source })),
    dates: card.dates,
    replaced_by: card.replacedBy ? { law_id: card.replacedBy.id, name: card.replacedBy.name } : null,
    replaces: card.replaces.map((r) => ({ law_id: r.id, name: r.name })),
    repeal: repealOut(card.repeal),
    preamble: preambleOut(data),
    counts: data.body.counts,
    url: `${siteUrl}/legal/${encodeURIComponent(data.system.slug)}`,
    as_of: data.asOf,
  };
}

/** الأداة: المعرّف أولًا، وإلا المطابقة بالاسم (تامة ← يبدأ بـ ← احتواء). */
export async function getLawTool(db: SqlClient, input: GetLawInput, opts: { asOf?: string; siteUrl?: string } = {}) {
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
  const data = await getLawPageData(db, id, { asOf: opts.asOf });
  if (!data) return { error: "النظام غير موجود" };
  return toMcpLaw(data, match, opts.siteUrl ?? "");
}
