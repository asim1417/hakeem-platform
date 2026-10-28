/**
 * word-match — مطابقة لفظية بحدود الكلمة لأدوات الحصر (HKM-044، المرحلة صفر من أدوات الباحث).
 *
 * العلة التي يعالجها: الحصر كان يطابق جزء الكلمة (ILIKE '%لفظ%')، فالتقطت «التعدي» كلمة «التعديل»،
 * و«ربا» كلمة «الأرباح»، وصيغة «غبون» المولَّدة كلمة «يرغبون» (أربع نتائج من عشر في بحث «الغبن»).
 *
 * القاعدة: اللفظ يطابق كلمة كاملة في النص المطبَّع، وصورتها أحد اثنين:
 *   • معرّفة: [و|ف]؟ ثم ال أو بال أو كال أو لل، ثم الأصل ولاحقة تصريف — بلا ضمير (لا تجتمع «ال» والضمير):
 *     فلا تطابق «شرط» «الشرطة» ولا «مال» «المالك».
 *   • نكرة: [و|ف]؟ ثم [ب|ك|ل]؟، ثم الأصل ولاحقة تصريف ثم ضمير غائب (ه، ها، هم، هما، هن، نا)؛ وضمير المخاطب
 *     والمتكلم (ك، ي) في derivatives وحده، لأنهما يصادفان أصل الكلمة («مالك»، «مالي» ليستا من «مال»).
 * وفي وضع «derivatives» وحده: حروف المضارعة والاشتقاق قبل الأصل (س، ا، ي، ت، ن، م، ثم ن، ت، ست:
 * سيفسخ، ينفسخ، انفساخ، مفسوخ، استحق) ولواحق النسبة (ي، يه، يا، يات، يين، يان: التعويضية، تعويضيًا).
 * ولا يجوز غير ذلك: «التعدي» لا تطابق «التعديل»، و«غبون» لا تطابق «يرغبون».
 *
 * لفظ ينتهي بتاء مربوطة («الشركة»، أو «الشركه» بالهاء وأصلها أربعة أحرف فأكثر) يطابق صورها:
 * شركة، شركته، شركات، شركاتها، شركتين؛ وصورها التي تصادف كلمة وظيفية («آلة» ← «التي»، «الدية» ← «لديه») يمنعها حاجز الكلمات الوظيفية.
 * «ال» و«لل» التي كتبها المستخدم تُجرَّد إن بقي ثلاثة أحرف («الغبن» تطابق «غبن» و«بالغبن»)، والصورة كاملة
 * باقية بديلًا. ولا تُجرَّد السوابق المركبة («والدين» كلمة لا «و+الدين»، و«بالغين» كلمة لا «ب+الغين»)، ولا «ال»
 * من «الله» ولا من همزة «إلزام». الكلمات الوظيفية (التي، لديه، عليه…) لا تُلتقط إلا إن كانت هي اللفظ.
 * اللفظ غير العربي (رقم أو لاتيني) يطابق كلمة كاملة بلا لواحق («30» لا تطابق «300»، وتطابق «٣٠»).
 * العبارة («فسخ العقد») كلماتها بترتيبها يفصل بينها فاصل غير حرفي، وأقصاها 16 كلمة (ما زاد يُعلَن مقطوعًا).
 *
 * النمط واحد للقاعدة (Postgres ARE بـ ~*) وللكود (RegExp بـ iu)، ويُختبر على الاثنين.
 * وضع «contains» يُبقي السلوك القديم (جزء الكلمة) لمن طلبه صراحة.
 *
 * حدود معروفة (يعالجها قاموس الجذور في المرحلة الثانية): التطبيع يجمع «ة» و«ه» («عملة» = «عمله»)، والهمزات
 * («آلية» = «إليه»)؛ والمنقوص المنوّن («تعدٍّ»، «قاضٍ») لا تطابقه صورته بالياء؛ والجمع المكسر («عقود») ليس من صور «عقد».
 */

export type MatchMode = "word" | "derivatives" | "contains" | "exact";
/** أوضاع الحصر (hakeem_enumerate). «exact» لأدوات العبارة وحدها (HKM-044 المرحلة الأولى). */
export const MATCH_MODES: readonly MatchMode[] = ["word", "derivatives", "contains"] as const;

/** حروف عربية بعد التطبيع: ء–ؿ، ف–ي، والممتدة ٱ–ۓ (الكاف والياء الفارسيتان في النصوص المكشوطة). */
const AR_LETTER = "ء-ؿف-يٱ-ۓ";
/** ما يُعدّ جزءًا من الكلمة عند فحص الحد: الحروف العربية والأرقام والحروف اللاتينية. */
const WORD_CHAR = `${AR_LETTER}0-9٠-٩a-zA-Z`;
const BOUNDARY_BEFORE = `(?:^|[^${WORD_CHAR}])`;
const BOUNDARY_AFTER = `(?:$|[^${WORD_CHAR}])`;
const GAP = `[^${WORD_CHAR}]+`;

/** سوابق المعرّفة: عطف اختياري، ثم «ال» بجر اختياري، أو «لل». */
const PROC_DEF = "(?:[وف]?(?:[بك]?ال|لل))";
/** سوابق النكرة: عطف اختياري ثم جر اختياري. */
const PROC_INDEF = "(?:[وف]?[بكل]?)";
/** حروف المضارعة والاشتقاق (وضع derivatives): سيفسخ، ينفسخ، انفسخ، تفسخ، مفسوخ، منفسخ، استحق، مستحق. */
const DERIV = "(?:س?[ايتنم]?(?:ست|ن|ت)?)";
/** لواحق التصريف (الوضعان). */
const INFL_CORE = "ات|ان|ين|ون|وا|و|تا|تم|تن|نا|ت|ا";
/** ولواحق النسبة (وضع derivatives وحده): التعويضية، تعويضيًا، الشرعيين. */
const INFL_NISBA = "يات|يين|يان|يه|يا|ي";
/**
 * الضمائر، للنكرة وحدها. نص الأنظمة بضمير الغائب: وضع word يقبل (ه، ها، هم، هما، هن، نا) وحده، لأن «ك» و«ي» تصادفان
 * أصل الكلمة أو نسبتها (فحص 24/10 على المدونة: «مال» التقطت «مالك» 489 مرة و«مالي» 409). وضع derivatives يضيفهما.
 * بلا «ني» (ضمير المتكلم للفعل): «رباني» (م398 من نظام المحكمة التجارية) لا تطابق «ربا».
 */
const PRON_WORD = "(?:هما|هم|هن|ها|نا|ه)?";
const PRON_DERIV = "(?:هما|كما|هم|هن|كم|كن|ها|نا|ه|ك|ي)?";
/** صور التاء المربوطة بعد تطبيع «ة» إلى «ه»: للمعرّفة بلا ضمير، وللنكرة مع الضمير. */
const TA_DEF = "(?:ه|ات|تان|تين)";
const TA_INDEF = "(?:ه|ت|ات|تا|تان|تين)";

/**
 * كلمات وظيفية لا تُلتقط بنمط لفظ آخر (بعد التطبيع): «الدية» كانت تطابق «لديه»، و«آلة» تتوسع إلى «التي».
 * إن كان اللفظ نفسه منها بعد التطبيع («آلية» = «إليه») رُفع الحاجز ووُسم اللفظ ملتبسًا.
 */
const STOP_WORDS = [
  "التي", "الذي", "الذين", "اللذين", "اللتين", "اللاتي", "اللواتي",
  "اليه", "اليها", "اليهم", "اليهما", "الي", "الا",
  "لديه", "لديها", "لديهم", "لديهما", "لدي",
  "عليه", "عليها", "عليهم", "عليهما", "فيه", "فيها", "فيهم", "فيهما",
  "منه", "منها", "منهم", "منهما", "عنه", "عنها", "عنهم", "عنهما",
  "له", "لها", "لهم", "لهما", "به", "بها", "بهم", "بهما",
  "اذا", "انه", "انها", "لانه", "لانها", "كما", "مما", "هذه", "هذا", "ذلك", "تلك",
];
const STOP_SET = new Set(STOP_WORDS);
const STOP_GUARD = `(?!(?:${STOP_WORDS.join("|")})(?:$|[^${WORD_CHAR}]))`;

/** الأرقام الهندية تُقرأ لاتينية في التطبيع (القاعدة والكود). */
const INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** التطبيع المشترك: الهمزات والوصلية، الألف المقصورة، التاء المربوطة، الواو والياء المهموزتان، الأرقام الهندية؛ وحذف التشكيل والتطويل. */
export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, "") // التشكيل والتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** translate() في Postgres مطابق لـ normalizeAr: from وto بالترتيب، وما زاد في from يُحذف. */
export const NORM_TRANSLATE_FROM =
  "أإآٱىةؤئ" +
  INDIC_DIGITS +
  Array.from({ length: 0x065f - 0x064b + 1 }, (_, i) => String.fromCharCode(0x064b + i)).join("") +
  "ٰـ";
export const NORM_TRANSLATE_TO = "اااايهوي" + "0123456789";

/** تعبير التطبيع في SQL لعمود نصي. */
export function normSqlExpr(column: string): string {
  return `translate(${column}, '${NORM_TRANSLATE_FROM}', '${NORM_TRANSLATE_TO}')`;
}

/**
 * ما يحذفه التطبيع (التشكيل U+064B–U+065F، والألف الخنجرية، والتطويل) صنفًا في نمط، بمهارب \uXXXX لا بالحروف نفسها:
 * تطبيع يونيكود (NFC) في أي طبقة يعيد ترتيب العلامات المركّبة بدرجة اتصالها فيقلب المدى («ً-ٰ» يبتلع الأرقام الهندية
 * و«٫»)، كما وقع في قياس 24/10 عبر أداة الاستعلام. المهارب يفهمها Postgres (ARE) وRegExp معًا.
 */
const MARKS_CLASS = "[\\u064B-\\u065F\\u0670\\u0640]";
const RAW_VARIANTS: Record<string, string> = { "ا": "[اأإآٱ]", "ي": "[يىئ]", "ه": "[هة]", "و": "[وؤ]" };

/**
 * نمط على النص الخام يكافئ «النص المطبَّع يحوي literal» (translate ثم ILIKE) تمامًا: كل حرف بصوره قبل التطبيع
 * (ا ← أإآٱ، ي ← ىئ، ه ← ة، و ← ؤ، والرقم بصورته الهندية)، وبين كل حرفين ما يحذفه التطبيع. يُستعمل تصفيةً مسبقة
 * على العمود نفسه فتُدفع إلى مسح الجدول، ولا يُحسب التطبيع (translate، أغلى ما في الاستعلام) إلا لما يجتازها
 * (قياس 24/10 على 28,910 مادة: 3.1 ث بالتطبيع لكل صف، و0.16 ث بهذا النمط، بالعدد نفسه).
 */
export function rawLiteralPattern(literal: string): string {
  const chars = Array.from(String(literal ?? ""));
  return chars
    .map((ch) => {
      if (RAW_VARIANTS[ch]) return RAW_VARIANTS[ch];
      if (/[0-9]/.test(ch)) return `[${ch}${String.fromCharCode(0x0660 + Number(ch))}]`;
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join(`${MARKS_CLASS}*`);
}

/** يزيل التشكيل والتطويل فقط (يبقى الشكل الخام للتاء المربوطة والهمزة). */
function stripMarks(s: string): string {
  return s.replace(/[ً-ٰٟـ]/g, "");
}

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const escapeRe = (s: string) => s.replace(RE_SPECIAL, "\\$&");
const IS_ARABIC_WORD = new RegExp(`^[${AR_LETTER}]+$`, "u");

export const MAX_PHRASE_WORDS = 16;

export interface CompiledWord {
  /** النمط الكامل للكلمة بلا حدودها. */
  pattern: string;
  /** أطول نص حرفي يرد في كل مطابقة (للتصفية المسبقة بـ ILIKE). */
  literal: string;
  /** اللفظ بعد التطبيع كلمة وظيفية («آلية» = «إليه»): قد تُلتقط معه. */
  ambiguousWith?: string;
}

/** نمط كلمة عربية واحدة بحسب الوضع. rawWord بلا فواصل. */
export function arabicWordPattern(rawWord: string, mode: Exclude<MatchMode, "contains" | "exact">): CompiledWord {
  const raw = stripMarks(rawWord);
  const full = normalizeAr(raw);
  let core = full;
  let stripped = false;
  // «ال» أو «لل» كتبها المستخدم (بلا همزة في الخام) تُجرَّد إن بقي ثلاثة أحرف؛ لا السوابق المركبة (مراجعة الجودة ١).
  if (raw.startsWith("ال") && raw.length - 2 >= 3) {
    core = full.slice(2);
    stripped = true;
  } else if (raw.startsWith("لل") && raw.length - 2 >= 3) {
    core = full.slice(2);
    stripped = true;
  }

  const infl = `(?:${mode === "derivatives" ? `${INFL_NISBA}|` : ""}${INFL_CORE})?`;
  const PRON = mode === "derivatives" ? PRON_DERIV : PRON_WORD;
  const trueTa = raw.endsWith("ة");
  const hTa = !trueTa && raw.endsWith("ه") && core.length >= 4;
  const def: string[] = [];
  const indef: string[] = [];
  let literal = core;
  const addCore = (c: string) => {
    const base = c.slice(0, -1);
    const taOk = (trueTa || hTa) && c.endsWith("ه") && base.length >= 2;
    if (taOk) {
      def.push(`${base}${TA_DEF}`);
      indef.push(`${base}${TA_INDEF}${PRON}`);
    }
    if (!taOk || hTa) {
      // الهاء الأصلية («تنبيه») تبقى صورتها العادية أيضًا («تنبيهات»).
      def.push(`${c}${infl}`);
      indef.push(`${c}${infl}${PRON}`);
    }
    return taOk ? base : c;
  };
  literal = addCore(core);
  if (stripped) {
    // الصورة كاملة بديلًا: «الزام» المكتوبة بلا همزة = «إلزام»، فتطابق «الإلزام» و«إلزامه».
    addCore(full);
  } else if (raw.startsWith("ال") && core.length >= 3) {
    // «الحق» (كتب المستخدم «ال» ولم تُجرَّد لقصرها): صورة «للحق» بإبدال الألف لامًا، والتصفية على المشترك («لحق»).
    // لا لـ«آلة» ولا «إلزام» (ليست «ال» في الخام)، فلا تتوسع «آلة» إلى «لله».
    def.push(`ل${def[def.length - 1].slice(1)}`);
    indef.push(`ل${indef[indef.length - 1].slice(1)}`);
    literal = literal.slice(1);
  }
  const deriv = mode === "derivatives" && literal.length >= 3 ? DERIV : "";
  const amb = STOP_SET.has(core) ? core : STOP_SET.has(full) ? full : undefined;
  const guard = amb ? "" : STOP_GUARD;
  const pattern = `${guard}(?:${PROC_DEF}${deriv}(?:${def.join("|")})|${PROC_INDEF}${deriv}(?:${indef.join("|")}))`;
  return { pattern, literal, ...(amb ? { ambiguousWith: amb } : {}) };
}

export interface CompiledTerm {
  /** اللفظ كما كتبه المستخدم. */
  term: string;
  mode: MatchMode;
  /** نص التصفية المسبقة (ILIKE '%literal%') على النص المطبَّع. */
  literal: string;
  /** نمط المطابقة بحدود الكلمة (null في وضع contains). */
  regex: string | null;
  /** عبارة جاوزت 16 كلمة فقُطعت (المطابقة على أولها). */
  truncated?: boolean;
  /** كلمات وظيفية قد يلتقطها اللفظ لالتباسه بها بعد التطبيع. */
  ambiguous?: string[];
}

/** يحوّل لفظًا (كلمة أو عبارة) إلى شرط مطابقة. null إن لم يبق فيه حرف ولا رقم. */
export function compileTerm(term: string, mode: MatchMode = "word"): CompiledTerm | null {
  const raw = stripMarks((term ?? "").normalize("NFKC").trim());
  if (!raw) return null;
  if (mode === "contains") {
    const lit = normalizeAr(raw);
    return lit ? { term, mode, literal: lit, regex: null } : null;
  }
  const all = raw.split(new RegExp(`[^${WORD_CHAR}]+`, "u")).filter(Boolean);
  const words = all.slice(0, MAX_PHRASE_WORDS);
  if (!words.length) return null;
  // exact: الكلمات نفسها بترتيبها بلا سوابق ولا لواحق (الإملاء مطبَّع كالقاعدة: الهمزات والتاء والألف المقصورة).
  const parts: CompiledWord[] = words.map((w) =>
    mode !== "exact" && IS_ARABIC_WORD.test(w) ? arabicWordPattern(w, mode) : { pattern: escapeRe(normalizeAr(w)), literal: normalizeAr(w) },
  );
  const literal = parts.reduce((a, b) => (b.literal.length > a.length ? b.literal : a), "");
  if (!literal) return null;
  const regex = `${BOUNDARY_BEFORE}${parts.map((p) => `(?:${p.pattern})`).join(GAP)}${BOUNDARY_AFTER}`;
  const ambiguous = parts.map((p) => p.ambiguousWith).filter((x): x is string => Boolean(x));
  return {
    term,
    mode,
    literal,
    regex,
    ...(all.length > MAX_PHRASE_WORDS ? { truncated: true } : {}),
    ...(ambiguous.length ? { ambiguous } : {}),
  };
}

/** يطابق النصَّ المطبَّع (normalizeAr) لفظٌ مُجمَّع؛ نظير شرط القاعدة في الكود. */
export function matchesNormalized(normText: string, t: CompiledTerm): boolean {
  if (!normText.toLowerCase().includes(t.literal.toLowerCase())) return false;
  return t.regex ? new RegExp(t.regex, "iu").test(normText) : true;
}

/** يطابق نصًّا خامًا (يُطبَّع أولًا). */
export function matchesText(text: string, t: CompiledTerm): boolean {
  return matchesNormalized(normalizeAr(text), t);
}

/** وصف عربي قصير لطريقة المطابقة (يُعاد في مخرج الأداة). */
export function matchModeLabel(mode: MatchMode): string {
  if (mode === "exact") return "الكلمات نفسها بترتيبها، كلمةً كاملة بلا سوابق ولا لواحق؛ الإملاء مطبَّع (الهمزات، التاء المربوطة، الألف المقصورة) والتشكيل مهمل";
  return mode === "word"
    ? "كلمة كاملة بسوابق الإلحاق (و، ف، ب، ك، ل، ال، لل) ولواحق التصريف، والضمير مع النكرة وحدها؛ لا جزء كلمة. الصيغ الفعلية والنسبة (يفسخ، ينفسخ، التعويضية) بـ match=derivatives"
    : mode === "derivatives"
      ? "كلمة كاملة بالسوابق واللواحق وحروف المضارعة والاشتقاق والنسبة (سيفسخ، ينفسخ، انفساخ، مفسوخ)؛ لا جزء كلمة. قد تلتقط كلمة من الجذر نفسه بمعنى آخر (المحكمة من حكم)"
      : "جزء كلمة (احتواء حرفي): يلتقط كلمات أخرى تحتوي اللفظ — للاستعمال الصريح فقط";
}

/** HKM-051: مواضع مطابقة اللفظ في النص المطبَّع (للقرب بين الألفاظ). حد أقصى للمواضع لضبط الكلفة. */
export function matchPositions(normText: string, t: CompiledTerm, max = 200): number[] {
  if (!t.regex) {
    const out: number[] = [];
    let i = normText.toLowerCase().indexOf(t.literal.toLowerCase());
    while (i >= 0 && out.length < max) {
      out.push(i);
      i = normText.toLowerCase().indexOf(t.literal.toLowerCase(), i + Math.max(1, t.literal.length));
    }
    return out;
  }
  const out: number[] = [];
  for (const m of normText.matchAll(new RegExp(t.regex, "giu"))) {
    out.push(m.index ?? 0);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * HKM-051: أعلى نسبة من الألفاظ تقع معًا في نافذة واحدة من النص (بالأحرف).
 * مادة طويلة تذكر اللفظين متباعدين (م5 لائحة التدريب: «عقد» عند 3488 و«تغرير» عند 17945) تنال نصف التغطية لا كاملها.
 */
export function windowCoverage(normText: string, terms: CompiledTerm[], windowChars = 400): number {
  if (!terms.length) return 0;
  const perTerm = terms.map((t) => matchPositions(normText, t));
  const present = perTerm.filter((p) => p.length > 0).length;
  if (present <= 1) return present / terms.length;
  let best = 1;
  const anchors = perTerm.flat();
  for (const a of anchors) {
    const inWin = perTerm.filter((ps) => ps.some((x) => x >= a && x <= a + windowChars)).length;
    if (inWin > best) best = inWin;
    if (best === terms.length) break;
  }
  return best / terms.length;
}
