/**
 * segment-embeddings — مدخلات متجهات الأجزاء: الأسباب والمنطوق لكل حكم. دالة نقية.
 *
 * المتجه القائم (جدول embeddings، owner_type='ruling') بُني من أول ٨٬٠٠٠ حرف من الحكم،
 * أي الديباجة والدعوى غالبًا، فيجد البحث بالمعنى الحكم بديباجته لا بعلّته. هنا:
 *   • يُقطَّع الحكم بالقواعد (segment.ts) ويُؤخذ جزءا الأسباب والمنطوق فقط.
 *   • الأسباب الطويلة تُقسم نوافذ ≤ REASONS_CHUNK حرفًا على حدود الكلمات؛ وإن زادت على
 *     MAX_REASONS_CHUNKS أُخذ أولها وآخرها (آخر الأسباب أقربها إلى المنطوق وأدلّها على العلّة).
 *   • المنطوق نافذة واحدة ≤ DISPOSITION_CHUNK حرفًا من بدايته.
 *   • النص المرسَل إلى مزوّد المتجهات يُحجب (maskPersonalData: الأرقام الشخصية وأسماء الأفراد، HKM-043) ويُوحَّد
 *     فراغه؛ والإزاحات على النص الأصلي. فلا يجلب البحث بالمعنى حكمًا باسم فرد.
 *   • البصمة (content_hash) من النص المرسَل واسم النموذج والإصدار، فإعادة التشغيل لا تُعيد ما لم يتغير.
 */
import { createHash } from "node:crypto";
import { segmentRuling } from "./segment";

export const SEGMENT_EMBED_VERSION = "seg-embed-v2-masked";
export const REASONS_CHUNK = 6000;
export const MAX_REASONS_CHUNKS = 4;
export const DISPOSITION_CHUNK = 3000;
/** أقصر جزء يستحق متجهًا («لذلك حكمت الدائرة برفض الدعوى» ثلاثون حرفًا ومعناها تام). */
export const MIN_PART_CHARS = 15;

export type EmbedPart = "reasons" | "disposition";

export interface SegmentChunk {
  part: EmbedPart;
  chunk: number;
  /** إزاحتا النافذة في النص الأصلي. */
  start: number;
  end: number;
  /** النص المرسَل إلى المزوّد: محجوب وموحَّد الفراغ. */
  input: string;
}

/**
 * نوافذ متتالية على [start,end) لا يتجاوز طولها size، مقصوصة عند آخر نهاية جملة أو سطر في نصفها الثاني،
 * وإلا عند آخر فراغ — فلا يقع اسم (وصفته قبله) على حدّ نافذتين فيفوت الحجب.
 */
export function windows(text: string, start: number, end: number, size: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let s = start;
  while (s < end) {
    let e = Math.min(end, s + size);
    if (e < end) {
      const floor = s + size / 2;
      let sentence = -1;
      for (let i = e - 1; i > floor; i--) {
        if (/[.\n؛؟!]/.test(text[i])) {
          sentence = i + 1;
          break;
        }
      }
      const cut = text.lastIndexOf(" ", e);
      if (sentence > floor) e = sentence;
      else if (cut > floor) e = cut;
    }
    out.push([s, e]);
    s = e;
    while (s < end && /\s/.test(text[s])) s++;
  }
  return out;
}

/** أولها وآخرها إذا زادت على max (نصفان، والزائد للآخر). */
export function keepEnds<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs;
  const head = Math.floor(max / 2);
  return [...xs.slice(0, head), ...xs.slice(xs.length - (max - head))];
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function buildSegmentChunks(
  raw: string,
  redact: (s: string) => string = (s) => s,
  segments?: Array<{ type: string; start: number; end: number }>,
): SegmentChunk[] {
  const text = raw ?? "";
  // أجزاء محسوبة مسبقًا (مثل حدود النموذج المخزّنة)، وإلا تقطيع القواعد.
  const seg = { segments: segments ?? segmentRuling(text).segments };
  const out: SegmentChunk[] = [];
  const reasons = seg.segments.find((s) => s.type === "reasons");
  if (reasons && reasons.end - reasons.start >= MIN_PART_CHARS) {
    const ws = keepEnds(windows(text, reasons.start, reasons.end, REASONS_CHUNK), MAX_REASONS_CHUNKS);
    ws.forEach(([s, e], i) => {
      const input = clean(redact(text.slice(s, e)));
      if (input.length >= MIN_PART_CHARS) out.push({ part: "reasons", chunk: i, start: s, end: e, input });
    });
  }
  const disp = seg.segments.find((s) => s.type === "disposition");
  if (disp && disp.end - disp.start >= MIN_PART_CHARS) {
    const [[s, e]] = windows(text, disp.start, disp.end, DISPOSITION_CHUNK);
    const input = clean(redact(text.slice(s, e)));
    if (input.length >= MIN_PART_CHARS) out.push({ part: "disposition", chunk: 0, start: s, end: e, input });
  }
  return out;
}

export function segmentContentHash(input: string, model: string): string {
  return createHash("sha256").update(`${input}\n${model}\n${SEGMENT_EMBED_VERSION}`, "utf8").digest("hex");
}
