/**
 * HKM-023-B — بيانات صفحة النظام الكاملة (دوال قراءة للعرض). يستعملها مطوّر القسم أ، وأداة MCP (hakeem_get_law).
 *
 * ── العقد ─────────────────────────────────────────────────────────────────────
 *   getLawPageData(db, systemId, { asOf?, withText?, withOutgoingRepeals?, resolveRepealingSystems? }) → LawPageData | null
 *     db: SqlClient (prismaSqlClient(prisma) في الإنتاج، pg في الاختبار). قراءة فقط.
 *     asOf: YYYY-MM-DD (افتراضيًا اليوم بتوقيت الرياض) لاشتقاق الحالة بالتاريخ والنص الساري.
 *     withText=false: لا يُقرأ نص أي مادة ولا نص نسخها (text/effectiveText = "")، والحالات كما هي. لمسار MCP والفهرس.
 *     withOutgoingRepeals=false وresolveRepealingSystems=false: لا مسح لجداول التحقق والبطاقات كلها (مسار MCP).
 *
 *   LawPageData
 *     system      المعرّف والاسم والـ slug وعدد المواد.
 *     card        البطاقة: الاسم الرسمي، النوع، المجال، الحالة (LawStatusView)، أدوات الإصدار (IssueInstrument[])،
 *                 التواريخ الأربعة (issued/published/effective/applied، هجري وميلادي ومصدر كلٍّ)، النبذة، المصدر الرسمي،
 *                 ما حلّ محله/ما حلّ محلّه (من وجه البحث)، وبيان إلغاء النظام إن كان ملغى.
 *                 الحقل الفارغ = null، ويعرضه الواجهة NOT_AVAILABLE («غير متوفر») لا يُخفى ولا يُخترع.
 *     preamble    PreambleView: kind = units (وحدات مهيكلة من preamble_edition) | source_blocks (كتل law_card من لقطة
 *                 هيئة الخبراء، لم تُفكَّك) | legacy_text (legal_systems.preamble بوسم «مقدمة غير مكتملة») | none
 *                 («المقدمة غير متوفرة» مع رابط المصدر الرسمي). legacy يُعاد دائمًا إن وُجد ولو اختير غيره.
 *     body        المتن: أقسام (divisions) بترتيب المواد، كل قسم عنوان الباب/الفصل كما في legal_articles.chapter
 *                 ومواده (ArticleView) بحالة كل مادة (ساري/معدّل/ملغى/مستبدل أو null = غير مؤكد) ومصدرها، وعدّادات.
 *                 «مستبدل» (HKM-030): تُعرض باهتة بنصها لا كملغاة (المعيار الواحد isReplacedStatus في verified-status).
 *     outgoingRepeals  ما ألغته أداة هذا النظام من مواد أنظمة أخرى (مشتق بمطابقة رقم الأداة وسنتها؛ derived=true).
 *
 * ── الحالات ────────────────────────────────────────────────────────────────────
 *   حالة النظام: من آخر سجل verification (object_type=work) بعد اشتقاق التاريخ من search_surface (workStatusAsOf)،
 *   ثم تُحوَّل إلى قائمة الهيئة الست (BOE_LAW_STATUSES) بلا اختراع؛ ما لا يقابله شيء منها = null.
 *   law_card.status_at_source يُعاد كما هو (atSource) ولا يُعتمد للعرض (قاعدة طبقة التحقق).
 *   حالة المادة: آخر سجل verification (object_type=unit)، ثم unit_version (معدّلة)، ثم حالة النظام (ملغى بالتبعية).
 *   «مكرر» (HKM-028، العمود articleBis): المادة المكررة صف مستقل بمفتاح articleKey (12 ← «12»، 12 مكرر ← «12_bis»)،
 *   ومرساتها art-<key> ورابطها /legal/<slug>/<key>، وترتيبها بعد أصلها. الصفوف غير المادية (articleBis ≥ 100) لا تُقرأ.
 *   لا جدول legal_effect في الإنتاج (تحقق 17/10/2026): repeal_type مشتق من الحالة (typeDerived=true)، وتاريخ نفاذ
 *   الإلغاء من وجه البحث أو من نص الأداة («— من YYYY-MM-DD») أو null.
 *
 * نقي عدا الاستعلامات عبر db. لا Prisma ولا كتابة. غياب جدول = سقوط آمن إلى «لا شيء».
 */
import { isMissingRelation, relationExists, type SqlClient } from "./sql-port";
import { parseInstrumentHeading, type InstrumentKind, type PreambleCompleteness, type PreambleUnitType } from "./preamble-parser";
import { classifyPreambleSignals, extractPreambleSignals } from "./preamble-signals";
import { computeSurface, todayRiyadh, unitStatusAsOf, workStatusAsOf, type SearchSurface } from "./search-surface";
import {
  citationFlagsFromVerification,
  effectiveDateFromEvidence,
  isRepealedStatus,
  isReplacedStatus,
  textAsOf,
  UNVERIFIED_NOTICE,
  type UnitVersionRecord,
  type VerificationRecord,
} from "./verified-status";
import { resolveWorkKind, type WorkKind } from "./work-kind";
import { resolveSystemSlug } from "./eli";
import { NON_ARTICLE_BIS, articleKey, articleLabel } from "./article-key";

// المعيار الواحد لحالتي الإلغاء والاستبدال ويوم النفاذ في verified-status (HKM-030)؛ يُعاد تصديره لمن استورده من هنا.
export { effectiveDateFromEvidence } from "./verified-status";

export const NOT_AVAILABLE = "غير متوفر";
export const PREAMBLE_INCOMPLETE_LABEL = "مقدمة غير مكتملة";
export const PREAMBLE_NONE_LABEL = "المقدمة غير متوفرة";
export const PREAMBLE_SOURCE_BLOCKS_LABEL = "نص المقدمة من لقطة هيئة الخبراء — لم يُفكَّك إلى وحدات بعد";

/** حالات النظام في بحث هيئة الخبراء (LawStatusId). لا حالة غيرها. */
export const BOE_LAW_STATUSES = ["مسودة", "تحت الإجراء", "ساري", "ساري خلال مدة", "لاغي خلال مدة", "لاغي"] as const;
export type BoeLawStatus = (typeof BOE_LAW_STATUSES)[number];

export type RepealType = "express_partial" | "replacement" | "express_total" | "implicit" | "temporal";
/** «مستبدل» حالة مستقلة (HKM-030، قرار المالك HKM-026/028): تُعرض باهتة بنصها لا كملغاة. */
export type ArticleStatus = "ساري" | "معدّل" | "ملغى" | "مستبدل";

export interface SystemRef {
  id: string;
  name: string;
  slug: string;
}

export interface DateValue {
  hijri: string | null;
  gregorian: string | null;
  source: "law_card" | "search_surface" | "verification_evidence" | "preamble_units" | "legal_system_issuance" | null;
}

export interface IssueInstrument {
  kind: InstrumentKind | null;
  text: string;
  number: string | null;
  dateHijri: string | null;
  source: "law_card" | "preamble_units" | "legal_system_issuance" | "legal_systems.preamble_royal_decree";
  url: string | null;
}

export interface LawStatusView {
  /** من القائمة الست فقط؛ null = «غير متوفر». */
  boe: BoeLawStatus | null;
  /** للعرض: boe أو «غير متوفر». */
  label: string;
  /** حالة سجل التحقق بعد اشتقاق التاريخ، أو null بلا سجل. */
  hakeem: string | null;
  /** حالة المصدر كما في بطاقة الهيئة (لا تُعتمد للعرض). */
  atSource: string | null;
  derivedByDate: boolean;
  evidence: { instrument: string | null; url: string | null; quote: string | null } | null;
  /** لـ«ساري/لاغي خلال مدة» فقط؛ لا بيانات مدة في الإنتاج بعد = null. */
  period: { from: string | null; to: string | null } | null;
}

export interface RepealInfo {
  type: RepealType | null;
  /** true = مشتق من الحالة (لا legal_effect مخزّن). */
  typeDerived: boolean;
  instrument: string | null;
  url: string | null;
  quote: string | null;
  /** يوم نفاذ الإلغاء YYYY-MM-DD أو null. */
  effectiveDate: string | null;
  effectiveDateSource: "search_surface" | "evidence_text" | null;
  /** النظام الذي ألغى/حلّ محل (مشتق بمطابقة رقم الأداة أو من وجه البحث). */
  repealingSystem: SystemRef | null;
  repealingSystemBasis: "search_surface" | "instrument_number" | null;
  /** المادة الملغية بعينها: لا يخزّنها الإنتاج بعد = null. */
  repealingArticle: { systemId: string; articleNumber: number } | null;
}

export interface LawCardView {
  name: string;
  officialName: string | null;
  kind: WorkKind | null;
  domain: string | null;
  status: LawStatusView;
  instruments: IssueInstrument[];
  dates: { issued: DateValue; published: DateValue; effective: DateValue; applied: DateValue };
  summary: string | null;
  officialSource: { name: string | null; url: string; retrievedOn: string | null } | null;
  replaces: SystemRef[];
  replacedBy: SystemRef | null;
  /** بيان إلغاء النظام كله (شريط الإلغاء)، أو null. */
  repeal: RepealInfo | null;
}

export interface PreambleUnitView {
  id: string;
  type: PreambleUnitType;
  ordinal: number;
  label: string | null;
  number: string | null;
  text: string;
  anchor: string | null;
  path: string;
}

export interface PreambleInstrumentView {
  index: number;
  kind: InstrumentKind | null;
  number: string | null;
  dateHijri: string | null;
  heading: string | null;
  anchor: string;
  units: PreambleUnitView[];
}

export interface LawCardBlockView {
  kind: string;
  heading: string | null;
  text: string;
}

export interface PreambleView {
  kind: "units" | "source_blocks" | "legacy_text" | "none";
  /** وسم العرض: null للوحدات؛ «مقدمة غير مكتملة» للنص القديم؛ «المقدمة غير متوفرة» لغيابها. */
  label: string | null;
  completeness: PreambleCompleteness | null;
  units: {
    editionId: string;
    source: { name: string; url: string; retrievedOn: string };
    rawSha256: string;
    /** وحدات خارج الأدوات (عنوان النظام وسنته قبلها، أو سطر بعدها) بترتيبها. */
    outside: PreambleUnitView[];
    instruments: PreambleInstrumentView[];
  } | null;
  sourceBlocks: { blocks: LawCardBlockView[]; sourceUrl: string; retrievedOn: string | null } | null;
  /** legal_systems.preamble كما هو (لا يُعدَّل)، مع تصنيفه. */
  /** bodyLeak: الحقل يحوي متن نظام أو ملحقًا لا مقدمة (إشارة متن، أو نص طويل بلا أي بنية مقدمة). */
  legacy: { text: string; chars: number; royalDecree: string | null; completeness: PreambleCompleteness; bodyLeak: boolean } | null;
  officialSourceUrl: string | null;
}

export interface ArticleView {
  id: string;
  number: number;
  /** درجة «مكرر» (0 للأصل). */
  bis: number;
  /** مفتاح المادة الفريد في النظام: «12» أو «12_bis» أو «12_bis2» (articleKey من HKM-028). */
  key: string;
  /** وسمها: «12» أو «12 مكرر». */
  label: string;
  title: string | null;
  /** عنوان العرض: العنوان المخزّن إن كان نصًا، وإلا «المادة N». */
  heading: string;
  chapter: string | null;
  /** النص المحفوظ في legal_articles.content كما ورد (لا يُعدَّل). */
  text: string;
  /** النص الساري بتاريخ asOf (unit_version)، = text إن لم تُعدَّل. */
  effectiveText: string;
  status: ArticleStatus | null;
  /** تسمية سجل التحقق أو «الحالة قيد التحقق من المصدر». */
  statusLabel: string;
  statusSource: "verification" | "unit_version" | "work_status" | null;
  /** ملغاة بتبعية إلغاء النظام كله. */
  inheritedFromWork: boolean;
  amendment: { versions: number; currentFrom: string | null; instrument: string | null; url: string | null; pendingFrom: string | null } | null;
  repeal: RepealInfo | null;
  /** إن كان asOf قبل نفاذ الإلغاء: يُعرض ساريًا مع «أُلغي لاحقًا في …». */
  repealedLaterOn: string | null;
  anchor: string;
  url: string;
}

export interface DivisionView {
  heading: string | null;
  articles: ArticleView[];
  allRepealed: boolean;
}

export interface OutgoingRepeal {
  articleId: string;
  systemId: string | null;
  systemName: string;
  articleNumber: number;
  articleBis: number;
  instrument: string | null;
  matchedOn: "instrument_number";
  derived: true;
}

export interface LawPageData {
  system: {
    id: string;
    name: string;
    slug: string;
    /** عدد المواد المعروضة (رقم > 0). */
    articleCount: number;
    /** العمود legal_systems.articleCount كما هو. */
    articleCountStored: number;
    classification: string | null;
    domainTitle: string | null;
    domain: string | null;
  };
  asOf: string;
  card: LawCardView;
  preamble: PreambleView;
  body: {
    divisions: DivisionView[];
    /** replaced: المواد المستبدلة (باهتة بنصها)، لا تُعدّ ضمن repealed. */
    counts: { total: number; inForce: number; amended: number; repealed: number; replaced: number; unverified: number };
  };
  outgoingRepeals: OutgoingRepeal[];
}

// ── أدوات صغيرة ─────────────────────────────────────────────────────────────

// التواريخ تُقرأ نصًا من SQL (::text) فلا تتأثر بمنطقة الخادم أو المشغّل؛ وDate من Prisma منتصف ليل UTC.
const day = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isMissingRelation(e)) return fallback;
    throw e;
  }
}

/** حالة سجل التحقق → قائمة الهيئة الست. ما لا يقابله شيء = null (بلا اختراع). */
export function toBoeStatus(hakeem: string | null): BoeLawStatus | null {
  switch (hakeem) {
    case "ساري":
    case "إلغاء جزئي معلّق على شرط":
      return "ساري";
    case "ملغى":
    case "مستبدل":
    case "ملغى مع بقاء أحكام محددة مؤقتًا":
      return "لاغي";
    default:
      return null; // «صادر لم يسرِ بعد»، «سجل مخلوط»، أو لا سجل
  }
}

/** مفتاح الأداة للمطابقة: الرقم بلا مسافات + السنة الهجرية. */
export function instrumentKey(text: string | null | undefined): string | null {
  if (!text) return null;
  const p = parseInstrumentHeading(text);
  if (!p.number || !p.dateHijri) return null;
  const num = p.number.replace(/[أإآ]/g, "ا");
  return `${num}|${p.dateHijri.split("/")[0]}`;
}

function kindFromLawCard(kind: string): InstrumentKind | null {
  if (kind === "royal_decree" || kind === "royal_order" || kind === "cabinet_decision") return kind;
  return kind ? "other" : null;
}

/** يقسم preamble_royal_decree («مرسوم … قرار مجلس الوزراء …») إلى أدوات. */
export function splitRoyalDecreeField(raw: string | null): string[] {
  const t = String(raw ?? "").trim();
  if (!t) return [];
  return t
    .split(/\s+(?=قرار\s+مجلس\s+الوزراء)/)
    .map((s) => s.replace(/[.\s]+$/, "").trim())
    .filter(Boolean);
}

function articleHeading(n: number, title: string | null, bis = 0): string {
  const t = (title ?? "").trim();
  return t && t !== String(n) ? t : `المادة ${articleLabel(n, bis, true)}`;
}

// ── القراءة ─────────────────────────────────────────────────────────────────

type SystemRow = {
  id: string;
  name: string;
  domain: string | null;
  domain_title: string | null;
  classification: string | null;
  articleCount: number;
  eli_slug: string | null;
  instrument_kind: string | null;
  preamble: string | null;
  preamble_royal_decree: string | null;
};

type VerRow = { object_id: string; id: string; verified_status: string; evidence_instrument: string | null; evidence_url: string | null; evidence_quote: string | null; verified_at: Date | string };

function mapVer(r: VerRow): VerificationRecord {
  return {
    id: r.id,
    verifiedStatus: r.verified_status,
    evidenceInstrument: r.evidence_instrument,
    evidenceUrl: r.evidence_url,
    evidenceQuote: r.evidence_quote,
    verifiedAt: new Date(r.verified_at).toISOString(),
  };
}

async function latestVerifications(db: SqlClient, objectType: "work" | "unit", ids: string[]): Promise<Map<string, VerificationRecord>> {
  const out = new Map<string, VerificationRecord>();
  if (!ids.length) return out;
  const rows = await safe(
    () =>
      db.query<VerRow>(
        `SELECT DISTINCT ON (object_id) object_id, id, verified_status, evidence_instrument, evidence_url, evidence_quote, verified_at
           FROM verification WHERE object_type = $1 AND object_id = ANY($2::text[])
          ORDER BY object_id, verified_at DESC, id DESC`,
        [objectType, ids],
      ),
    [] as VerRow[],
  );
  for (const r of rows) out.set(r.object_id, mapVer(r));
  return out;
}

async function loadSurface(db: SqlClient, asOf: string): Promise<{ surface: SearchSurface; rows: Array<{ workKey: string; surfaceSystemId: string | null; validOn: string }>; members: Array<{ workKey: string; systemId: string; role: string }> }> {
  const rows = await safe(
    () => db.query<{ id: string; work_key: string; surface_system_id: string | null; valid_on: Date | string; created_at: Date | string }>(
      `SELECT id, work_key, surface_system_id, valid_on::text AS valid_on, created_at FROM search_surface`,
    ),
    [],
  );
  const members = await safe(() => db.query<{ work_key: string; system_id: string; role: string }>(`SELECT work_key, system_id, role FROM search_surface_member`), []);
  const mapped = rows.map((r) => ({
    id: r.id,
    workKey: r.work_key,
    surfaceSystemId: r.surface_system_id,
    validOn: typeof r.valid_on === "string" ? r.valid_on.slice(0, 10) : day(r.valid_on) ?? "",
    createdAt: new Date(r.created_at).toISOString(),
  }));
  const mem = members.map((m) => ({ workKey: m.work_key, systemId: m.system_id, role: m.role }));
  return { surface: computeSurface(mapped, mem, asOf), rows: mapped, members: mem };
}

async function systemRefs(db: SqlClient, ids: string[]): Promise<Map<string, SystemRef>> {
  const out = new Map<string, SystemRef>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return out;
  const rows = await db.query<{ id: string; name: string; eli_slug: string | null }>(`SELECT id, name, eli_slug FROM legal_systems WHERE id = ANY($1::text[])`, [uniq]);
  for (const r of rows) out.set(r.id, { id: r.id, name: r.name, slug: resolveSystemSlug(r.eli_slug, r.name) });
  return out;
}

/** فهرس أدوات الإصدار لكل الأنظمة (law_card ثم preamble_royal_decree) لعكس «ألغيت بموجب …» إلى نظامها. */
async function instrumentIndex(db: SqlClient): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const cards = await safe(
    () => db.query<{ system_id: string; instruments: unknown }>(`SELECT DISTINCT ON (system_id) system_id, instruments FROM law_card ORDER BY system_id, created_at DESC, id DESC`),
    [],
  );
  for (const c of cards) {
    const arr = Array.isArray(c.instruments) ? (c.instruments as Array<{ text?: string }>) : [];
    for (const i of arr) {
      const k = instrumentKey(i.text ?? null);
      if (k && !index.has(k)) index.set(k, c.system_id);
    }
  }
  const legacy = await db.query<{ id: string; preamble_royal_decree: string | null }>(`SELECT id, preamble_royal_decree FROM legal_systems WHERE preamble_royal_decree IS NOT NULL`);
  for (const r of legacy) {
    for (const part of splitRoyalDecreeField(r.preamble_royal_decree)) {
      const k = instrumentKey(part);
      if (k && !index.has(k)) index.set(k, r.id);
    }
  }
  return index;
}

type PreambleUnitRow = {
  id: string;
  edition_id: string;
  unit_type: PreambleUnitType;
  ordinal: number;
  instrument_index: number | null;
  instrument_kind: InstrumentKind | null;
  instrument_number: string | null;
  instrument_date_hijri: string | null;
  label_ar: string | null;
  number: string | null;
  text_raw: string;
  path: string;
  anchor: string | null;
};

type LoadedPreambleUnits = NonNullable<PreambleView["units"]> & { completeness: PreambleCompleteness };

async function loadPreambleUnits(db: SqlClient, systemId: string): Promise<LoadedPreambleUnits | null> {
  if (!(await relationExists(db, "preamble_edition"))) return null;
  const editions = await safe(
    () => db.query<{ id: string; source_name: string; source_url: string; source_retrieved_on: Date | string; raw_sha256: string; completeness: PreambleCompleteness }>(
      `SELECT id, source_name, source_url, source_retrieved_on::text AS source_retrieved_on, raw_sha256, completeness
         FROM preamble_edition WHERE system_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [systemId],
    ),
    [],
  );
  const e = editions[0];
  if (!e) return null;
  const units = await db.query<PreambleUnitRow>(
    `SELECT id, edition_id, unit_type, ordinal, instrument_index, instrument_kind, instrument_number, instrument_date_hijri,
            label_ar, number, text_raw, path, anchor
       FROM preamble_unit WHERE edition_id = $1 ORDER BY ordinal`,
    [e.id],
  );
  const view = (u: PreambleUnitRow): PreambleUnitView => ({ id: u.id, type: u.unit_type, ordinal: u.ordinal, label: u.label_ar, number: u.number, text: u.text_raw, anchor: u.anchor, path: u.path });
  const instruments: PreambleInstrumentView[] = units
    .filter((u) => u.unit_type === "issuing_instrument")
    .map((p) => ({
      index: p.instrument_index ?? 0,
      kind: p.instrument_kind,
      number: p.instrument_number,
      dateHijri: p.instrument_date_hijri,
      heading: p.label_ar,
      anchor: p.anchor ?? `preamble-i${p.instrument_index}`,
      units: units.filter((u) => u.unit_type !== "issuing_instrument" && u.instrument_index === p.instrument_index).map(view),
    }));
  return {
    editionId: e.id,
    source: { name: e.source_name, url: e.source_url, retrievedOn: day(e.source_retrieved_on) ?? "" },
    rawSha256: e.raw_sha256,
    outside: units.filter((u) => u.unit_type !== "issuing_instrument" && u.instrument_index === null).map(view),
    instruments,
    completeness: e.completeness,
  };
}

/** بيانات صفحة النظام كاملة. null إن لم يوجد النظام. */
export interface LawPageDataOptions {
  asOf?: string;
  /** false: بلا نص المواد ونسخها (الحالات كما هي). الافتراض true. */
  withText?: boolean;
  /** false: بلا outgoingRepeals (يمسح كل سجلات التحقق). الافتراض true. */
  withOutgoingRepeals?: boolean;
  /** false: بلا فهرس أدوات الإصدار (يمسح law_card وlegal_systems)، فلا repealingSystem للمادة. الافتراض true. */
  resolveRepealingSystems?: boolean;
}

export async function getLawPageData(db: SqlClient, systemId: string, opts: LawPageDataOptions = {}): Promise<LawPageData | null> {
  const withText = opts.withText !== false;
  const asOf = opts.asOf && /^\d{4}-\d{2}-\d{2}$/.test(opts.asOf) ? opts.asOf : todayRiyadh();
  const asOfDate = new Date(`${asOf}T12:00:00Z`);
  const sys = (
    await db.query<SystemRow>(
      `SELECT id, name, domain, domain_title, classification, "articleCount", eli_slug, instrument_kind, preamble, preamble_royal_decree
         FROM legal_systems WHERE id = $1`,
      [systemId],
    )
  )[0];
  if (!sys) return null;
  const slug = resolveSystemSlug(sys.eli_slug, sys.name);

  const [cardRow, issuance, articles, surfaceState, workVer, preambleUnits] = await Promise.all([
    safe(
      () =>
        db.query<{
          official_name: string;
          summary: string | null;
          issued_hijri: string | null;
          issued_gregorian: Date | string | null;
          published_hijri: string | null;
          published_gregorian: Date | string | null;
          status_at_source: string | null;
          instruments: unknown;
          text_blocks: unknown;
          source_name: string;
          source_url: string;
          retrieved_on: Date | string | null;
        }>(
          `SELECT official_name, summary, issued_hijri, issued_gregorian::text AS issued_gregorian, published_hijri,
                  published_gregorian::text AS published_gregorian, status_at_source,
                  instruments, text_blocks, source_name, source_url, retrieved_on::text AS retrieved_on
             FROM law_card WHERE system_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
          [systemId],
        ),
      [],
    ).then((r) => r[0] ?? null),
    safe(
      () => db.query<{ instrument: string | null; issue_date_hijri: string | null; issue_date_greg: Date | string | null; source_url: string | null }>(
        `SELECT instrument, issue_date_hijri, issue_date_greg::text AS issue_date_greg, source_url FROM legal_system_issuance WHERE system_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [systemId],
      ),
      [],
    ).then((r) => r[0] ?? null),
    db.query<{ id: string; articleNumber: number; articleBis: number; title: string | null; content: string; chapter: string | null }>(
      `SELECT id, "articleNumber", "articleBis", title, ${withText ? "content" : "''::text AS content"}, chapter FROM legal_articles
        WHERE ("legalSystemId" = $1 OR ("legalSystemId" IS NULL AND "lawName" = $2)) AND "articleNumber" > 0 AND "articleBis" < $3
        ORDER BY "articleNumber", "articleBis", id`,
      [systemId, sys.name, NON_ARTICLE_BIS],
    ),
    loadSurface(db, asOf),
    latestVerifications(db, "work", [systemId]).then((m) => m.get(systemId) ?? null),
    loadPreambleUnits(db, systemId),
  ]);

  // ── الحالة ──
  const recorded = citationFlagsFromVerification(workVer);
  const hakeemRecorded = workVer ? recorded.statusLabel : null;
  const derived = hakeemRecorded ? workStatusAsOf(systemId, hakeemRecorded, surfaceState.surface) : { status: "", replacedBy: null, derived: false };
  const hakeem = hakeemRecorded ? derived.status : null;
  const boe = toBoeStatus(hakeem);
  const status: LawStatusView = {
    boe,
    label: boe ?? NOT_AVAILABLE,
    hakeem,
    atSource: cardRow?.status_at_source ?? null,
    derivedByDate: derived.derived,
    evidence: workVer ? { instrument: workVer.evidenceInstrument, url: workVer.evidenceUrl, quote: workVer.evidenceQuote } : null,
    period: null,
  };

  // ── وجه البحث: الإحلال ──
  const redirect = surfaceState.surface.hidden.has(systemId) ? surfaceState.surface.redirect.get(systemId) ?? null : derived.replacedBy;
  const myWorks = surfaceState.members.filter((m) => m.systemId === systemId).map((m) => m.workKey);
  const facesFor = new Set([...surfaceState.surface.current.entries()].filter(([, id]) => id === systemId).map(([k]) => k));
  const replacesIds = surfaceState.members
    .filter((m) => facesFor.has(m.workKey) && m.systemId !== systemId && (m.role === "edition_old" || m.role === "retired"))
    .map((m) => m.systemId);
  // يوم صار البديل وجهًا = يوم نفاذ الإحلال.
  const successorFrom = redirect
    ? surfaceState.rows.filter((r) => r.surfaceSystemId === redirect && myWorks.includes(r.workKey) && r.validOn <= asOf).map((r) => r.validOn).sort().pop() ?? null
    : null;
  const ownFaceFrom = surfaceState.rows.filter((r) => r.surfaceSystemId === systemId).map((r) => r.validOn).sort()[0] ?? null;

  const refs = await systemRefs(db, [...replacesIds, redirect ?? ""]);

  // ── أدوات الإصدار ──
  const instruments: IssueInstrument[] = [];
  const lcInstr = Array.isArray(cardRow?.instruments) ? (cardRow?.instruments as Array<{ kind?: string; text?: string }>) : [];
  for (const i of lcInstr) {
    if (!i.text) continue;
    const p = parseInstrumentHeading(i.text);
    instruments.push({ kind: kindFromLawCard(i.kind ?? "") ?? p.kind, text: i.text, number: p.number, dateHijri: p.dateHijri, source: "law_card", url: cardRow?.source_url ?? null });
  }
  if (!instruments.length && preambleUnits) {
    for (const i of preambleUnits.instruments) {
      instruments.push({ kind: i.kind, text: i.heading ?? "", number: i.number, dateHijri: i.dateHijri, source: "preamble_units", url: preambleUnits.source.url });
    }
  }
  if (!instruments.length && issuance?.instrument) {
    const p = parseInstrumentHeading(issuance.instrument);
    instruments.push({ kind: p.kind, text: issuance.instrument, number: p.number, dateHijri: p.dateHijri ?? issuance.issue_date_hijri, source: "legal_system_issuance", url: issuance.source_url });
  }
  if (!instruments.length) {
    for (const part of splitRoyalDecreeField(sys.preamble_royal_decree)) {
      const p = parseInstrumentHeading(part);
      instruments.push({ kind: p.kind, text: part, number: p.number, dateHijri: p.dateHijri, source: "legal_systems.preamble_royal_decree", url: null });
    }
  }

  // ── التواريخ الأربعة ──
  const empty: DateValue = { hijri: null, gregorian: null, source: null };
  let issued: DateValue = empty;
  if (cardRow?.issued_hijri || cardRow?.issued_gregorian) issued = { hijri: cardRow.issued_hijri, gregorian: day(cardRow.issued_gregorian), source: "law_card" };
  else if (preambleUnits?.instruments[0]?.dateHijri) issued = { hijri: preambleUnits.instruments[0].dateHijri, gregorian: null, source: "preamble_units" };
  else if (issuance?.issue_date_hijri || issuance?.issue_date_greg) issued = { hijri: issuance.issue_date_hijri, gregorian: day(issuance.issue_date_greg), source: "legal_system_issuance" };
  const published: DateValue = cardRow?.published_hijri || cardRow?.published_gregorian ? { hijri: cardRow.published_hijri, gregorian: day(cardRow.published_gregorian), source: "law_card" } : empty;
  let effective: DateValue = empty;
  if (ownFaceFrom) effective = { hijri: null, gregorian: ownFaceFrom, source: "search_surface" };

  // ── بيان إلغاء النظام ──
  const repealedWork = hakeem === "ملغى" || hakeem === "مستبدل" || hakeem === "ملغى مع بقاء أحكام محددة مؤقتًا";
  let workRepeal: RepealInfo | null = null;
  if (repealedWork) {
    const evDate = effectiveDateFromEvidence(workVer?.evidenceInstrument ?? null);
    workRepeal = {
      type: hakeem === "مستبدل" || redirect ? "replacement" : "express_total",
      typeDerived: true,
      instrument: workVer?.evidenceInstrument ?? null,
      url: workVer?.evidenceUrl ?? null,
      quote: workVer?.evidenceQuote ?? null,
      effectiveDate: successorFrom ?? evDate,
      effectiveDateSource: successorFrom ? "search_surface" : evDate ? "evidence_text" : null,
      repealingSystem: redirect ? refs.get(redirect) ?? null : null,
      repealingSystemBasis: redirect ? "search_surface" : null,
      repealingArticle: null,
    };
  }

  // ── المتن ──
  const ids = articles.map((a) => a.id);
  const [unitVer, versionsRows, idx] = await Promise.all([
    latestVerifications(db, "unit", ids),
    ids.length
      ? safe(
          () => db.query<{ id: string; unit_id: string; body: string; valid_from: Date | string; evidence_instrument: string | null; evidence_url: string | null }>(
            `SELECT id, unit_id, ${withText ? "body" : "''::text AS body"}, to_char(valid_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS valid_from, evidence_instrument, evidence_url
               FROM unit_version WHERE unit_id = ANY($1::text[]) ORDER BY unit_id, valid_from`,
            [ids],
          ),
          [],
        )
      : Promise.resolve([]),
    opts.resolveRepealingSystems === false ? Promise.resolve(new Map<string, string>()) : instrumentIndex(db),
  ]);
  const versions = new Map<string, UnitVersionRecord[]>();
  for (const v of versionsRows) {
    const list = versions.get(v.unit_id) ?? [];
    list.push({ id: v.id, body: v.body, validFrom: new Date(v.valid_from).toISOString(), evidenceInstrument: v.evidence_instrument, evidenceUrl: v.evidence_url });
    versions.set(v.unit_id, list);
  }
  const repealerIds = new Set<string>();
  for (const v of unitVer.values()) {
    const k = instrumentKey(v.evidenceInstrument);
    const sid = k ? idx.get(k) : undefined;
    if (sid) repealerIds.add(sid);
  }
  const repealerRefs = await systemRefs(db, [...repealerIds]);

  const counts = { total: 0, inForce: 0, amended: 0, repealed: 0, replaced: 0, unverified: 0 };
  const articleViews: ArticleView[] = articles.map((a) => {
    const rec = unitVer.get(a.id) ?? null;
    const label = rec ? unitStatusAsOf(rec.verifiedStatus, { status: derived.status, derived: derived.derived }) : null;
    const vs = versions.get(a.id) ?? [];
    const picked = textAsOf(a.content, vs, asOfDate);
    const future = vs.filter((v) => v.validFrom.slice(0, 10) > asOf).map((v) => v.validFrom.slice(0, 10)).sort()[0] ?? null;
    let status: ArticleStatus | null = null;
    let statusSource: ArticleView["statusSource"] = null;
    let statusLabel = label ?? UNVERIFIED_NOTICE;
    let repeal: RepealInfo | null = null;
    let inherited = false;
    let repealedLaterOn: string | null = null;

    // الملغاة والمستبدلة بالمعيار الواحد (verified-status): المستبدلة حالة مستقلة تُعرض باهتة بنصها (HKM-030).
    if (isRepealedStatus(label) || isReplacedStatus(label)) {
      const evDate = effectiveDateFromEvidence(rec?.evidenceInstrument ?? null);
      const k = instrumentKey(rec?.evidenceInstrument ?? null);
      const sid = k ? idx.get(k) ?? null : null;
      repeal = {
        type: isReplacedStatus(label) ? "replacement" : "express_partial",
        typeDerived: true,
        instrument: rec?.evidenceInstrument ?? null,
        url: rec?.evidenceUrl ?? null,
        quote: rec?.evidenceQuote ?? null,
        effectiveDate: evDate,
        effectiveDateSource: evDate ? "evidence_text" : null,
        repealingSystem: sid && sid !== systemId ? repealerRefs.get(sid) ?? null : null,
        repealingSystemBasis: sid && sid !== systemId ? "instrument_number" : null,
        repealingArticle: null,
      };
      if (evDate && asOf < evDate) {
        repealedLaterOn = evDate;
        status = vs.some((v) => v.validFrom.slice(0, 10) <= asOf) ? "معدّل" : "ساري";
        statusSource = "verification";
      } else {
        status = isReplacedStatus(label) ? "مستبدل" : "ملغى";
        statusSource = "verification";
      }
    } else if (repealedWork) {
      status = "ملغى";
      statusSource = "work_status";
      inherited = true;
      statusLabel = hakeem ?? statusLabel;
      repeal = workRepeal;
    } else if (picked.version) {
      status = "معدّل";
      statusSource = "unit_version";
      if (!label) statusLabel = "معدّلة";
    } else if (label === "ساري" || label === "مضافة") {
      status = "ساري";
      statusSource = "verification";
    }

    counts.total++;
    if (status === "ساري") counts.inForce++;
    else if (status === "معدّل") counts.amended++;
    else if (status === "ملغى") counts.repealed++;
    else if (status === "مستبدل") counts.replaced++;
    else counts.unverified++;

    const bis = Number(a.articleBis) || 0;
    const key = articleKey(a.articleNumber, bis);
    return {
      id: a.id,
      number: a.articleNumber,
      bis,
      key,
      label: articleLabel(a.articleNumber, bis),
      title: a.title,
      heading: articleHeading(a.articleNumber, a.title, bis),
      chapter: a.chapter,
      text: a.content,
      effectiveText: picked.text,
      status,
      statusLabel,
      statusSource,
      inheritedFromWork: inherited,
      amendment: vs.length
        ? {
            versions: vs.length,
            currentFrom: picked.version ? picked.version.validFrom.slice(0, 10) : null,
            instrument: picked.version?.evidenceInstrument ?? null,
            url: picked.version?.evidenceUrl ?? null,
            pendingFrom: future,
          }
        : null,
      repeal,
      repealedLaterOn,
      anchor: `art-${key}`,
      url: `/legal/${encodeURIComponent(slug)}/${key}`,
    };
  });

  const divisions: DivisionView[] = [];
  for (const a of articleViews) {
    const head = a.chapter?.trim() || null;
    const last = divisions[divisions.length - 1];
    if (last && last.heading === head) last.articles.push(a);
    else divisions.push({ heading: head, articles: [a], allRepealed: false });
  }
  for (const d of divisions) d.allRepealed = d.articles.length > 0 && d.articles.every((a) => a.status === "ملغى" && !a.inheritedFromWork);

  // ── ما ألغته أداة هذا النظام (الاتجاه الآخر، مشتق) ──
  const myKeys = new Set(instruments.map((i) => instrumentKey(i.text)).filter((k): k is string => Boolean(k)));
  let outgoingRepeals: OutgoingRepeal[] = [];
  if (myKeys.size && opts.withOutgoingRepeals !== false) {
    const rows = await safe(
      () => db.query<{ object_id: string; evidence_instrument: string | null; articleNumber: number; articleBis: number; legalSystemId: string | null; lawName: string; system_name: string | null }>(
        `WITH v AS (
           SELECT DISTINCT ON (object_id) object_id, verified_status, evidence_instrument
             FROM verification WHERE object_type = 'unit' ORDER BY object_id, verified_at DESC, id DESC)
         SELECT v.object_id, v.evidence_instrument, a."articleNumber", a."articleBis", a."legalSystemId", a."lawName", s.name AS system_name
           FROM v JOIN legal_articles a ON a.id = v.object_id LEFT JOIN legal_systems s ON s.id = a."legalSystemId"
          WHERE v.verified_status IN ('ملغاة', 'ملغى') AND v.evidence_instrument IS NOT NULL AND a."articleBis" < $1`,
        [NON_ARTICLE_BIS],
      ),
      [],
    );
    outgoingRepeals = rows
      .filter((r) => r.legalSystemId !== systemId && myKeys.has(instrumentKey(r.evidence_instrument) ?? ""))
      .map((r) => ({ articleId: r.object_id, systemId: r.legalSystemId, systemName: r.system_name ?? r.lawName, articleNumber: r.articleNumber, articleBis: Number(r.articleBis) || 0, instrument: r.evidence_instrument, matchedOn: "instrument_number" as const, derived: true as const }))
      .sort((a, b) => a.systemName.localeCompare(b.systemName, "ar") || a.articleNumber - b.articleNumber || a.articleBis - b.articleBis);
  }

  // ── المقدمة ──
  const legacyText = sys.preamble && sys.preamble.trim() ? sys.preamble : null;
  const legacyClass = legacyText ? classifyPreambleSignals(extractPreambleSignals(legacyText), legacyText.length) : null;
  const legacy = legacyText && legacyClass
    ? { text: legacyText, chars: legacyText.length, royalDecree: sys.preamble_royal_decree, completeness: legacyClass.completeness, bodyLeak: legacyClass.bodyLeak }
    : null;
  const blocks = (Array.isArray(cardRow?.text_blocks) ? (cardRow?.text_blocks as Array<{ kind?: string; heading?: string | null; text?: string }>) : [])
    .filter((b) => typeof b.text === "string" && b.kind !== "law_title")
    .map((b) => ({ kind: String(b.kind ?? ""), heading: b.heading ?? null, text: String(b.text) }));
  const hasInstrumentBlock = blocks.some((b) => b.kind === "royal_decree" || b.kind === "cabinet_decision" || b.kind === "royal_order");
  const officialSourceUrl = preambleUnits?.source.url ?? cardRow?.source_url ?? issuance?.source_url ?? null;
  let preamble: PreambleView;
  if (preambleUnits) {
    const { completeness, ...units } = preambleUnits;
    preamble = { kind: "units", label: null, completeness, units, sourceBlocks: null, legacy, officialSourceUrl };
  } else if (hasInstrumentBlock && cardRow) {
    const composed = blocks.map((b) => (b.heading ? `${b.heading}\n${b.text}` : b.text)).join("\n");
    preamble = {
      kind: "source_blocks",
      label: PREAMBLE_SOURCE_BLOCKS_LABEL,
      completeness: classifyPreambleSignals(extractPreambleSignals(composed), composed.length).completeness,
      units: null,
      sourceBlocks: { blocks, sourceUrl: cardRow.source_url, retrievedOn: day(cardRow.retrieved_on) },
      legacy,
      officialSourceUrl,
    };
  } else if (legacy) {
    preamble = { kind: "legacy_text", label: PREAMBLE_INCOMPLETE_LABEL, completeness: legacy.completeness, units: null, sourceBlocks: null, legacy, officialSourceUrl };
  } else {
    preamble = { kind: "none", label: PREAMBLE_NONE_LABEL, completeness: null, units: null, sourceBlocks: null, legacy: null, officialSourceUrl };
  }

  const card: LawCardView = {
    name: sys.name,
    officialName: cardRow?.official_name ?? null,
    kind: resolveWorkKind(sys.name, sys.instrument_kind),
    domain: sys.domain_title ?? sys.classification ?? sys.domain ?? null,
    status,
    instruments,
    dates: { issued, published, effective, applied: empty },
    summary: cardRow?.summary ?? null,
    officialSource: cardRow ? { name: cardRow.source_name, url: cardRow.source_url, retrievedOn: day(cardRow.retrieved_on) } : preambleUnits ? { name: preambleUnits.source.name, url: preambleUnits.source.url, retrievedOn: preambleUnits.source.retrievedOn } : issuance?.source_url ? { name: null, url: issuance.source_url, retrievedOn: null } : null,
    replaces: replacesIds.map((id) => refs.get(id)).filter((r): r is SystemRef => Boolean(r)),
    replacedBy: redirect ? refs.get(redirect) ?? null : null,
    repeal: workRepeal,
  };

  return {
    system: {
      id: sys.id,
      name: sys.name,
      slug,
      articleCount: articles.length,
      articleCountStored: Number(sys.articleCount) || 0,
      classification: sys.classification,
      domainTitle: sys.domain_title,
      domain: sys.domain,
    },
    asOf,
    card,
    preamble,
    body: { divisions, counts },
    outgoingRepeals,
  };
}
