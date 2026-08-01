// ─────────────────────────────────────────────────────────────────────────────
// §22 — محرّك تتبّع العبارة (Judicial Statement Trace Engine)
//
// يجزّئ المسودّة إلى عباراتٍ جوهريّة، ويصنّف كلّ عبارةٍ (نوعها + مستوى جزمها + حالة تحقّقها)
// بردّها إلى واقعة/دليل/سند إن أمكن. نقيّ وحتميّ — يملأ jds_statement_traces (كتابته منفصلة).
// لا يختلق إسنادًا: عبارةٌ بلا مطابقةٍ لواقعة/دليل/سند تُعلَّم UNSUPPORTED أو NEEDS_REVIEW.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AssertionLevel,
  JudicialStatementTrace,
  StatementType,
  StatementVerificationStatus,
} from "./contracts";

export interface TraceContext {
  facts?: string[]; // وقائع معروفة (بنصّها)
  evidence?: string[]; // أدلّة معروفة
  authorities?: string[]; // أرقام/أسماء سلطاتٍ متاحة (مثل «المادة 5»)
}

// مؤشّرات لغويّة لتصنيف نوع العبارة (§22) من النواة اللغويّة.
const TYPE_HINTS: Array<[StatementType, RegExp]> = [
  ["DISPOSITION", /تقضي|حكمت|نأمر|ألزمنا|يُلزَم|المنطوق/],
  ["PROCEDURAL_RESULT", /يصرف النظر|عدم القبول|تأجّل|شُطبت|قُبلت الدعوى/],
  ["AUTHORITY", /المادة\s|النظام\s|اللائحة|نصّت/],
  ["QUOTE", /["«][^"»]{6,}["»]/],
  ["ADMITTED_FACT", /أقرّ|صادَق|لم يُنكر/],
  ["DENIED_FACT", /أنكر|نازع|جحد/],
  ["DOCUMENTED_FACT", /الثابت من|يتبيّن من|بموجب المستند|تبيّن من/],
  ["INFERENCE", /يُستفاد|يظهر|يترجّح|ومن ثمّ|بناءً على ذلك/],
  ["PARTY_ASSERTION", /يدّعي|يذكر|يزعم|يتمسّك|يطلب|يدفع/],
];

const LEVEL_HINTS: Array<[AssertionLevel, RegExp]> = [
  ["ESTABLISHED", /ثبت|الثابت|استقرّ|مؤكَّد/],
  ["DISPUTED", /محلّ نزاع|متنازع|مختلَف فيه/],
  ["INFERRED", /يُستفاد|يظهر|يترجّح/],
  ["SUPPORTED", /تعزّزه|يستأنس|قرينة/],
  ["ASSERTED", /يدّعي|يزعم|يذكر/],
];

/** يجزّئ نصًّا إلى عباراتٍ مع فواصل الإزاحة (offset). */
export function segmentStatements(text: string): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  const re = /[^.؛!؟\n]+[.؛!؟\n]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const seg = m[0].trim();
    if (seg.length >= 8) out.push({ text: seg, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function classifyType(s: string): StatementType {
  for (const [t, re] of TYPE_HINTS) if (re.test(s)) return t;
  return "PARTY_ASSERTION";
}
function classifyLevel(s: string): AssertionLevel {
  for (const [l, re] of LEVEL_HINTS) if (re.test(s)) return l;
  return "ASSERTED";
}

function matchAny(s: string, items: string[]): string[] {
  return items.filter((it) => it && s.includes(it.slice(0, Math.min(it.length, 24))));
}

/**
 * §22 — يُنتج تتبّعًا لكلّ عبارةٍ جوهريّة. الحالة:
 *   VERIFIED إن رُبطت بواقعة/دليل/سند؛ UNSUPPORTED للحكم/الإسناد بلا سند؛ وإلا NEEDS_REVIEW.
 */
export function traceStatements(
  draftVersionId: string,
  text: string,
  ctx: TraceContext = {},
  sectionId = "",
): JudicialStatementTrace[] {
  const facts = ctx.facts ?? [];
  const evidence = ctx.evidence ?? [];
  const authorities = ctx.authorities ?? [];
  return segmentStatements(text).map((seg, i) => {
    const type = classifyType(seg.text);
    const level = classifyLevel(seg.text);
    const factHits = matchAny(seg.text, facts);
    const evHits = matchAny(seg.text, evidence);
    const authHits = authorities.filter((a) => seg.text.includes(a));

    let status: StatementVerificationStatus;
    const hasSupport = factHits.length || evHits.length || authHits.length;
    if (hasSupport) status = "VERIFIED";
    else if (type === "AUTHORITY" || type === "DISPOSITION" || level === "ESTABLISHED")
      status = "UNSUPPORTED"; // إسنادٌ/حكمٌ/ثبوتٌ بلا سند = يحتاج تصحيحًا (§27)
    else status = "NEEDS_REVIEW";

    return {
      id: `${draftVersionId}:st${i + 1}`,
      draftVersionId,
      sectionId,
      startOffset: seg.start,
      endOffset: seg.end,
      statementType: type,
      assertionLevel: level,
      factIds: factHits,
      evidenceIds: evHits,
      authoritySnapshotIds: authHits,
      draftingPatternIds: [],
      procedureNodeIds: [],
      verificationStatus: status,
    };
  });
}

/** خلاصة: عدد العبارات غير المسنَدة (للإبراز في المراجعة). */
export function unsupportedCount(traces: JudicialStatementTrace[]): number {
  return traces.filter((t) => t.verificationStatus === "UNSUPPORTED").length;
}
