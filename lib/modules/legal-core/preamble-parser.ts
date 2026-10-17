/**
 * HKM-023-B ب-٢ — قارئ مقدمة النظام (أدوات الإصدار).
 *
 * يأخذ نص مقدمة خامًا (من legal_systems.preamble، أو من نص يلصقه المالك من المصدر الرسمي، أو من كتل
 * law_card بعد تركيبها) ويفكّكه إلى وحدات بمراسٍ لفظية:
 *   preamble_heading  البسملة، وعنوان الأداة («مرسوم ملكي رقم …»)، وعنوان النظام وسنته قبل الأدوات.
 *   opening           «بعون الله تعالى نحن …» أو «إن مجلس الوزراء».
 *   recital           كل استناد («بناءً على …»، «وبعد الاطلاع على …»، «وبعد النظر في …») وحدة.
 *   enacting_formula  «رسمنا بما هو آت» / «أمرنا بما هو آت» / «يقرر ما يلي» / «نخبركم بموافقتنا على ما يلي».
 *   operative_clause  كل بند (أولًا، ثانيًا …) وحدة؛ والمنطوق غير المرقّم بعد صيغة الإصدار وحدة واحدة.
 *   signature         سطر التوقيع («سلمان بن عبدالعزيز آل سعود»، «رئيس مجلس الوزراء»).
 *   unclassified      نص لا مرساة له (مثل سطر «النفاذ: …» الملحق عند الاستيراد). لا يُسقط أبدًا.
 *   issuing_instrument وحدة أب لكل أداة (المرسوم، ثم قرار المجلس …) فيها النوع والرقم والتاريخ؛ بلا نص.
 *
 * القاعدة الحاكمة: **إعادة التركيب الحرفي إلزامية**. وحدات النص (كل ما عدا issuing_instrument) تُبلِّط
 * الأصل: مجموعها بترتيب ordinal يساوي النص حرفًا بحرف، وكل وحدة [charStart, charEnd) متصلة بما بعدها.
 * إن اختل ذلك فالنتيجة ok=false ويُرفض التفكيك (لا يُنشر).
 *
 * المطابقة تجري على صورة «عارية» (بلا تشكيل ولا تطويل، والهمزات ألفًا) مع خريطة مواضع إلى الأصل؛
 * فالنص المخزّن يبقى كما ورد. نقي: بلا قاعدة ولا شبكة ولا Prisma.
 */

export const PREAMBLE_PARSER_VERSION = "preamble-parser/1";

export const PREAMBLE_UNIT_TYPES = [
  "issuing_instrument",
  "preamble_heading",
  "opening",
  "recital",
  "enacting_formula",
  "operative_clause",
  "signature",
  "unclassified",
] as const;
export type PreambleUnitType = (typeof PREAMBLE_UNIT_TYPES)[number];

export const INSTRUMENT_KINDS = ["royal_decree", "royal_order", "cabinet_decision", "other"] as const;
export type InstrumentKind = (typeof INSTRUMENT_KINDS)[number];

export type PreambleCompleteness = "complete" | "partial" | "issuance_line";

export interface PreambleInstrument {
  /** ترتيب الأداة في المقدمة (1 = الأولى). */
  index: number;
  kind: InstrumentKind | null;
  /** رقم الأداة كما في عنوانها («م/43»، «283»)، أو null إن لم يكن لها عنوان. */
  number: string | null;
  /** التاريخ الهجري بصيغة YYYY/M/D بأرقام لاتينية، أو null. */
  dateHijri: string | null;
  /** سطر العنوان كما ورد (بلا مسافات الطرفين)، أو null. */
  heading: string | null;
}

export interface PreambleUnit {
  ordinal: number;
  type: PreambleUnitType;
  /** النص الحرفي للوحدة (فارغ لـ issuing_instrument). */
  text: string;
  charStart: number;
  charEnd: number;
  /** ترتيب الأداة التي تنتمي إليها الوحدة، أو null لما هو خارج الأدوات. */
  instrumentIndex: number | null;
  /** ordinal وحدة الأداة الأب، أو null. */
  parentOrdinal: number | null;
  /** التسمية كما وردت («أولاً»، أو سطر العنوان)، أو null. */
  label: string | null;
  /** رقم البند المعياري («1»، «2» …)، أو null. */
  number: string | null;
  path: string;
  /** مرساة العرض والإحالة (preamble-i1-clause-2)، أو null. */
  anchor: string | null;
  /** للأب فقط. */
  instrument?: PreambleInstrument;
}

export interface PreambleParse {
  /** = reconstructionOk. false يعني رفض التفكيك. */
  ok: boolean;
  reconstructionOk: boolean;
  units: PreambleUnit[];
  instruments: PreambleInstrument[];
  completeness: PreambleCompleteness;
  /** أجزاء المقدمة الثلاثة في النص كله (أساس التصنيف). */
  parts: { opening: number; recitals: number; operative: number; enacting: number; signatures: number };
  warnings: string[];
  parserVersion: string;
}

// ── الصورة العارية وخريطة المواضع ────────────────────────────────────────────

const STRIP = new Set<string>();
for (let c = 0x064b; c <= 0x065f; c++) STRIP.add(String.fromCharCode(c));
STRIP.add("ٰ"); // ألف خنجرية
STRIP.add("ـ"); // تطويل
for (const z of ["​", "‌", "‍", "‎", "‏", "﻿"]) STRIP.add(z); // محارف صفرية العرض
// الهمزات ألفًا، والمسافة غير المنقسمة (موجودة في نصوص الهيئة) مسافةً؛ الطول لا يتغير.
const ALEF: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", " ": " ", " ": " " };

export interface BareText {
  bare: string;
  /** map[i] = موضع المحرف i من bare في الأصل؛ map[bare.length] = طول الأصل. */
  map: number[];
}

export function bareWithMap(raw: string): BareText {
  let bare = "";
  const map: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (STRIP.has(ch)) continue;
    bare += ALEF[ch] ?? ch;
    map.push(i);
  }
  map.push(raw.length);
  return { bare, map };
}

/** الصورة العارية وحدها (للمطابقة والإشارات). */
export function bareText(raw: string): string {
  return bareWithMap(raw).bare;
}

// ── المراسي ───────────────────────────────────────────────────────────────

const ORDINALS: Array<[string, number]> = [
  ["اولا", 1], ["ثانيا", 2], ["ثالثا", 3], ["رابعا", 4], ["خامسا", 5],
  ["سادسا", 6], ["سابعا", 7], ["ثامنا", 8], ["تاسعا", 9], ["عاشرا", 10],
  ["حادي عشر", 11], ["ثاني عشر", 12], ["ثالث عشر", 13], ["رابع عشر", 14], ["خامس عشر", 15],
  ["سادس عشر", 16], ["سابع عشر", 17], ["ثامن عشر", 18], ["تاسع عشر", 19], ["عشرون", 20],
];
const ORDINAL_ALT = ORDINALS.map(([w]) => w.replace(/ /g, "[ \\t]+")).join("|");
const ORDINAL_VALUE = new Map(ORDINALS.map(([w, n]) => [w, n]));

const RECITAL_PHRASE = "(?:و?(?:بعد[ \\t]+الاطلاع|بناء[ \\t]*على|بعد[ \\t]+النظر|بعد[ \\t]+الدراسة|بعد[ \\t]+اطلاعنا)|اطلعنا[ \\t]+على)";

const RE_BASMALA = /بسم[ \t]+الله[ \t]+الرحمن[ \t]+الرحيم/g;
// عنوان أداة في أول السطر يتبعه رقم: «مرسوم ملكي رقم (م/43) وتاريخ …»، «قرار رقم (116) …»، «تعميم رقم …».
const RE_HEADING = /(^|\n)[ \t]*([#*]*[ \t]*(?:مرسوم[ \t]+ملكي|امر[ \t]+ملكي|امر[ \t]+سامي|قرار[ \t]+مجلس[ \t]+الوزراء|قرار|تعميم|برقية[ \t]+تعميمية|برقية)[ \t]+رقم[ \t]*[(]?[ \t]*(?:[ما][ \t]*\/[ \t]*)?[0-9٠-٩])/g;
const RE_OPENING_ROYAL = /بعون[ \t]+الله[ \t]+تعالى/g;
const RE_OPENING_CABINET = /(^|\n)[ \t]*([#*]*[ \t]*ان[ \t]*مجلس[ \t]+الوزراء)/g;
const RE_RECITAL_LINE = new RegExp(`(^|[\\n.])[ \\t]*([*]*${RECITAL_PHRASE})`, "g");
const RE_RECITAL_ANY = new RegExp(RECITAL_PHRASE, "g");
const RE_ENACTING = /((?:رسمنا|امرنا)[ \t]+بما[ \t]+هو[ \t]+ات|ي?قرر[ \t]+(?:ما[ \t]+يلي|ما[ \t]+ياتي|الاتي)|و?نخبركم[ \t]+بموافقتنا[ \t]+على[ \t]+(?:ما[ \t]+يلي|ما[ \t]+ياتي|الاتي))[ \t]*[:：]?/g;
// «يقرر:» وحدها في أول السطر (قرارات المجلس بمنطوق واحد).
const RE_ENACTING_SHORT = /(^|[\n.])[ \t]*(ي?قرر[ \t]*[:：])/g;
const RE_CLAUSE = new RegExp(`(^|[\\n.:؛])[ \\t]*([*#]*[ \\t]*(${ORDINAL_ALT})[ \\t*]*[:\\-–—])`, "g");
const RE_SIGNATURE = /(^|\n)([ \t]*(?:رئيس[ \t]+مجلس[ \t]+الوزراء|نائب[ \t]+رئيس[ \t]+مجلس[ \t]+الوزراء|[^\n.:،؛]{2,40}?[ \t]ال[ \t]+سعود|[^\n.:،؛]{2,30}?[ \t]بن[ \t]+عبد[ \t]?العزيز|[^\n.:،؛]{2,60}?[ \t]ال[ \t]+سعود[ \t]*رئيس[ \t]+مجلس[ \t]+الوزراء)[ \t]*)(?=\n|$)/g;

type CandKind =
  | "basmala"
  | "heading"
  | "opening_royal"
  | "opening_cabinet"
  | "recital"
  | "enacting"
  | "clause"
  | "clause_unnumbered"
  | "signature"
  | "trailer";

interface Candidate {
  kind: CandKind;
  /** موضع بداية الوحدة في الصورة العارية. */
  pos: number;
  /** نهاية المطابقة في الصورة العارية. */
  end: number;
  label?: string;
  number?: string;
  synthetic?: boolean;
}

// عند تساوي الموضع: المراسي الحقيقية قبل المصطنعة، والأعلى بنيويًا أولًا.
const PRIORITY: Record<CandKind, number> = {
  basmala: 0,
  heading: 1,
  opening_royal: 2,
  opening_cabinet: 2,
  enacting: 3,
  recital: 4,
  clause: 5,
  signature: 6,
  clause_unnumbered: 7,
  trailer: 8,
};

function collect(re: RegExp, bare: string, kind: CandKind, group: number, out: Candidate[], extra?: (m: RegExpExecArray) => Partial<Candidate>) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bare))) {
    const g = m[group];
    if (g === undefined) continue;
    const start = m.index + m[0].length - g.length;
    // بداية الوحدة: أول محرف غير فراغ من المجموعة (الفراغات قبلها لما سبق).
    let pos = start;
    while (pos < m.index + m[0].length && /[ \t]/.test(bare[pos])) pos++;
    out.push({ kind, pos, end: m.index + m[0].length, ...(extra ? extra(m) : {}) });
    if (m[0].length === 0) re.lastIndex++;
  }
}

function firstNonSpace(bare: string, from: number): number {
  let p = from;
  while (p < bare.length && /\s/.test(bare[p])) p++;
  return p;
}

function lineEnd(bare: string, from: number): number {
  const i = bare.indexOf("\n", from);
  return i < 0 ? bare.length : i;
}

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** نوع الأداة ورقمها وتاريخها من سطر عنوانها. */
export function parseInstrumentHeading(line: string): { kind: InstrumentKind | null; number: string | null; dateHijri: string | null } {
  const b = bareText(line);
  let kind: InstrumentKind | null = null;
  if (/مرسوم[ \t]+ملكي/.test(b)) kind = "royal_decree";
  else if (/امر[ \t]+(?:ملكي|سامي)/.test(b)) kind = "royal_order";
  else if (/قرار[ \t]+مجلس[ \t]+الوزراء|^[ \t#*]*قرار[ \t]+رقم/.test(b)) kind = "cabinet_decision";
  else if (/تعميم|برقية/.test(b)) kind = "other";
  // الرقم من السطر الخام (لتبقى «أ/90» بهمزتها)، والتاريخ والنوع من الصورة العارية.
  const num = line.match(/رقم[ \t]*[(]?[ \t]*((?:[مأاإ][ \t]*\/[ \t]*)?[0-9٠-٩]+(?:[ \t]*\/[ \t]*[0-9٠-٩]+)?)/);
  const number = num ? toLatin(num[1].replace(/[ \t]+/g, "")) : null;
  const date = b.match(/(?:وتاريخ|بتاريخ|في)[ \t]*([0-9٠-٩]{1,4})[ \t]*\/[ \t]*([0-9٠-٩]{1,2})[ \t]*\/[ \t]*([0-9٠-٩]{1,4})/);
  let dateHijri: string | null = null;
  if (date) {
    const [a, m, c] = [toLatin(date[1]), toLatin(date[2]), toLatin(date[3])];
    const [y, d] = a.length === 4 ? [a, c] : [c, a];
    dateHijri = `${y}/${Number(m)}/${Number(d)}`;
  }
  return { kind, number, dateHijri };
}

type Phase = "none" | "pre" | "opening" | "recitals" | "enacting" | "operative" | "signed";

interface Accepted {
  kind: CandKind;
  pos: number;
  end: number;
  instrument: number | null;
  label?: string;
  number?: string;
}

function looksLikeTitleBlock(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length || lines.length > 6) return false;
  return lines.every((l) => l.length <= 160 && !/[:：]/.test(l.replace(/^#+\s*/, "")));
}

/** يفكّك نص المقدمة إلى وحدات. نقي وحتمي. */
export function parsePreamble(raw: string): PreambleParse {
  const text = String(raw ?? "");
  const { bare, map } = bareWithMap(text);
  const warnings: string[] = [];

  const cands: Candidate[] = [];
  collect(RE_BASMALA, bare, "basmala", 0, cands);
  collect(RE_HEADING, bare, "heading", 2, cands);
  collect(RE_OPENING_ROYAL, bare, "opening_royal", 0, cands);
  collect(RE_OPENING_CABINET, bare, "opening_cabinet", 2, cands);
  collect(RE_RECITAL_LINE, bare, "recital", 2, cands);
  collect(RE_ENACTING, bare, "enacting", 0, cands);
  collect(RE_ENACTING_SHORT, bare, "enacting", 2, cands);
  collect(RE_CLAUSE, bare, "clause", 2, cands, (m) => {
    const word = m[3].replace(/[ \t]+/g, " ");
    return { number: String(ORDINAL_VALUE.get(word) ?? ""), label: word };
  });
  collect(RE_SIGNATURE, bare, "signature", 2, cands);

  const sortCands = () =>
    cands.sort((a, b) => a.pos - b.pos || PRIORITY[a.kind] - PRIORITY[b.kind]);
  sortCands();

  const accepted: Accepted[] = [];
  const instruments: PreambleInstrument[] = [];
  let phase: Phase = "none";
  let current = 0; // ترتيب الأداة الجارية
  let cursor = 0; // لا تقبل مرساة داخل مطابقة سبقتها

  // تبدأ أداة جديدة وتعيد طورها (يُسند إلى phase عند النداء ليتبعه تحليل الأنواع).
  const startInstrument = (from: Phase, nextPhase: Phase): Phase => {
    if (from === "operative" || from === "enacting") warnings.push(`أداة ${current} بلا سطر توقيع`);
    current += 1;
    instruments.push({ index: current, kind: null, number: null, dateHijri: null, heading: null });
    return nextPhase;
  };
  const insert = (c: Candidate) => {
    cands.push(c);
    sortCands();
  };

  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (c.pos < cursor) continue;
    let accept = false;
    switch (c.kind) {
      case "basmala":
      case "heading": {
        if (c.kind === "heading" && (phase === "opening" || phase === "recitals" || phase === "enacting")) break;
        if (c.kind === "heading" && phase === "operative") {
          // عنوان أداة جديدة قبل توقيع السابقة: يُقبل إن كان سطرًا قصيرًا فيه تاريخ.
          const line = bare.slice(c.pos, lineEnd(bare, c.pos));
          if (line.length > 90 || !/(?:وتاريخ|بتاريخ)/.test(line)) break;
        }
        if (c.kind === "basmala" && (phase === "opening" || phase === "recitals" || phase === "enacting")) break;
        if (phase !== "pre") phase = startInstrument(phase, "pre");
        accept = true;
        if (c.kind === "heading") {
          const line = text.slice(map[c.pos], map[lineEnd(bare, c.pos)]).trim();
          const parsed = parseInstrumentHeading(line);
          const inst = instruments[current - 1];
          inst.heading = line;
          inst.kind = parsed.kind ?? inst.kind;
          inst.number = parsed.number;
          inst.dateHijri = parsed.dateHijri;
        }
        break;
      }
      case "opening_royal":
      case "opening_cabinet": {
        if (phase === "opening" || phase === "recitals" || phase === "enacting") break;
        if (phase !== "pre") phase = startInstrument(phase, "opening");
        phase = "opening";
        accept = true;
        const inst = instruments[current - 1];
        if (!inst.kind) inst.kind = c.kind === "opening_cabinet" ? "cabinet_decision" : "royal_decree";
        // أول استناد بعد الافتتاحية مرساة ولو التصق بها بلا سطر جديد ولا نقطة.
        RE_RECITAL_ANY.lastIndex = c.end;
        const m = RE_RECITAL_ANY.exec(bare);
        if (m && m.index - c.end <= 400 && !cands.some((x) => x.kind === "recital" && x.pos === m.index)) {
          insert({ kind: "recital", pos: m.index, end: m.index + m[0].length, synthetic: true });
        }
        break;
      }
      case "recital": {
        if (phase === "enacting" || phase === "operative") break;
        if (phase === "none" || phase === "signed") {
          phase = startInstrument(phase, "recitals");
          warnings.push(`أداة ${current} تبدأ باستناد بلا افتتاحية`);
        }
        phase = "recitals";
        accept = true;
        break;
      }
      case "enacting": {
        if (phase === "enacting" || phase === "operative" || phase === "signed") break;
        if (phase === "none") phase = startInstrument(phase, "enacting");
        phase = "enacting";
        accept = true;
        const inst = instruments[current - 1];
        if (/^امرنا/.test(bare.slice(c.pos)) && inst.kind === "royal_decree") inst.kind = "royal_order";
        // منطوق غير مرقّم بعد الصيغة: وحدة بند واحدة تبدأ بأول محرف بعدها.
        const p = firstNonSpace(bare, c.end);
        if (p < bare.length && !cands.some((x) => x.pos === p && x.kind !== "trailer" && x.kind !== "clause_unnumbered")) {
          insert({ kind: "clause_unnumbered", pos: p, end: p, synthetic: true });
        }
        break;
      }
      case "clause":
      case "clause_unnumbered": {
        if (c.kind === "clause_unnumbered" && phase !== "enacting") break;
        if (phase === "none" || phase === "signed") {
          phase = startInstrument(phase, "operative");
          warnings.push(`أداة ${current} تبدأ ببند منطوق بلا افتتاحية`);
        } else if (phase === "pre" || phase === "opening" || phase === "recitals") {
          warnings.push(`أداة ${current}: بند منطوق بلا صيغة إصدار`);
        }
        phase = "operative";
        accept = true;
        break;
      }
      case "signature": {
        if (phase !== "operative" && phase !== "enacting") break;
        phase = "signed";
        accept = true;
        // ما بعد سطر التوقيع ليس منه: يبدأ وحدة مستقلة إن لم تبدأه مرساة.
        const p = firstNonSpace(bare, lineEnd(bare, c.pos));
        if (p < bare.length) insert({ kind: "trailer", pos: p, end: p, synthetic: true });
        break;
      }
      case "trailer": {
        if (phase !== "signed") break;
        if (accepted.some((a) => a.pos === c.pos)) break;
        accept = true;
        break;
      }
    }
    if (!accept) continue;
    if (accepted.some((a) => a.pos === c.pos)) continue;
    accepted.push({
      kind: c.kind,
      pos: c.pos,
      end: c.end,
      instrument: c.kind === "trailer" ? null : current || null,
      label: c.label,
      number: c.number,
    });
    if (!c.synthetic) cursor = Math.max(cursor, c.end);
  }

  accepted.sort((a, b) => a.pos - b.pos);

  // ── بناء وحدات النص المُبلِّطة ──
  type Leaf = Omit<PreambleUnit, "ordinal" | "parentOrdinal" | "path" | "anchor"> & { kind: CandKind | "leading" };
  const leaves: Leaf[] = [];
  const rawPos = (p: number) => map[p];
  const firstStart = accepted.length ? rawPos(accepted[0].pos) : text.length;
  let leadingWs = "";
  if (firstStart > 0) {
    const lead = text.slice(0, firstStart);
    if (lead.trim()) {
      const type: PreambleUnitType = accepted.length && looksLikeTitleBlock(lead) ? "preamble_heading" : "unclassified";
      if (type === "unclassified") warnings.push("نص قبل أول مرساة بلا تصنيف");
      leaves.push({ kind: "leading", type, text: lead, charStart: 0, charEnd: firstStart, instrumentIndex: null, label: null, number: null });
    } else {
      leadingWs = lead; // فراغ بحت قبل أول مرساة يُضم إلى أول وحدة
    }
  }

  for (let k = 0; k < accepted.length; k++) {
    const a = accepted[k];
    const start = k === 0 && leadingWs ? 0 : rawPos(a.pos);
    const end = k + 1 < accepted.length ? rawPos(accepted[k + 1].pos) : text.length;
    const chunk = text.slice(start, end);
    let type: PreambleUnitType;
    switch (a.kind) {
      case "basmala":
      case "heading":
        type = "preamble_heading";
        break;
      case "opening_royal":
      case "opening_cabinet":
        type = "opening";
        break;
      case "recital":
        type = "recital";
        break;
      case "enacting":
        type = "enacting_formula";
        break;
      case "clause":
      case "clause_unnumbered":
        type = "operative_clause";
        break;
      case "signature":
        type = "signature";
        break;
      default:
        type = looksLikeTitleBlock(chunk) ? "preamble_heading" : "unclassified";
        if (type === "unclassified") warnings.push("نص بعد التوقيع بلا تصنيف");
    }
    let label: string | null = null;
    if (a.kind === "clause") label = text.slice(rawPos(a.pos), end).replace(/^[*#\s]+/, "").split(/[ \t*]*[:\-–—]/)[0].trim() || null;
    if (a.kind === "heading") label = instruments[(a.instrument ?? 1) - 1]?.heading ?? null;
    leaves.push({
      kind: a.kind,
      type,
      text: chunk,
      charStart: start,
      charEnd: end,
      instrumentIndex: a.kind === "trailer" ? null : a.instrument,
      label,
      number: a.kind === "clause" ? a.number || null : null,
    });
  }

  if (!accepted.length && !leaves.length && text.length) {
    leaves.push({ kind: "leading", type: "unclassified", text, charStart: 0, charEnd: text.length, instrumentIndex: null, label: null, number: null });
  }

  // ── ترقيم البنود غير المرقّمة، والأب، والمسارات ──
  const units: PreambleUnit[] = [];
  const parentOrdinal = new Map<number, number>();
  const counters = new Map<string, number>();
  const bump = (key: string) => {
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return n;
  };
  for (const leaf of leaves) {
    const inst = leaf.instrumentIndex;
    if (inst !== null && !parentOrdinal.has(inst)) {
      const children = leaves.filter((l) => l.instrumentIndex === inst);
      const info = instruments[inst - 1];
      parentOrdinal.set(inst, units.length);
      units.push({
        ordinal: units.length,
        type: "issuing_instrument",
        text: "",
        charStart: children[0].charStart,
        charEnd: children[children.length - 1].charEnd,
        instrumentIndex: inst,
        parentOrdinal: null,
        label: info.heading,
        number: info.number,
        path: `instr:${inst}`,
        anchor: `preamble-i${inst}`,
        instrument: info,
      });
    }
    const scope = inst === null ? "doc" : `instr:${inst}`;
    const short: Record<PreambleUnitType, string> = {
      issuing_instrument: "instr",
      preamble_heading: "heading",
      opening: "opening",
      recital: "recital",
      enacting_formula: "enacting",
      operative_clause: "clause",
      signature: "signature",
      unclassified: "unclassified",
    };
    const seq = bump(`${scope}/${short[leaf.type]}`);
    const number = leaf.type === "operative_clause" ? leaf.number ?? String(seq) : leaf.number;
    const path = inst === null ? `${short[leaf.type]}:${seq}` : `instr:${inst}/${short[leaf.type]}:${leaf.type === "operative_clause" ? number : seq}`;
    units.push({
      ordinal: units.length,
      type: leaf.type,
      text: leaf.text,
      charStart: leaf.charStart,
      charEnd: leaf.charEnd,
      instrumentIndex: inst,
      parentOrdinal: inst === null ? null : parentOrdinal.get(inst) ?? null,
      label: leaf.label,
      number,
      path,
      anchor: inst === null ? null : `preamble-i${inst}-${short[leaf.type]}-${leaf.type === "operative_clause" ? number : seq}`,
    });
  }

  const reconstructionOk = verifyTiling(text, units);
  if (!reconstructionOk) warnings.push("إعادة التركيب لا تطابق الأصل: التفكيك مرفوض");

  const count = (t: PreambleUnitType) => units.filter((u) => u.type === t).length;
  const parts = {
    opening: count("opening"),
    recitals: count("recital"),
    operative: count("operative_clause"),
    enacting: count("enacting_formula"),
    signatures: count("signature"),
  };
  if (current > 0 && !parts.signatures) warnings.push("لا سطر توقيع في المقدمة");

  return {
    ok: reconstructionOk,
    reconstructionOk,
    units,
    instruments,
    completeness: completenessFromParts(parts.opening, parts.recitals, parts.operative),
    parts,
    warnings,
    parserVersion: PREAMBLE_PARSER_VERSION,
  };
}

/** التصنيف الثلاثي من أجزاء المقدمة: كاملة = افتتاحية + استناد + منطوق؛ جزئية = بعضها؛ وإلا سطر إصدار فقط. */
export function completenessFromParts(opening: number, recitals: number, operative: number): PreambleCompleteness {
  const present = [opening > 0, recitals > 0, operative > 0].filter(Boolean).length;
  if (present === 3) return "complete";
  if (present > 0) return "partial";
  return "issuance_line";
}

/** دمج وحدات النص بترتيبها (بلا وحدات الأدوات الأب). */
export function reconstructPreamble(units: Array<Pick<PreambleUnit, "type" | "text" | "ordinal">>): string {
  return [...units]
    .sort((a, b) => a.ordinal - b.ordinal)
    .filter((u) => u.type !== "issuing_instrument")
    .map((u) => u.text)
    .join("");
}

/** التبليط: المجموع = الأصل حرفيًا، والمدى متصل من 0 إلى نهاية النص، ولا وحدة نص فارغة. */
export function verifyTiling(raw: string, units: Array<Pick<PreambleUnit, "type" | "text" | "ordinal" | "charStart" | "charEnd">>): boolean {
  const leaves = [...units].sort((a, b) => a.ordinal - b.ordinal).filter((u) => u.type !== "issuing_instrument");
  if (!raw.length) return leaves.length === 0;
  let at = 0;
  for (const u of leaves) {
    if (!u.text.length || u.charStart !== at || u.charEnd - u.charStart !== u.text.length) return false;
    if (raw.slice(u.charStart, u.charEnd) !== u.text) return false;
    at = u.charEnd;
  }
  return at === raw.length && reconstructPreamble(units) === raw;
}

// ── تركيب نص المقدمة من كتل law_card ───────────────────────────────────────

export interface LawCardTextBlock {
  kind: string;
  heading?: string | null;
  text: string;
}

/** كتل المقدمة في law_card (تُستبعد law_title لأنها بداية المتن). */
export const LAW_CARD_PREAMBLE_KINDS = new Set(["title", "year", "basmala", "royal_decree", "cabinet_decision", "royal_order", "preamble_other"]);

/**
 * نص خام حتمي من كتل law_card: لكل كتلة مقدمة سطر عنوانها (إن وُجد) ثم نصها، والكتل يفصلها سطر جديد.
 * هذا التركيب قاعدة الاستيراد من لقطة المصدر (ب-٤)، وبصمته تُحفظ مع النسخة.
 */
export function composeLawCardText(blocks: LawCardTextBlock[]): string {
  return blocks
    .filter((b) => LAW_CARD_PREAMBLE_KINDS.has(b.kind) && typeof b.text === "string")
    .map((b) => (b.heading && b.heading.trim() ? `${b.heading}\n${b.text}` : b.text))
    .join("\n");
}
