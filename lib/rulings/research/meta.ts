/**
 * meta — اشتقاق البيانات الأساسية لكل حكم (ruling_meta، المرحلة الأولى). دوال نقية.
 *
 * المدخلات أعمدة judicial_cases كما هي؛ لا يُعدَّل أي منها. القيم الفعلية في القاعدة (جرد ١٦/١٠/٢٠٢٦):
 *   court  ∈ «محكمة: المحكمة التجارية | العامة | العليا -  الهيئة الدائمة | مجلس القضاء الأعلى - الهيئة الدائمة | العمالية | الجزائية»
 *   cityName = «المدينه: الرياض» …، courtOfAppeal = «محكمة الاستئناف: …» أو فارغ.
 * التاريخ الميلادي يُحسب بالتقويم الهجري الجدولي (lib/agent-runtime/tools/hijriDateCalc.ts)،
 * وقد يختلف يومًا أو يومين عن تقويم أم القرى؛ لذا يُوسم date_g_method = 'tabular'.
 */
import { createHash } from "node:crypto";
import { hijriToGregorian } from "../../agent-runtime/tools/hijriDateCalc";

export const META_EXTRACTOR_VERSION = "meta-v1";

export type CourtType = "عامة" | "تجارية" | "أحوال شخصية" | "عمالية" | "جزائية" | "استئناف" | "أخرى";
export type Degree = "ابتدائي" | "استئناف" | "عليا";

export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** يحذف البادئة الثابتة «محكمة: …» / «المدينه: …» / «محكمة الاستئناف: …» ويوحّد الفراغات. */
export function stripLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/^[^:：]{1,30}[:：]\s*/, "").replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim();
  return s || null;
}

export interface HijriParts {
  year: number;
  month: number | null;
  day: number | null;
  shape: string; // نمط النص مثل dd/dd/dddd — للتقرير عن غير المحلول دون نصوص
}

/** شكل النص بلا محتوى: الأرقام d والحروف العربية a — لرصد الصيغ غير المحلولة دون كشف بيانات. */
export function textShape(s: string): string {
  return toLatinDigits(s).replace(/[0-9]/g, "d").replace(/[ء-يـ]+/g, "a").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** يستخرج التاريخ الهجري من نص تاريخ: dd/mm/yyyy أو yyyy/mm/dd أو السنة وحدها (١٣٠٠–١٥٠٠). */
export function parseHijriDate(text: string | null | undefined): HijriParts | null {
  if (!text) return null;
  const t = toLatinDigits(text);
  const shape = textShape(text);
  const ok = (y: number, m: number, d: number) => y >= 1300 && y <= 1500 && m >= 1 && m <= 12 && d >= 1 && d <= 30;
  let m = t.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  if (m && ok(+m[3], +m[2], +m[1])) return { year: +m[3], month: +m[2], day: +m[1], shape };
  m = t.match(/(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/);
  if (m && ok(+m[1], +m[2], +m[3])) return { year: +m[1], month: +m[2], day: +m[3], shape };
  m = t.match(/(?:^|\D)(1[34]\d{2})(?:\D|$)/);
  if (m && +m[1] >= 1300 && +m[1] <= 1500) return { year: +m[1], month: null, day: null, shape };
  return null;
}

/** التاريخ الميلادي التقريبي (جدولي) بصيغة YYYY-MM-DD، أو null إن نقص اليوم أو الشهر. */
export function hijriToGregorianIso(h: HijriParts | null): string | null {
  if (!h || h.month === null || h.day === null) return null;
  const g = hijriToGregorian({ year: h.year, month: h.month, day: h.day });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${g.year}-${pad(g.month)}-${pad(g.day)}`;
}

/** نوع المحكمة بقيم ثابتة. ما لا يُعرف يُرجَع null ليُسرد في التقرير (لا «أخرى» افتراضيًّا). */
export function classifyCourt(court: string | null | undefined): CourtType | null {
  const c = stripLabel(court);
  if (!c) return null;
  if (/تجاري/.test(c)) return "تجارية";
  if (/عمالي/.test(c)) return "عمالية";
  if (/جزائي/.test(c)) return "جزائية";
  if (/أحوال|احوال/.test(c)) return "أحوال شخصية";
  if (/استئناف/.test(c)) return "استئناف";
  if (/العليا|مجلس القضاء/.test(c)) return "أخرى";
  if (/العامة|العامه/.test(c)) return "عامة";
  return null;
}

/**
 * الدرجة: «عليا» للمحكمة العليا ومجلس القضاء الأعلى (الهيئة الدائمة)، و«استئناف» لمحكمة الاستئناف،
 * و«ابتدائي» لغيرها. وجود نص استئناف مرفق (appealText) لا يغيّر درجة الحكم الأصلي.
 */
export function classifyDegree(court: string | null | undefined): Degree | null {
  const c = stripLabel(court);
  if (!c) return null;
  if (/العليا|مجلس القضاء/.test(c)) return "عليا";
  if (/استئناف/.test(c)) return "استئناف";
  return "ابتدائي";
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text ?? "", "utf8").digest("hex");
}

export interface RulingMetaInput {
  id: string;
  court: string | null;
  cityName: string | null;
  courtOfAppeal: string | null;
  decisionDateText: string | null;
  caseDateText: string | null;
  judgmentText: string;
  appealText: string | null;
}

export interface RulingMeta {
  case_id: string;
  year_h: number | null;
  month_h: number | null;
  day_h: number | null;
  date_source: "decision" | "case" | null;
  decision_date_g: string | null;
  date_g_method: "tabular" | null;
  court_type: CourtType | null;
  court_name_norm: string | null;
  city_norm: string | null;
  appeal_court_norm: string | null;
  degree: Degree | null;
  has_appeal_text: boolean;
  text_len: number;
  is_empty: boolean;
  content_hash: string;
  extractor_version: string;
}

export function deriveMeta(r: RulingMetaInput): RulingMeta & { _dateShape: string | null } {
  const fromDecision = parseHijriDate(r.decisionDateText);
  const fromCase = fromDecision ? null : parseHijriDate(r.caseDateText);
  const h = fromDecision ?? fromCase;
  const g = hijriToGregorianIso(h);
  const text = r.judgmentText ?? "";
  return {
    case_id: r.id,
    year_h: h?.year ?? null,
    month_h: h?.month ?? null,
    day_h: h?.day ?? null,
    date_source: fromDecision ? "decision" : fromCase ? "case" : null,
    decision_date_g: g,
    date_g_method: g ? "tabular" : null,
    court_type: classifyCourt(r.court),
    court_name_norm: stripLabel(r.court),
    city_norm: stripLabel(r.cityName),
    appeal_court_norm: stripLabel(r.courtOfAppeal),
    degree: classifyDegree(r.court),
    has_appeal_text: Boolean(r.appealText && r.appealText.trim()),
    text_len: text.length,
    is_empty: text.trim().length === 0,
    content_hash: contentHash(text),
    extractor_version: META_EXTRACTOR_VERSION,
    _dateShape: h ? null : r.decisionDateText ? textShape(r.decisionDateText) : null,
  };
}
