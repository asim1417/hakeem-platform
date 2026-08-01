// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §16 — إدراج النصّ المفرَّغ عند المؤشّر (لا يمسح النصّ السابق).
// نقيّ/قابل للاختبار. يُستبدَل التحديد فقط أو يُدرَج عند المؤشّر مع مسافةٍ ذكيّة، ويُحسَب
// موضع المؤشّر الجديد. لا يستدعي onSubmit (المستدعي يتحكّم في الإرسال).
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertTranscriptInput {
  currentText: string;
  transcript: string;
  selectionStart: number;
  selectionEnd: number;
  maxChars: number;
}
export interface InsertTranscriptResult {
  text: string;
  caret: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** مسافةٌ ذكيّة: تضيف فراغًا إن لزم بين المحيط والنصّ المُدرَج. */
function smartJoin(before: string, insert: string, after: string): { text: string; insertLen: number } {
  let piece = insert.trim();
  if (!piece) return { text: before + after, insertLen: 0 };
  const needLead = before.length > 0 && !/\s$/.test(before) && !/^\s/.test(piece);
  const needTrail = after.length > 0 && !/^\s/.test(after) && !/\s$/.test(piece);
  if (needLead) piece = " " + piece;
  if (needTrail) piece = piece + " ";
  return { text: before + piece + after, insertLen: piece.length };
}

/**
 * §16 — يدرج النصّ المفرَّغ: يستبدل الجزء المحدَّد (إن وُجد) أو يُدرِج عند المؤشّر،
 * يحافظ على النصّ السابق، ويقصّ إلى maxChars، ويعيد موضع المؤشّر الجديد.
 */
export function insertTranscriptAtCaret(input: InsertTranscriptInput): InsertTranscriptResult {
  const cur = String(input.currentText ?? "");
  const max = Math.max(0, input.maxChars || 0);
  const start = clamp(Math.min(input.selectionStart, input.selectionEnd), 0, cur.length);
  const end = clamp(Math.max(input.selectionStart, input.selectionEnd), 0, cur.length);

  const before = cur.slice(0, start);
  const after = cur.slice(end);
  const { text, insertLen } = smartJoin(before, input.transcript, after);

  if (max > 0 && text.length > max) {
    // قصٌّ محافظ: نُبقي أكبر قدرٍ ممكن دون تجاوز الحدّ (نحافظ على ما قبل الإدراج أولًا).
    const clipped = text.slice(0, max);
    const caret = clamp(before.length + insertLen, 0, clipped.length);
    return { text: clipped, caret };
  }
  return { text, caret: before.length + insertLen };
}
