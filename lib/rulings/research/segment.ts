/**
 * segment — تقطيع نص الحكم إلى أجزائه بالقواعد (المرحلة الثانية). دالة نقية.
 *
 * الجرد أثبت أن النصوص كتلة واحدة بلا عناوين (٤٥ من ٤٨ بلا سطر جديد)، فالتقطيع يقوم على
 * عبارات المرسى داخل النص لا على العناوين، بترتيب الحكم السعودي المعتاد:
 *   header (الديباجة) → claims (الدعوى والطلبات) → defense (الإجابة والدفوع)
 *   → reasons (الأسباب) → disposition (المنطوق) → appeal (ما بعد المنطوق من اعتراض/استئناف) → other (الختام)
 * والبينات (evidence) ترد متداخلة مع الدعوى والإجابة، فتُرصد مواضعها ولا تُقطع جزءًا مستقلًّا
 * في هذا الإصدار إلا إذا وردت بصيغة صريحة («وبسؤال المدعي عن بينته»).
 *
 * الشرط الهيكلي: الأجزاء متجاورة تغطي النص كله بلا تداخل ولا فجوة، والإزاحات على النص الأصلي.
 * ما لم تُعثر حدوده بالقواعد يُوسم needsModel = true ليُرسل حدّه وحده إلى النموذج لاحقًا.
 */
import { stripTatweel } from "./anchors";

export const SEGMENT_EXTRACTOR_VERSION = "segment-rules-v2";

export type SegmentType = "header" | "claims" | "defense" | "evidence" | "reasons" | "disposition" | "appeal" | "other";

export interface Segment {
  type: SegmentType;
  start: number;
  end: number;
  method: "rule";
  confidence: number;
}

export interface Segmentation {
  segments: Segment[];
  found: Partial<Record<SegmentType, boolean>>;
  needsModel: boolean;
  version: string;
}

const A = "[اأإآ]";
const H = "[ةه]";
const Y = "[يى]";
const W = "(?:^|[^\\u0621-\\u064A])";

/** بداية الدعوى (الوقائع). */
const CLAIMS_START = [
  // «تتحصل وقائع هذه الدعوى بالقدر اللازم لإصدار هذا الحكم في أن…» (٦٬٨١٨ حكمًا في الإحصاء المجمّع)
  `تتحصل\\s+(?:وقائع|الوقائع)`,
  `(?:ال)?وقائع\\s+تتحصل`,
  `وقائع\\s+هذه\\s+(?:الدعو${Y}|القضي${H})`,
  `بصحيف${H}\\s+دعو${Y}`,
  `تت?لخص\\s+(?:وقائع|الوقائع)`,
  `وتتلخص\\s+(?:وقائع|الوقائع)`,
  `${W}(?:تقدم|${A}قام|تقدمت|${A}قامت)\\s+(?:المدع${Y}|وكيل\\s+المدع${Y})`,
  `${W}(?:ادع${Y}|يدع${Y})\\s+المدع${Y}`,
  `${W}(?:ذكر|قال)\\s+(?:المدع${Y}|وكيل\\s+المدع${Y})`,
  `حاصل\\s+(?:الدعو${Y}|ما\\s+ورد)`,
];
/** بداية الإجابة والدفوع. */
const DEFENSE_START = [
  `وبعرض\\s+ذلك\\s+عل${Y}\\s+(?:المدع${Y}\\s+عليه|وكيل)`,
  `وبعرض\\s+الدعو${Y}\\s+عل${Y}`,
  `(?:${A}جاب|وبسؤال)\\s+(?:المدع${Y}\\s+عليه|وكيل\\s+المدع${Y}\\s+عليه)`,
  `(?:قدم|تقدم)\\s+(?:المدع${Y}\\s+عليه|وكيل\\s+المدع${Y}\\s+عليه)\\s+بمذكر${H}`,
  `(?:دفع|يدفع)\\s+(?:المدع${Y}\\s+عليه|وكيل\\s+المدع${Y}\\s+عليه)`,
  `جواب\\s+المدع${Y}\\s+عليه`,
];
/** بداية التسبيب. */
const REASONS_START = [
  `${W}(?:ال)?${A}سباب\\s*[:：]`,
  `${W}و?حيث\\s+${A}ن`,
  `${W}و?لما\\s+كان`,
  `${W}و?بما\\s+${A}ن`,
  `${W}(?:وت${A}سيسا|وبناء)\\s+عل${Y}\\s+ما\\s+تقدم`,
];
/** المنطوق القاطع (يُؤخذ آخر ظهور، فأوله يرد غالبًا في عرض الطلبات). */
const DISPOSITION = [
  `(?:فل|ل)ذلك\\s+(?:فقد\\s+)?(?:حكمت|قررت)\\s+(?:ال)?(?:دائر${H}|محكم${H})`,
  `${W}(?:وبه\\s+|فقد\\s+)?حكمت\\s+(?:ال)?(?:دائر${H}|محكم${H})`,
  `${W}قررت\\s+(?:ال)?(?:دائر${H}|محكم${H})`,
  `(?:منطوق|نص)\\s+(?:ال)?حكم\\s*[:：]`,
];
/** ما بعد المنطوق: قناعة واعتراض واستئناف. */
const APPEAL_AFTER = [
  `(?:عدم\\s+)?(?:ال)?قناع${H}`,
  `(?:قنع|اعترض|يعترض)`,
  `(?:محكم${H}|(?:ال)?دائر${H})\\s+(?:ال)?${A}ستئناف`,
  `(?:ت${A}ييد|نقض|تعديل)\\s+(?:ال)?حكم`,
];
/**
 * قالب أحكام الهيئة الدائمة (المحكمة العليا ومجلس القضاء الأعلى): «انعقدت الدائرة…»
 * ثم «للنظر في طلب النقض…» ثم «وبعد الاطلاع على الأوراق ودراستها وبعد المداولة…» ثم «لذلك قررت الدائرة».
 */
const PANEL_CLAIMS = [`(?:وذلك\\s+)?للنظر\\s+ف${Y}\\s+طلب`, `ف${Y}\\s+طلب\\s+النقض`];
const PANEL_REASONS = [`وبعد\\s+(?:ال)?اطلاع\\s+عل${Y}\\s+(?:ال${A}وراق|القضي${H}|ما\\s+تقدم)`, `وبعد\\s+المداول${H}`, `ودراستها\\s+وبعد`];

/** الختام. */
const CLOSING = [`وصل${Y}\\s+الله\\s+(?:وسلم\\s+)?عل${Y}\\s+نبينا`, `وبالله\\s+التوفيق`];

const rxs = (list: string[]) => list.map((s) => new RegExp(s, "gu"));
const R = {
  claims: rxs(CLAIMS_START), defense: rxs(DEFENSE_START), reasons: rxs(REASONS_START),
  disposition: rxs(DISPOSITION), appeal: rxs(APPEAL_AFTER), closing: rxs(CLOSING),
  panelClaims: rxs(PANEL_CLAIMS), panelReasons: rxs(PANEL_REASONS),
};

export interface SegmentOptions {
  /** حكم من الهيئة الدائمة (court_type «أخرى»): قالب الطلب ← الأسباب ← القرار، بلا «إجابة». */
  permanentPanel?: boolean;
}

/** مواضع (في النص المنقّى من الكشيدة) لكل تطابق، بعد تجاوز الفاصل البادئ. */
function positions(text: string, res: RegExp[]): number[] {
  const out: number[] = [];
  for (const re of res) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const lead = m[0].length - m[0].replace(/^[^ء-ي]+/u, "").length;
      out.push((m.index ?? 0) + lead);
    }
  }
  return out.sort((a, b) => a - b);
}

const firstAfter = (ps: number[], from: number, before = Infinity) => ps.find((p) => p >= from && p < before) ?? null;

export function segmentRuling(original: string, opts: SegmentOptions = {}): Segmentation {
  const { text, map } = stripTatweel(original ?? "");
  const n = text.length;
  const at = (p: number) => (p >= n ? original.length : map[p]);
  const found: Segmentation["found"] = {};
  if (!n) return { segments: [], found, needsModel: true, version: SEGMENT_EXTRACTOR_VERSION };

  // المنطوق: آخر مرسى قاطع في الثلث الأخير من النص؛ وإلا آخر مرسى أيًّا كان موضعه.
  const disp = positions(text, R.disposition);
  const lateDisp = disp.filter((p) => p >= n * 0.5);
  const dispStart = lateDisp.length ? lateDisp[0] : disp.length ? disp[disp.length - 1] : null;
  const panel = Boolean(opts.permanentPanel);
  const claimsStart = firstAfter(positions(text, panel ? [...R.panelClaims, ...R.claims] : R.claims), 0, dispStart ?? n);
  const defenseStart = panel ? null : firstAfter(positions(text, R.defense), claimsStart ?? 0, dispStart ?? n);
  const reasonsStart = firstAfter(
    positions(text, panel ? [...R.panelReasons, ...R.reasons] : R.reasons), defenseStart ?? claimsStart ?? 0, dispStart ?? n);
  const appealStart = dispStart !== null ? firstAfter(positions(text, R.appeal), dispStart + 20) : null;
  const closingStart = firstAfter(positions(text, R.closing), Math.max(dispStart ?? 0, appealStart ?? 0) + 1);

  const cuts: Array<[SegmentType, number | null]> = [
    ["header", 0],
    ["claims", claimsStart],
    ["defense", defenseStart],
    ["reasons", reasonsStart],
    ["disposition", dispStart],
    ["appeal", appealStart],
    ["other", closingStart],
  ];
  const present = cuts.filter((c): c is [SegmentType, number] => c[1] !== null).sort((a, b) => a[1] - b[1]);
  // إزالة التكرار في الموضع نفسه (يُبقي الأخير ترتيبًا منطقيًّا).
  const uniq = present.filter((c, i) => i === present.length - 1 || present[i + 1][1] !== c[1]);
  const segments: Segment[] = uniq.map(([type, s], i) => ({
    type,
    start: at(s),
    end: i + 1 < uniq.length ? at(uniq[i + 1][1]) : original.length,
    method: "rule",
    confidence: type === "header" ? 0.9 : 0.8,
  }));
  if (segments.length) segments[0].start = 0;
  for (const [t, s] of cuts) if (t !== "header") found[t] = s !== null;
  const needsModel = !(found.claims && found.reasons && found.disposition);
  return { segments, found, needsModel, version: SEGMENT_EXTRACTOR_VERSION };
}

/** الشرط الهيكلي: تغطية كاملة متجاورة بلا تداخل، وترتيب منطقي للأنواع. */
export function checkStructure(seg: Segmentation, length: number): { contiguous: boolean; ordered: boolean } {
  const s = seg.segments;
  const contiguous = s.length > 0 && s[0].start === 0 && s[s.length - 1].end === length && s.every((x, i) => x.end > x.start && (i === 0 || x.start === s[i - 1].end));
  const order: SegmentType[] = ["header", "claims", "defense", "evidence", "reasons", "disposition", "appeal", "other"];
  const ordered = s.every((x, i) => i === 0 || order.indexOf(x.type) > order.indexOf(s[i - 1].type));
  return { contiguous, ordered };
}
