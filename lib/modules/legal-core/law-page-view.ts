/**
 * HKM-023-B (القسم أ، العرض) — دوال نقية تحوّل LawPageData إلى ما تعرضه صفحة النظام `/law/<معرّف>`.
 * لا React ولا قاعدة ولا متصفح، فتُختبر مباشرة (scripts/test-law-page-view.ts، اختبارات U-*).
 * المرجع: مواصفة المصمم design-review/law-page-spec.md (§٥ الطباعة، §٧ المكونات، §١٢ القبول).
 */
import type { ArticleStatus, ArticleView, BoeLawStatus, LawPageData, PreambleView, RepealInfo, RepealType } from "./law-page-data";
import { NOT_AVAILABLE, PREAMBLE_INCOMPLETE_LABEL, PREAMBLE_NONE_LABEL } from "./law-page-data";

// ── الروابط الدائمة (ع-١٥) ─────────────────────────────────────────────────────
// المعرّف الدائم بأداة الإصدار (m-43-1443) لم يُخزَّن بعد؛ المواصفة §١: «يُعرض على /law/<eliSlug> مؤقتًا».
export const lawPath = (id: string) => `/law/${encodeURIComponent(id)}`;
export const articlePath = (id: string, n: number) => `${lawPath(id)}/art/${n}`;
/** مرساة المادة بمفتاحها (`103` للأصل، `103_bis` للمكرر — HKM-028)، أو برقمها للإحالة إلى الأصل. */
export const articleAnchor = (key: number | string) => `art-${key}`;

/** «كما في تاريخ»: يُقبل asof (كنسي) وasOf (القائم)، بصيغة YYYY-MM-DD فقط. */
export function parseAsOfParam(sp: Record<string, string | string[] | undefined> | undefined): string | null {
  const raw = sp?.asof ?? sp?.asOf;
  const v = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// ── البطاقة (ع-٢) ──────────────────────────────────────────────────────────────
export const orNA = (v: string | null | undefined): string => (v && v.trim() ? v : NOT_AVAILABLE);

export type StatusTone = "inforce" | "repealed" | "pending" | "draft";
/** الحالات الست وحدها لها شارة؛ غيرها (null) يُعرض «غير متوفر» بلا شارة. */
export function statusTone(boe: BoeLawStatus | null): StatusTone | null {
  switch (boe) {
    case "ساري":
    case "ساري خلال مدة":
      return "inforce";
    case "لاغي":
    case "لاغي خلال مدة":
      return "repealed";
    case "تحت الإجراء":
      return "pending";
    case "مسودة":
      return "draft";
    default:
      return null;
  }
}

/** «خلال مدة» يُعرض معها سطر المدة؛ غياب طرف = «غير متوفر». */
export function statusRangeLine(boe: BoeLawStatus | null, period: { from: string | null; to: string | null } | null): string | null {
  if (boe !== "ساري خلال مدة" && boe !== "لاغي خلال مدة") return null;
  return `من ${orNA(period?.from)} إلى ${orNA(period?.to)}`;
}

// ── العدّ والصيغ (§٥) ──────────────────────────────────────────────────────────
export const arNum = (n: number) => n.toLocaleString("ar-SA");
/** «مادة واحدة»، «مادتان»، «٣ مواد»، «١١ مادة»، «لا مواد منشورة». */
export function articlesPhrase(n: number): string {
  if (n <= 0) return "لا مواد منشورة";
  if (n === 1) return "مادة واحدة";
  if (n === 2) return "مادتان";
  if (n % 100 >= 3 && n % 100 <= 10) return `${arNum(n)} مواد`;
  return `${arNum(n)} مادة`;
}

// ── المرشحات (ع-٣) ────────────────────────────────────────────────────────────
export type LawFilter = "all" | "amended" | "repealed" | "live";
export const LAW_FILTERS: ReadonlyArray<{ id: LawFilter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "amended", label: "المعدّل فقط" },
  { id: "repealed", label: "الملغى فقط" },
  { id: "live", label: "إخفاء الملغى" },
];
export const parseFilter = (v: string | null | undefined): LawFilter => (v === "amended" || v === "repealed" || v === "live" ? v : "all");

/** حالة العرض للمادة: تُشتق من الحالة بالتاريخ (asOf) كما أعادها العقد. */
export type ArticleTone = "amended" | "repealed" | "plain";
export const articleTone = (s: ArticleStatus | null): ArticleTone => (s === "معدّل" ? "amended" : s === "ملغى" ? "repealed" : "plain");

export function filterCounts(counts: LawPageData["body"]["counts"]): Record<LawFilter, number> {
  return { all: counts.total, amended: counts.amended, repealed: counts.repealed, live: counts.total - counts.repealed };
}
export function matchesFilter(tone: ArticleTone, f: LawFilter): boolean {
  if (f === "amended") return tone === "amended";
  if (f === "repealed") return tone === "repealed";
  if (f === "live") return tone !== "repealed";
  return true;
}

// ── المقدمة (ع-٤) ─────────────────────────────────────────────────────────────
export type PreambleMode = "units" | "blocks" | "legacy" | "none";
export interface PreambleDisplay {
  mode: PreambleMode;
  /** وسم بجانب العنوان: «مقدمة غير مكتملة» للنص القديم وحده (الكتل نص كامل من الهيئة بلا وسم، §٧-٥). */
  tag: string | null;
  /** سطر تحت العنوان أو صندوق الغياب. */
  note: string | null;
  sourceUrl: string | null;
  instrumentCount: number;
  clauseCount: number;
}
export function preambleDisplay(p: PreambleView): PreambleDisplay {
  const sourceUrl = p.officialSourceUrl;
  if (p.kind === "units" && p.units) {
    const clauseCount = p.units.instruments.reduce((s, i) => s + i.units.filter((u) => u.type === "operative_clause").length, 0);
    return { mode: "units", tag: null, note: null, sourceUrl, instrumentCount: p.units.instruments.length, clauseCount };
  }
  if (p.kind === "source_blocks" && p.sourceBlocks) {
    return { mode: "blocks", tag: null, note: null, sourceUrl: p.sourceBlocks.sourceUrl || sourceUrl, instrumentCount: p.sourceBlocks.blocks.length, clauseCount: 0 };
  }
  if (p.kind === "legacy_text" && p.legacy) {
    return { mode: "legacy", tag: PREAMBLE_INCOMPLETE_LABEL, note: "هذا نص المقدمة كما خُزّن في حكيم، وقد يكون مختصرًا.", sourceUrl, instrumentCount: 0, clauseCount: 0 };
  }
  return {
    mode: "none",
    tag: null,
    note: sourceUrl ? `${PREAMBLE_NONE_LABEL} في حكيم لهذا النظام.` : `${PREAMBLE_NONE_LABEL} في حكيم لهذا النظام، ولا يتوفر رابط المصدر الرسمي.`,
    sourceUrl,
    instrumentCount: 0,
    clauseCount: 0,
  };
}

export const PREAMBLE_COLLAPSE_LINES = 12;
/** تقدير أسطر المقدمة على عرض الجوال (50 حرفًا للسطر، §٥) لقرار الطي في الخادم؛ والعميل يعيد القياس. */
export function estimateLines(texts: string[], perLine = 50): number {
  let lines = 0;
  for (const t of texts) for (const seg of t.split(/\n+/)) if (seg.trim()) lines += Math.max(1, Math.ceil(seg.trim().length / perLine));
  return lines;
}
export const shouldCollapse = (lines: number) => lines > PREAMBLE_COLLAPSE_LINES;

/** مرساة البند: preamble-i1-clause-2 (البيانات) ← preamble-1-clause-2 (المواصفة §٦-٣). */
export function preambleAnchor(dataAnchor: string | null): string | null {
  if (!dataAnchor) return null;
  return dataAnchor.replace(/^preamble-i(\d+)/, "preamble-$1");
}
/** الاسم البديل في الأمر (#preamble-clause-2) يعني الأداة الأولى. */
export function resolvePreambleAlias(hash: string): string {
  const m = hash.match(/^#?preamble-clause-(\d+)$/);
  return m ? `preamble-1-clause-${m[1]}` : hash.replace(/^#/, "");
}

export const INSTRUMENT_KIND_LABEL: Record<string, string> = {
  royal_decree: "مرسوم ملكي",
  royal_order: "أمر ملكي",
  cabinet_decision: "قرار مجلس الوزراء",
  other: "أداة إصدار",
};

// ── المتن (ع-٥) ───────────────────────────────────────────────────────────────
export interface ParaLine {
  num: string | null;
  text: string;
  item: boolean;
}
/** فقرات منفصلة بترقيمها الأصلي؛ البنود (أ، ب…) بإزاحة. النص لا يُعدَّل: يُقسَم على الأسطر فقط. */
export function splitParagraphs(text: string): ParaLine[] {
  const out: ParaLine[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const num = line.match(/^(\(?[0-9٠-٩]{1,3}\)?\s*[-–.)]|[0-9٠-٩]{1,3}\s*[-–.)])\s*/);
    const item = line.match(/^(\(?[أ-ي]\)?\s*[-–)])\s+/);
    if (num) out.push({ num: num[1].trim(), text: line.slice(num[0].length), item: false });
    else if (item) out.push({ num: item[1].trim(), text: line.slice(item[0].length), item: true });
    else out.push({ num: null, text: line, item: false });
  }
  return out;
}

export const REPEAL_TYPE_LABEL: Record<RepealType, string> = {
  express_partial: "إلغاء صريح جزئي",
  replacement: "إحلال نظام محل نظام",
  express_total: "إلغاء صريح كلي",
  temporal: "انتهاء مدة",
  implicit: "إلغاء ضمني معتمد",
};

/** سطر بيان الإلغاء (ع-٧أ): لا يُخترع ما لا تحمله البيانات. */
export function repealSentence(r: RepealInfo): string {
  const by = r.repealingArticle
    ? `بالمادة ${r.repealingArticle.articleNumber}${r.repealingSystem ? ` من ${r.repealingSystem.name}` : ""}`
    : r.repealingSystem
      ? `بموجب ${r.repealingSystem.name}`
      : null;
  const parts = [by ? `أُلغيت ${by}` : "أُلغيت"];
  if (r.instrument) parts.push(`(${r.instrument})`);
  const head = parts.join(" ");
  return `${head}، نافذة من ${orNA(r.effectiveDate)}.`;
}

/** فقرة «يبقى النص حاكمًا…» ثابتة في كل بيان إلغاء (ع-٧). */
export const REPEAL_NON_RETRO = "يبقى النص حاكمًا للوقائع السابقة على نفاذ الإلغاء، لأن الإلغاء لا يسري بأثر رجعي.";

/** الاستناد المنسوخ يحمل الرابط المستقل للمادة (ع-١٥). */
export function citationText(systemName: string, a: Pick<ArticleView, "number" | "status" | "statusLabel" | "repeal">, absoluteArticleUrl: string): string {
  const suffix = a.status === "ملغى" ? `ملغاة${a.repeal?.effectiveDate ? ` منذ ${a.repeal.effectiveDate}` : ""}` : a.status === "معدّل" ? "معدّلة" : a.statusLabel;
  return `${systemName}، المادة (${a.number}) — ${suffix} — ${absoluteArticleUrl}`;
}

// ── «كما في تاريخ» (ع-٩) ──────────────────────────────────────────────────────
/** هل للنظام بيانات زمنية (نسخ أو إلغاء بتاريخ نفاذ) يُبنى عليها عرض تاريخي؟ */
export function hasHistory(data: Pick<LawPageData, "body">): boolean {
  return data.body.divisions.some((d) => d.articles.some((a) => (a.amendment?.versions ?? 0) > 0 || Boolean(a.repeal?.effectiveDate)));
}
export type AsOfMode = "today" | "historical" | "no_history";
export function asOfMode(requested: string | null, history: boolean): AsOfMode {
  if (!requested) return "today";
  return history ? "historical" : "no_history";
}
export const NO_HISTORY_MESSAGE = "لا تتوفر نسخ تاريخية لهذا النظام بعد. المعروض هو النص الساري اليوم.";
export const noHistoryRequestedMessage = (asof: string) =>
  `طلبتَ النظام كما في ${asof}، ولا تتوفر له نسخ تاريخية بعد؛ المعروض أدناه هو النص الساري اليوم، لا نص ذلك التاريخ.`;

// ── البحث داخل النظام (ع-٣) ───────────────────────────────────────────────────
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
function foldChar(c: string): string {
  if (/[أإآٱ]/.test(c)) return "ا";
  if (c === "ى") return "ي";
  if (c === "ة") return "ه";
  if (c === "ؤ") return "و";
  if (c === "ئ") return "ي";
  return c.toLowerCase();
}
/** يطوي النص للمطابقة (بلا تشكيل ولا تطويل، والهمزات والتاء المربوطة موحّدة) مع خريطة المواضع إلى الأصل. */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (TASHKEEL.test(c)) continue;
    folded += foldChar(c);
    map.push(i);
  }
  return { folded, map };
}
/** مواضع المطابقات في النص الأصلي [بداية، نهاية) بعد الطي؛ المطابقة حرفية بعد الطي (الصيغ والجذور لـ aman-ai-engineer). */
export function findMatches(text: string, query: string): Array<[number, number]> {
  const q = foldWithMap(query.trim()).folded;
  if (q.length < 2) return [];
  const { folded, map } = foldWithMap(text);
  const out: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const i = folded.indexOf(q, from);
    if (i < 0) break;
    out.push([map[i], map[i + q.length - 1] + 1]);
    from = i + q.length;
  }
  return out;
}
export const matchCounter = (current: number, total: number) => (total ? `${arNum(current)} من ${arNum(total)}` : "لا مطابقة");

// ── الاتجاه المعاكس (ع-٧أ): ما ألغته أداة هذا النظام، مجمّعًا نطاقات لا سطرًا لكل مادة ─────────────
export interface OutgoingGroup {
  key: string;
  systemId: string | null;
  slug: string;
  from: number;
  to: number;
  label: string;
}
export function groupOutgoingRepeals(rows: Array<{ systemId: string | null; systemName: string; articleNumber: number; systemSlug?: string }>): OutgoingGroup[] {
  const sorted = [...rows].sort((a, b) => a.systemName.localeCompare(b.systemName, "ar") || a.articleNumber - b.articleNumber);
  const out: OutgoingGroup[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.systemId === r.systemId && last.label.endsWith(r.systemName) && r.articleNumber === last.to + 1) {
      last.to = r.articleNumber;
      last.label = `المواد من ${last.from} إلى ${last.to} من ${r.systemName}`;
      continue;
    }
    out.push({ key: `${r.systemId ?? r.systemName}-${r.articleNumber}`, systemId: r.systemId, slug: r.systemSlug ?? r.systemId ?? "", from: r.articleNumber, to: r.articleNumber, label: `المادة ${r.articleNumber} من ${r.systemName}` });
  }
  return out;
}
