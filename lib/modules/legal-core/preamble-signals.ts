/**
 * HKM-023-B ب-٣ — إشارات تصنيف المقدمات القائمة، وأولوية القطاعات.
 *
 * التصنيف الثلاثي (الأمر §٤ ب-٣):
 *   complete       «كاملة»: افتتاحية + استناد واحد على الأقل + منطوق (بنود مرقّمة أو صيغة إصدار).
 *   partial        «جزئية»: بعض الأجزاء الثلاثة لا كلها.
 *   issuance_line  «سطر إصدار فقط»: لا شيء من الأجزاء الثلاثة (سطر «صدر بالمرسوم …» أو «أداة الإصدار: …»،
 *                  أو عنوان وتاريخ، أو مقدمة سردية، أو متن تسرّب إلى حقل المقدمة، أو نص طويل بلا بنية). السبب في reason.
 *
 * لماذا أنماط نصية لا القارئ نفسه: التصنيف يُشغَّل على الإنتاج بقراءة فقط عبر SQL (لا اتصال مباشر من بيئة
 * الجلسة)، فالأنماط هنا مكتوبة بصيغة يفهمها محرك Postgres (ARE) ومحرك JS بالمعنى نفسه، والقرار
 * (classifyPreambleSignals) دالة TS واحدة تطبَّق على إشارات أيٍّ من المصدرين. اختبار التكافؤ يشغّل SQL
 * المولَّد على Postgres محلي ويقارنه بـ extractPreambleSignals على العيّنات نفسها.
 * نقي: بلا قاعدة.
 */
import { bareText, completenessFromParts, type PreambleCompleteness } from "./preamble-parser";

const S = "[ \\t]";
const ORD = "اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا|حادي[ \\t]+عشر|ثاني[ \\t]+عشر|ثالث[ \\t]+عشر|رابع[ \\t]+عشر|خامس[ \\t]+عشر|سادس[ \\t]+عشر|سابع[ \\t]+عشر|ثامن[ \\t]+عشر|تاسع[ \\t]+عشر|عشرون";

/**
 * الأنماط على «الصورة العارية» (بلا تشكيل ولا تطويل ولا محارف صفرية، والهمزات ألفًا، والمسافة غير المنقسمة مسافة).
 * قيود التكافؤ: لا \b ولا lookaround ولا \p{}؛ ^ لبداية النص فقط (بلا علم m).
 */
export const PREAMBLE_SIGNAL_PATTERNS = {
  opening: `بعون${S}+الله${S}+تعالى|(^|\\n)${S}*[#*]*${S}*ان${S}*مجلس${S}+الوزراء`,
  recital: `(^|[\\n.])${S}*[*]*(و?(بعد${S}+الاطلاع|بناء${S}*على|بعد${S}+النظر|بعد${S}+الدراسة|بعد${S}+اطلاعنا)|اطلعنا${S}+على)|(الوزراء|السعودية|تعالى)${S}*و?(بعد${S}+الاطلاع|بناء${S}*على)`,
  enacting: `(رسمنا|امرنا)${S}+بما${S}+هو${S}+ات|ي?قرر${S}+(ما${S}+يلي|ما${S}+ياتي|الاتي)|(^|[\\n.])${S}*ي?قرر${S}*:|نخبركم${S}+بموافقتنا`,
  clause: `(^|[\\n.:؛])${S}*[*#]*${S}*(${ORD})[ \\t*]*[:\\-–—]`,
  issuance: `اداة${S}+الاصدار|صدر|الصادر|بموجب|مرسوم${S}+ملكي|قرار${S}+مجلس${S}+الوزراء|قرار${S}+رقم|امر${S}+ملكي|المعتمد|بقرار`,
  body: `(^|\\n)[ \\t#*(]*(المادة|الباب|الفصل|القسم)${S}*(الاولى|الاول)|(المادة|الباب|الفصل)${S}*(الاولى|الاول)${S}*:`,
  narrative: `مقدمة|تمهيد`,
} as const;

export type SignalName = keyof typeof PREAMBLE_SIGNAL_PATTERNS;
export const SIGNAL_NAMES = Object.keys(PREAMBLE_SIGNAL_PATTERNS) as SignalName[];
export type PreambleSignals = Record<SignalName, number>;

const COMPILED = Object.fromEntries(SIGNAL_NAMES.map((k) => [k, new RegExp(PREAMBLE_SIGNAL_PATTERNS[k], "g")])) as Record<SignalName, RegExp>;

/** عدّ المطابقات غير المتداخلة لكل إشارة على الصورة العارية (= regexp_count في Postgres). */
export function extractPreambleSignals(raw: string): PreambleSignals {
  const b = bareText(String(raw ?? ""));
  const out = {} as PreambleSignals;
  for (const k of SIGNAL_NAMES) {
    const re = COMPILED[k];
    re.lastIndex = 0;
    let n = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b))) {
      n++;
      if (m[0].length === 0) re.lastIndex++;
    }
    out[k] = n;
  }
  return out;
}

export type IssuanceReason = "issuance_phrase" | "body_leak" | "narrative_intro" | "title_date_only" | "unstructured_text";

export interface PreambleClassification {
  completeness: PreambleCompleteness;
  /** للجزئية: الأجزاء الغائبة («missing:opening+recital»)؛ ولسطر الإصدار: سببه. */
  reason: string;
  bodyLeak: boolean;
}

/** القرار من الإشارات. المنطوق = بند مرقّم أو صيغة إصدار. length يفرّق «عنوان وتاريخ» (≤300 حرف) عن نص طويل بلا بنية. */
export function classifyPreambleSignals(s: PreambleSignals, length?: number): PreambleClassification {
  const operative = s.clause > 0 || s.enacting > 0 ? 1 : 0;
  const completeness = completenessFromParts(s.opening, s.recital, operative);
  const bodyLeak = s.body > 0;
  let reason = "";
  if (completeness === "partial") {
    const missing = [s.opening ? null : "opening", s.recital ? null : "recital", operative ? null : "operative"].filter(Boolean);
    reason = `missing:${missing.join("+")}`;
  } else if (completeness === "issuance_line") {
    const r: IssuanceReason = s.issuance > 0 ? "issuance_phrase" : bodyLeak ? "body_leak" : s.narrative > 0 ? "narrative_intro" : (length ?? 0) > 300 ? "unstructured_text" : "title_date_only";
    reason = r;
  } else {
    reason = "all_parts";
  }
  return { completeness, reason, bodyLeak };
}

// ── مولّد SQL المكافئ (قراءة فقط) ─────────────────────────────────────────

/** نفس خريطة bareWithMap: ما يُحذف، وما يُبدَّل. */
function translateArgs(): { from: string; to: string } {
  const mapped: Array<[number, string]> = [
    [0x0623, "ا"], [0x0625, "ا"], [0x0622, "ا"], [0x00a0, " "], [0x202f, " "],
  ];
  const stripped: number[] = [];
  for (let c = 0x064b; c <= 0x065f; c++) stripped.push(c);
  stripped.push(0x0670, 0x0640, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0xfeff);
  // chr() بدل المحارف نفسها كي لا يعبث أي ناقل بترتيب علامات التشكيل.
  const from = [...mapped.map(([c]) => c), ...stripped].map((c) => `chr(${c})`).join("||");
  const to = `'${mapped.map(([, t]) => t).join("")}'`;
  return { from, to };
}

const sqlLit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * استعلام قراءة فقط يعيد لكل نظام له مقدمة: المعرّف، وأول 8 من md5 اسمه، والمجال، والطول، والإشارات،
 * وهل في law_card نص أداة إصدار باستنادات (مصدر مكتمل متاح للتحويل).
 * opts.table يسمح بتشغيله على جدول اختبار محلي له الأعمدة id/name/domain/preamble.
 */
export function buildPreambleSignalsSql(opts: { table?: string; withLawCard?: boolean; whereIds?: string[] } = {}): string {
  const table = opts.table ?? "legal_systems";
  const { from, to } = translateArgs();
  const counts = SIGNAL_NAMES.map((k) => `regexp_count(src.b, ${sqlLit(PREAMBLE_SIGNAL_PATTERNS[k])}) AS ${k}`).join(",\n  ");
  const lc = opts.withLawCard === false
    ? "0 AS law_card_full"
    : `CASE WHEN EXISTS (
      SELECT 1 FROM (SELECT DISTINCT ON (system_id) system_id, text_blocks FROM law_card WHERE system_id = src.id ORDER BY system_id, created_at DESC, id DESC) c,
             jsonb_array_elements(c.text_blocks) x
      WHERE x->>'kind' IN ('royal_decree','cabinet_decision','royal_order') AND (x->>'text') ~ '(بناء|الاطلاع)'
    ) THEN 1 ELSE 0 END AS law_card_full`;
  const ids = opts.whereIds?.length ? ` AND s.id IN (${opts.whereIds.map(sqlLit).join(",")})` : "";
  return `WITH src AS (
  SELECT s.id, s.name, coalesce(s.domain, '') AS domain, s.preamble AS t, translate(s.preamble, ${from}, ${to}) AS b
  FROM ${table} s
  WHERE s.preamble IS NOT NULL AND btrim(s.preamble) <> ''${ids}
)
SELECT src.id, left(md5(src.name), 8) AS name_md5, src.domain, length(src.t) AS len,
  ${counts},
  ${lc}
FROM src
ORDER BY src.id`;
}

// ── أولوية القطاعات (الأمر: التقاضي، ثم التجاري، ثم العمل، ثم العقاري، ثم الإداري) ──

export const PREAMBLE_SECTORS = [
  { rank: 1, key: "litigation", label: "التقاضي" },
  { rank: 2, key: "commercial", label: "التجاري والمالي" },
  { rank: 3, key: "labor", label: "العمل والاجتماعي والجزائي" },
  { rank: 4, key: "realestate", label: "العقاري والملكية الفكرية" },
  { rank: 5, key: "administrative", label: "الإداري والقضائي" },
  { rank: 6, key: "other", label: "أخرى (قطاعي/صحي/غير مصنف)" },
] as const;
export type PreambleSectorKey = (typeof PREAMBLE_SECTORS)[number]["key"];

// التجميع على بنية الدفعات الخمس المسلّمة (نواة التقاضي، التجاري والمالي، العمل والاجتماعي والجزائي،
// العقاري والملكية الفكرية، الإداري والقضائي).
const DOMAIN_SECTOR: Record<string, PreambleSectorKey> = {
  procedure: "litigation",
  evidence: "litigation",
  enforcement: "litigation",
  arbitration: "litigation",
  civil: "litigation",
  personal_status: "litigation",
  notarization: "litigation",
  commercial: "commercial",
  companies: "commercial",
  tax_finance: "commercial",
  consumer: "commercial",
  labor: "labor",
  criminal: "labor",
  realestate: "realestate",
  ip: "realestate",
  admin: "administrative",
  judiciary: "administrative",
  regulatory: "other",
  health: "other",
};

// للأنظمة بلا مجال (642 نظامًا في الإنتاج): كلمات من الاسم بعد التطبيع، بهذا الترتيب.
const NAME_RULES: Array<[PreambleSectorKey, RegExp]> = [
  ["litigation", /المرافعات|الاثبات|نظام التنفيذ|لنظام التنفيذ|التحكيم|المحاماه|التوثيق|الاحوال الشخصيه|المعاملات المدنيه|الاجراءات الجزائيه|الافلاس|المحاكم|الاعتراض على الاحكام|الاستئناف|المصالحه|قسمه الاموال|الخبره امام/],
  ["labor", /نظام العمل|لنظام العمل|العمال|التامينات الاجتماعيه|التقاعد|الضمان الاجتماعي|العقوبات|الجزائي|المخدرات|الاتجار بالاشخاص|غسل الاموال|الارهاب|الرشوه|التزوير|الجرائم|جرائم/],
  ["realestate", /العقار|التسجيل العيني|الاراضي|التملك|الايجار|نزع ملكيه|الملكيه الفكريه|براءات الاختراع|العلامات التجاريه|حقوق المؤلف|التصميمات|التصاميم/],
  ["commercial", /الشركات|التجاري|التجاره|الرهن|المنافسه|المستهلك|الاوراق الماليه|السوق الماليه|البنوك|البنك|التمويل|الضريبه|الضرائب|الزكاه|الجمارك|التامين|الاستثمار|المصرفي|الافلاس/],
  ["administrative", /الخدمه المدنيه|ديوان المظالم|القضاء|النيابه|الوظائف|الموظفين|الترتيبات التنظيميه|مجلس الوزراء|المناطق|البلديات|الاداري|المنافسات والمشتريات|مكافحه الفساد/],
];

function normName(name: string): string {
  return bareText(name).replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}

export function preambleSector(input: { domain?: string | null; name: string }): { key: PreambleSectorKey; rank: number; label: string; source: "domain" | "name" | "none" } {
  const pick = (key: PreambleSectorKey, source: "domain" | "name" | "none") => {
    const s = PREAMBLE_SECTORS.find((x) => x.key === key)!;
    return { key, rank: s.rank, label: s.label, source };
  };
  const d = String(input.domain ?? "").trim();
  if (d && DOMAIN_SECTOR[d] && DOMAIN_SECTOR[d] !== "other") return pick(DOMAIN_SECTOR[d], "domain");
  const n = normName(input.name);
  for (const [key, re] of NAME_RULES) if (re.test(n)) return pick(key, "name");
  if (d && DOMAIN_SECTOR[d]) return pick(DOMAIN_SECTOR[d], "domain");
  return pick("other", "none");
}

// ── الصف والترتيب والـ CSV ─────────────────────────────────────────────────

export interface PreambleClassRow {
  systemId: string;
  name: string;
  domain: string;
  length: number;
  signals: PreambleSignals;
  lawCardFull: boolean;
}

export interface PreambleClassOut extends PreambleClassRow, PreambleClassification {
  rank: number;
  sector: ReturnType<typeof preambleSector>;
}

const CLASS_LABEL: Record<PreambleCompleteness, string> = { complete: "كاملة", partial: "جزئية", issuance_line: "سطر إصدار فقط" };
export const completenessLabel = (c: PreambleCompleteness) => CLASS_LABEL[c];

/** يرتب بأولوية القطاع، ثم «نظام» قبل غيره، ثم الاسم. */
export function classifyAndOrder(rows: PreambleClassRow[]): PreambleClassOut[] {
  const collator = new Intl.Collator("ar");
  const out = rows.map((r) => ({ ...r, ...classifyPreambleSignals(r.signals, r.length), sector: preambleSector({ domain: r.domain, name: r.name }), rank: 0 }));
  out.sort((a, b) => {
    if (a.sector.rank !== b.sector.rank) return a.sector.rank - b.sector.rank;
    const an = a.name.trim().startsWith("نظام") ? 0 : 1;
    const bn = b.name.trim().startsWith("نظام") ? 0 : 1;
    if (an !== bn) return an - bn;
    return collator.compare(a.name, b.name) || a.systemId.localeCompare(b.systemId);
  });
  out.forEach((r, i) => (r.rank = i + 1));
  return out;
}

const csvCell = (v: string | number | boolean) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const PREAMBLE_CSV_HEADER = [
  "priority_rank", "sector", "sector_source", "system_id", "name", "class", "class_ar", "reason", "length",
  "opening", "recitals", "enacting", "clauses", "issuance", "body_leak", "law_card_full",
];

export function toPreambleCsv(rows: PreambleClassOut[]): string {
  const lines = [PREAMBLE_CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push([
      r.rank, r.sector.label, r.sector.source, r.systemId, r.name, r.completeness, completenessLabel(r.completeness), r.reason, r.length,
      r.signals.opening, r.signals.recital, r.signals.enacting, r.signals.clause, r.signals.issuance, r.bodyLeak ? 1 : 0, r.lawCardFull ? 1 : 0,
    ].map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}
