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

export const SEGMENT_EXTRACTOR_VERSION = "segment-rules-v4";

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
  // v4: صيغ فاتت v3 فتضخّمت الديباجة — الفعل مسبوقًا بالواو أو الفاء («فادعى المدعي»، «وتقدمت المدعية»)،
  // والفعل يليه وصف الطرف («أقامت الشركة المدعية دعواها»)، و«بموجب صحيفة»، وعنوان «الوقائع:» الصريح.
  `${W}[وف](?:ادع${Y}|تقدم|تقدمت|${A}قام|${A}قامت)\\s+(?:المدع${Y}|وكيل\\s+المدع${Y})`,
  `${W}[وف]?(?:تقدم|تقدمت|${A}قام|${A}قامت)\\s+(?:ال)?(?:شرك${H}|مؤسس${H}|بنك|مصرف|جه${H}|هيئ${H}|وزار${H}|مكتب|جمعي${H})\\s+(?:ال)?مدعي${H}`,
  `بموجب\\s+(?:صحيف${H}|لائح${H})\\s+(?:ال)?دعو${Y}`,
  `بلائح${H}\\s+دعو${Y}`,
  `${W}(?:ال)?وقائع\\s*[:：]`,
];
/** بداية الإجابة والدفوع. */
const DEFENSE_START = [
  // من الإحصاء المجمّع: «فأجاب قائلًا» (١٬٠٤٨ حكمًا)، «فأجاب بأنه/بأن»، «وبعرضها على وكيل…»، «مذكرة جوابية».
  `وبعرض(?:ها|ه)?\\s+(?:ذلك\\s+|الدعو${Y}\\s+)?عل${Y}\\s+(?:المدع${Y}\\s+عليه|وكيل)`,
  `(?:ف|و)?${A}جاب\\s+(?:قا[ئي]لا|ب${A}ن)`,
  `مذكر${H}\\s+جوابي${H}`,
  `جوابه\\s+عل${Y}`,
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
  // v4: العنوان بين قوسين «(منطوق الحكم)».
  `[(（]\\s*(?:منطوق|نص)\\s+(?:ال)?حكم\\s*[)）]`,
];
/** v4: عنوان المنطوق الصريح («نص الحكم:»، «منطوق الحكم:»، «(منطوق الحكم)») — يُقدَّم آخر ظهور له. */
const EXPLICIT_DISPOSITION = new RegExp(`(?:[(（]\\s*)?(?:منطوق|نص)\\s+(?:ال)?حكم\\s*(?:[:：]|[)）])`, "gu");
/**
 * v4: «قررت الدائرة/المحكمة» يليها (بعد حشو قليل) إجراء من إجراءات السير في الدعوى ليست منطوقًا،
 * بل قرارًا مرحليًّا يرد في محاضر الجلسات قبل الأسباب: تأجيل، قفل باب المرافعة، إعادة فتحه، الإمهال،
 * الشطب، حجز القضية، الاكتفاء، رفع الجلسة، الإحالة، الندب، التكليف، المخاطبة، الإدخال، الضم، وقف السير.
 */
const DECIDED = `(?:(?:فل|ل)ذلك\\s+(?:فقد\\s+)?)?(?:وبه\\s+|فقد\\s+|ثم\\s+)?قررت\\s+(?:ال)?(?:دائر${H}|محكم${H})\\s+`;
const FILLER = `(?:(?:بال${A}جماع|بال${A}غلبي${H}|حينئذ|عندئذ|عندها|حينه|ذلك|بعد\\s+المداول${H}|في\\s+(?:هذه\\s+)?(?:ال)?جلس${H})\\s+){0,3}`;
const PROCEDURAL_OBJECT = [
  `(?:ال)?ت${A}جيل`,
  `(?:${A}?قفال|قفل|${A}?غلاق|غلق|(?:${A}عاد${H}\\s+)?فتح)\\s+باب\\s+(?:ال)?مرافع${H}`,
  `${A}عاد${H}\\s+(?:فتح|(?:ال)?(?:قضي${H}|دعو${Y})\\s+(?:ل|${A}ل${Y}\\s+)(?:ال)?(?:مرافع${H}|تحضير))`,
  `(?:ال)?${A}مهال`,
  `منح\\s`,
  `(?:ال)?شطب`,
  `حجز\\s+(?:ال)?(?:قضي${H}|دعو${Y})`,
  `(?:ال)?اكتفاء`,
  `رفع\\s+(?:ال)?جلس${H}`,
  `(?:ال)?${A}حال${H}`,
  `ندب`,
  `تكليف`,
  `مخاطب${H}`,
  `(?:ال)?كتاب${H}\\s+(?:${A}ل${Y}|ل)`,
  `${A}دخال`,
  `ضم\\s`,
  `وقف\\s+(?:ال)?(?:سير|نظر|فصل|دعو${Y}|قضي${H})`,
];
const PROCEDURAL_DECISION = new RegExp(`${DECIDED}${FILLER}[وب]?(?:${PROCEDURAL_OBJECT.join("|")})`, "uy");

/** هل المرسى عند p قرار إجرائي مرحلي («قررت الدائرة تأجيل الجلسة») لا منطوق؟ */
export function isProceduralDecision(text: string, p: number): boolean {
  PROCEDURAL_DECISION.lastIndex = p;
  return PROCEDURAL_DECISION.test(text);
}

/** عنوان الأسباب الصريح «الأسباب:» — أقوى من «وحيث إن» التي ترد في عرض الوقائع. */
const REASONS_HEADING = new RegExp(`${W}(?:ال)?${A}سباب\\s*[:：]`, "gu");

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
/**
 * v4: بدايات احتياطية لجسم الحكم (عرض الدعوى ومحضر الجلسات) حين لا يوجد مرسى دعوى أصلًا أو يأتي
 * متأخرًا (بعد ربع النص) فتتضخم الديباجة. مستخلصة من تشخيص مجمّع للديباجات الكبيرة في v3:
 * «حضر … المدعي»، «صحيفة/لائحة الدعوى»، «افتتحت/عقدت الجلسة»، «وفي الجلسة المنعقدة»، «ادعى/ادعت»،
 * «تقدم/أقام … المدعي». لا تُستعمل حين يوجد مرسى دعوى مبكر، فلا تغيّر الأحكام المقطّعة سليمًا.
 */
const CLAIMS_FALLBACK = [
  `${W}حضر\\s+(?:[^\\s]+\\s+){0,4}?(?:ال)?مدع${Y}`,
  `(?:صحيف${H}|لائح${H})\\s+(?:ال)?دعو${Y}`,
  `${W}(?:افتتحت|عقدت|انعقدت)\\s+(?:ال)?جلس${H}`,
  `${W}وف${Y}\\s+(?:ال)?جلس${H}\\s+(?:ال)?منعقد${H}`,
  `${W}[وف]?ادع(?:${Y}|ت)\\s`,
  `${W}[وف]?(?:تقدم|تقدمت|${A}قام|${A}قامت)\\s+(?:[^\\s]+\\s+){1,3}?(?:ال)?مدع${Y}`,
];
const LATE_CLAIMS = 0.25;
const PANEL_CLAIMS = [`(?:وذلك\\s+)?للنظر\\s+ف${Y}\\s+طلب`, `ف${Y}\\s+طلب\\s+النقض`];
const PANEL_REASONS = [`وبعد\\s+(?:ال)?اطلاع\\s+عل${Y}\\s+(?:ال${A}وراق|القضي${H}|ما\\s+تقدم)`, `وبعد\\s+المداول${H}`, `ودراستها\\s+وبعد`];

/** الختام. */
const CLOSING = [`وصل${Y}\\s+الله\\s+(?:وسلم\\s+)?عل${Y}\\s+نبينا`, `وبالله\\s+التوفيق`];

const rxs = (list: string[]) => list.map((s) => new RegExp(s, "gu"));
const R = {
  claims: rxs(CLAIMS_START), defense: rxs(DEFENSE_START), reasons: rxs(REASONS_START),
  disposition: rxs(DISPOSITION), appeal: rxs(APPEAL_AFTER), closing: rxs(CLOSING),
  panelClaims: rxs(PANEL_CLAIMS), claimsFallback: rxs(CLAIMS_FALLBACK), panelReasons: rxs(PANEL_REASONS),
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

  // المنطوق: المراسي القاطعة بعد استبعاد القرارات الإجرائية المرحلية («قررت الدائرة تأجيل…»).
  // إن ورد عنوان «الأسباب:» صريح يليه مرسى قاطع فالمنطوق أول مرسى قاطع بعد آخر عنوان كهذا،
  // والأسباب تبدأ عند العنوان. وإلا: أول مرسى قاطع في النصف الأخير، وإلا آخر مرسى قاطع أيًّا كان موضعه.
  const disp = positions(text, R.disposition).filter((p) => !isProceduralDecision(text, p));
  const headings = positions(text, [REASONS_HEADING]).filter((h) => disp.some((p) => p > h));
  const heading = headings.length ? headings[headings.length - 1] : null;
  const lateDisp = disp.filter((p) => (heading !== null ? p > heading : p >= n * 0.5));
  // العنوان الصريح للمنطوق في المنطقة المتأخرة يُقدَّم (آخر ظهور له)، ويُضم إليه مرسى قاطع يسبقه مباشرة
  // («لذلك حكمت الدائرة بما يلي: نص الحكم: …»). الإزاحة تشمل القوس الفاتح إن وُجد.
  const explicit = [...text.matchAll(EXPLICIT_DISPOSITION)].map((m) => m.index ?? 0)
    .filter((p) => (heading !== null ? p > heading : p >= n * 0.5));
  const lastExplicit = explicit.length ? explicit[explicit.length - 1] : null;
  const dispStart = lastExplicit !== null
    ? (lateDisp.find((p) => p >= lastExplicit - 80 && p < lastExplicit) ?? lastExplicit)
    : lateDisp.length ? lateDisp[0] : disp.length ? disp[disp.length - 1] : null;
  const panel = Boolean(opts.permanentPanel);
  const primaryClaims = firstAfter(positions(text, panel ? [...R.panelClaims, ...R.claims] : R.claims), 0, heading ?? dispStart ?? n);
  // مرسى الدعوى غائب أو متأخر: أبكر بداية احتياطية قبله (وقبل الأسباب/المنطوق).
  const fallbackClaims = primaryClaims === null || primaryClaims > n * LATE_CLAIMS
    ? firstAfter(positions(text, R.claimsFallback), 1, primaryClaims ?? heading ?? dispStart ?? n)
    : null;
  const claimsStart = fallbackClaims ?? primaryClaims;
  const defenseStart = panel ? null : firstAfter(positions(text, R.defense), claimsStart ?? 0, heading ?? dispStart ?? n);
  const reasonsStart = heading !== null && heading >= (defenseStart ?? claimsStart ?? 0)
    ? heading
    : firstAfter(positions(text, panel ? [...R.panelReasons, ...R.reasons] : R.reasons), defenseStart ?? claimsStart ?? 0, dispStart ?? n);
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
    confidence: type === "header" ? 0.9 : type === "claims" && fallbackClaims !== null ? 0.6 : 0.8,
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
