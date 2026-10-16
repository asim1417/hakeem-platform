/**
 * segment-model — إكمال حدود التقطيع بالنموذج (المرحلة الثانية): الطلب والتحقق. دوال نقية.
 *
 * لا اختلاق: لا يُطلب من النموذج إزاحات ولا نص جديد؛ يُطلب **اقتباس أول كلمات الجزء حرفيًّا**
 * من منطقة الحدّ المفقود وحدها (لا الحكم كله)، محجوبةً بياناتُها الشخصية. ثم يُبحث عن الاقتباس
 * في النص الأصلي بالتطبيع الحرفي (matchKey) داخل المنطقة؛ فإن لم يوجد بحروفه رُفض الحدّ.
 * كل حدّ مقبول يُوسم method='model' وreviewStatus='needs_review' ومعه الإصدار والثقة.
 */
import { matchKey } from "@/lib/modules/legal-core/ruling-excerpts";
import { maskPersonalData } from "./mask";
import type { Missing } from "./segment-store";
import type { SegmentType } from "./segment";

export const SEGMENT_MODEL_VERSION = "segment-model-v1";
export const SEGMENT_MODEL = process.env.RESEARCH_EXTRACT_MODEL || "claude-haiku-5-5";
export const REGION_CAP = 12000;
export const MIN_QUOTE_WORDS = 4;

export const SYSTEM_PROMPT = [
  "أنت مساعد يحدّد بداية جزء من حكم قضائي سعودي. لا تكتب نصًّا جديدًا ولا تلخّص.",
  "يُعطى لك مقطع من الحكم واسم الجزء المطلوب. أعد أول ٦ إلى ١٢ كلمة من بداية ذلك الجزء **كما وردت في المقطع حرفيًّا**،",
  "بلا تصحيح إملائي ولا تشكيل ولا حذف. إن لم يوجد الجزء في المقطع فأعد found=false.",
  'أجب بكائن JSON وحده: {"found": true|false, "start_quote": "..."}',
].join("\n");

const PART_HINT: Record<Missing, string> = {
  claims: "الدعوى (عرض الوقائع والطلبات؛ يبدأ عادة بنحو «تتحصل وقائع…» أو «تقدم المدعي…» أو «ادعى المدعي…»)",
  reasons: "الأسباب (تسبيب المحكمة؛ يبدأ عادة بنحو «وحيث إن…» أو «ولما كان…» أو «وبعد دراسة…» أو «فبناءً على…»)",
  disposition: "المنطوق (نتيجة الحكم؛ يبدأ عادة بنحو «حكمت الدائرة…» أو «قررت الدائرة…» أو «لذلك حكمت…»)",
};

/** نص المنطقة كما يُرسل: محجوب، ومسقوف بأولها وآخرها إن طال. */
export function regionInput(text: string, start: number, end: number): { input: string; capped: boolean } {
  const slice = text.slice(start, end);
  const capped = slice.length > REGION_CAP;
  const body = capped ? `${slice.slice(0, REGION_CAP / 2)}\n…\n${slice.slice(slice.length - REGION_CAP / 2)}` : slice;
  return { input: maskPersonalData(body), capped };
}

export function userPrompt(missing: Missing, input: string): string {
  return `الجزء المطلوب: ${PART_HINT[missing]}\n\nالمقطع:\n<<<\n${input}\n>>>`;
}

/** يستخرج {found, start_quote} من رد النموذج (JSON وحده أو ضمن نص). */
export function parseAnswer(text: string): { found: boolean; quote: string | null } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { found?: unknown; start_quote?: unknown };
    const quote = typeof o.start_quote === "string" ? o.start_quote.trim() : null;
    return { found: o.found === true && Boolean(quote), quote: quote || null };
  } catch {
    return null;
  }
}

export interface PlainSegment { type: SegmentType; start: number; end: number }

/**
 * يُدخل حدًّا متحقَّقًا منه (من النموذج) في تقطيع القواعد: يقسم الجزء الذي يقع فيه الموضع، ويُوسم
 * الشطر الثاني بالجزء المفقود. يعيد null إن كسر الإدخال الترتيب المنطقي أو وقع على بداية جزء قائم.
 */
export function applyModelBoundary(segments: PlainSegment[], missing: Missing, at: number): PlainSegment[] | null {
  const i = segments.findIndex((s) => at > s.start && at < s.end);
  if (i < 0) return null;
  const s = segments[i];
  const next: PlainSegment[] = [...segments.slice(0, i), { ...s, end: at }, { type: missing, start: at, end: s.end }, ...segments.slice(i + 1)];
  const order: SegmentType[] = ["header", "claims", "defense", "evidence", "reasons", "disposition", "appeal", "other"];
  const ok = next.every((x, k) => k === 0 || order.indexOf(x.type) > order.indexOf(next[k - 1].type));
  return ok ? next : null;
}

/** يطوي الفراغات المتتالية (والأسطر) إلى فراغ واحد مع إبقاء خريطة المواضع. */
function collapsed(k: { key: string; map: number[] }): { key: string; map: number[] } {
  let key = "";
  const map: number[] = [];
  for (let i = 0; i < k.key.length; i++) {
    const ws = /\s/.test(k.key[i]);
    if (ws && (key.endsWith(" ") || key === "")) continue;
    key += ws ? " " : k.key[i];
    map.push(k.map[i]);
  }
  return { key: key.trimEnd(), map };
}

/**
 * يتحقق من الاقتباس في النص الأصلي داخل [start,end): بالتطبيع الحرفي (التشكيل والكشيدة والهمزات).
 * يعيد موضع البداية في النص الأصلي، أو سببًا للرفض.
 */
export function verifyQuote(text: string, start: number, end: number, quote: string):
  { ok: true; at: number } | { ok: false; reason: "too_short" | "masked" | "not_found" } {
  let words = quote.split(/\s+/).filter(Boolean);
  // اقتباس فيه موضع محجوب («[اسم]»): يُكتفى بالكلمات التي قبله إن بلغت الحد الأدنى؛ فالنص الأصلي فيه الاسم لا القناع.
  const masked = words.findIndex((w) => /^[(\[]*\[(?:اسم|هوية|جوال|آيبان|بريد)/.test(w) || /\[(?:اسم|هوية|جوال|آيبان|بريد)/.test(w));
  if (masked >= 0) {
    if (masked < MIN_QUOTE_WORDS) return { ok: false, reason: "masked" };
    words = words.slice(0, masked);
  }
  if (words.length < MIN_QUOTE_WORDS) return { ok: false, reason: "too_short" };
  const region = collapsed(matchKey(text.slice(start, end)));
  const q = collapsed(matchKey(words.join(" "))).key;
  const idx = region.key.indexOf(q);
  if (idx < 0) return { ok: false, reason: "not_found" };
  return { ok: true, at: start + region.map[idx] };
}
