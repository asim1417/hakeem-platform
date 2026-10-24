/**
 * word-match — مطابقة لفظية بحدود الكلمة لأدوات الحصر (HKM-044، المرحلة صفر من أدوات الباحث).
 *
 * العلة التي يعالجها: الحصر كان يطابق جزء الكلمة (ILIKE '%لفظ%')، فالتقطت «التعدي» كلمة «التعديل»،
 * و«ربا» كلمة «الأرباح»، وصيغة «غبون» المولَّدة كلمة «يرغبون» (أربع نتائج من عشر في بحث «الغبن»).
 *
 * القاعدة: اللفظ يطابق كلمة كاملة في النص المطبَّع، يجوز أن يسبقها:
 *   • سوابق الإلحاق وحدها: و، ف، ب، ك، ل، ال، وال، بال، فال، كال، لل (وتركيباتها: «وبال»، «فلل»).
 *   • وفي وضع «derivatives» وحده: حروف المضارعة والاشتقاق (ا، ي، ت، ن، م، ثم ن، ت، ست): «ينفسخ»، «انفساخ»، «مفسوخ»، «استحق».
 * ويجوز أن تلحقها لواحق تصريف مغلقة (ات، ان، ين، ون، وا، ت، ا، ي، يه…) ثم ضمائر (ه، ها، هم، هما، نا، ك…).
 * ولا يجوز غير ذلك: «التعدي» لا تطابق «التعديل»، و«غبون» لا تطابق «يرغبون».
 *
 * لفظ ينتهي بتاء مربوطة («الشركة») يطابق صورها: شركة، شركته، شركات، شركاتها، شركتين.
 * «ال» التي كتبها المستخدم تُجرَّد إن بقي بعدها ثلاثة أحرف («الغبن» تطابق «غبن» و«بالغبن»)، ولا تُجرَّد
 * من «الله» ولا من همزة «إلزام». اللفظ غير العربي (رقم أو لاتيني) يطابق كلمة كاملة بلا لواحق («30» لا تطابق «300»).
 * العبارة («فسخ العقد») كلماتها بترتيبها يفصل بينها فاصل غير حرفي.
 *
 * النمط واحد للقاعدة (Postgres ARE بـ ~*) وللكود (RegExp بـ iu)، ويُختبر على الاثنين.
 * وضع «contains» يُبقي السلوك القديم (جزء الكلمة) لمن طلبه صراحة.
 */

export type MatchMode = "word" | "derivatives" | "contains";
export const MATCH_MODES: readonly MatchMode[] = ["word", "derivatives", "contains"] as const;

/** حروف عربية بعد التطبيع: ء–ؿ، ف–ي، والممتدة ٱ–ۓ (الكاف والياء الفارسيتان في النصوص المكشوطة). */
const AR_LETTER = "ء-ؿف-يٱ-ۓ";
/** ما يُعدّ جزءًا من الكلمة عند فحص الحد: الحروف العربية والأرقام والحروف اللاتينية. */
const WORD_CHAR = `${AR_LETTER}0-9٠-٩a-zA-Z`;
const BOUNDARY_BEFORE = `(?:^|[^${WORD_CHAR}])`;
const BOUNDARY_AFTER = `(?:$|[^${WORD_CHAR}])`;
const GAP = `[^${WORD_CHAR}]+`;

/** سوابق الإلحاق: عطف اختياري، ثم جر أو تعريف أو «لل». */
const PROCLITIC = "(?:[وف]?(?:[بك]?ال|لل|[بكل])?)";
/** حروف المضارعة والاشتقاق (وضع derivatives): انفسخ، ينفسخ، تفسخ، مفسوخ، منفسخ، استحق، مستحق. */
const DERIV = "(?:[ايتنم]?(?:ست|ن|ت)?)";
/** لواحق التصريف ثم الضمائر. */
const INFL = "(?:يات|يين|يان|يه|يا|ات|ان|ين|ون|وا|تا|تم|تن|نا|ت|ا|ي)?";
/** بلا «ني» (ضمير المتكلم للفعل): «رباني» في نظام المحكمة التجارية (م398، الربان) لا تطابق «ربا». */
const PRON = "(?:هما|كما|هم|هن|كم|كن|ها|نا|ه|ك|ي)?";
/** صور التاء المربوطة بعد تطبيع «ة» إلى «ه». */
const TA_FORMS = "(?:ه|ت|ات|تا|تان|تين)";

/** التطبيع المشترك: الهمزات، الألف المقصورة، التاء المربوطة، الواو والياء المهموزتان، الألف الوصلية؛ وحذف التشكيل والتطويل. */
export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, "") // التشكيل والتطويل (دون المساس بالأرقام العربية U+0660+)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
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
}

/** نمط كلمة عربية واحدة بحسب الوضع. rawWord بلا فواصل. */
export function arabicWordPattern(rawWord: string, mode: Exclude<MatchMode, "contains">): CompiledWord {
  const raw = stripMarks(rawWord);
  const ta = raw.endsWith("ة");
  let core = normalizeAr(raw);
  let strippedArticle = false;
  // «ال» كتبها المستخدم (بلا همزة في الخام): تُجرَّد مع ما قبلها من سوابق إن بقي ثلاثة أحرف فأكثر،
  // وتبقى صورة المعرّف بديلًا (فـ«الزام» المكتوبة بلا همزة تطابق «الإلزام» أيضًا).
  for (const p of ["وال", "فال", "بال", "كال", "ال"]) {
    if (raw.startsWith(p) && raw.length - p.length >= 3) {
      core = core.slice(p.length);
      strippedArticle = true;
      break;
    }
  }
  if (!strippedArticle && raw.startsWith("لل") && raw.length - 2 >= 3) {
    core = core.slice(2);
    strippedArticle = true;
  }

  const makeBody = (c: string): { lit: string; body: string } =>
    ta && c.endsWith("ه") && c.length >= 3
      ? { lit: c.slice(0, -1), body: `${c.slice(0, -1)}${TA_FORMS}${PRON}` }
      : { lit: c, body: `${c}${INFL}${PRON}` };
  const main = makeBody(core);
  const alts = [main.body];
  let literal = main.lit;
  if (strippedArticle) {
    alts.push(makeBody(`ال${core}`).body);
  } else if (core.startsWith("ال") && core.length >= 3) {
    // «الحق» (لم تُجرَّد لقصرها): صورة «للحق» بإبدال الألف لامًا، والتصفية على المشترك («لحق»).
    alts.push(`ل${main.body.slice(1)}`);
    literal = main.lit.slice(1);
  }
  const deriv = mode === "derivatives" && main.lit.length >= 3 ? DERIV : "";
  const head = alts.length > 1 ? `(?:${alts.join("|")})` : main.body;
  return { pattern: `${PROCLITIC}${deriv}${head}`, literal };
}

export interface CompiledTerm {
  /** اللفظ كما كتبه المستخدم. */
  term: string;
  mode: MatchMode;
  /** نص التصفية المسبقة (ILIKE '%literal%') على النص المطبَّع. */
  literal: string;
  /** نمط المطابقة بحدود الكلمة (null في وضع contains). */
  regex: string | null;
}

/** يحوّل لفظًا (كلمة أو عبارة) إلى شرط مطابقة. null إن لم يبق فيه حرف ولا رقم. */
export function compileTerm(term: string, mode: MatchMode = "word"): CompiledTerm | null {
  const raw = stripMarks((term ?? "").normalize("NFKC").trim());
  if (!raw) return null;
  if (mode === "contains") {
    const lit = normalizeAr(raw);
    return lit ? { term, mode, literal: lit, regex: null } : null;
  }
  // سقف العبارة: 16 كلمة (لا عبارة نظامية حقيقية أطول، ويبقى النمط قصيرًا).
  const words = raw.split(new RegExp(`[^${WORD_CHAR}]+`, "u")).filter(Boolean).slice(0, MAX_PHRASE_WORDS);
  if (!words.length) return null;
  const parts: CompiledWord[] = words.map((w) =>
    IS_ARABIC_WORD.test(w) ? arabicWordPattern(w, mode) : { pattern: escapeRe(normalizeAr(w)), literal: normalizeAr(w) },
  );
  const literal = parts.reduce((a, b) => (b.literal.length > a.length ? b.literal : a), "");
  if (!literal) return null;
  const regex = `${BOUNDARY_BEFORE}${parts.map((p) => `(?:${p.pattern})`).join(GAP)}${BOUNDARY_AFTER}`;
  return { term, mode, literal, regex };
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
  return mode === "word"
    ? "كلمة كاملة مع السوابق (و، ف، ب، ك، ل، ال) واللواحق والضمائر؛ لا جزء كلمة. الصيغ الفعلية (يفسخ، ينفسخ) بـ match=derivatives"
    : mode === "derivatives"
      ? "كلمة كاملة مع السوابق واللواحق وحروف المضارعة والاشتقاق (ينفسخ، انفساخ، مفسوخ)؛ لا جزء كلمة. قد تلتقط كلمة من الجذر نفسه بمعنى آخر (المحكمة من حكم)"
      : "جزء كلمة (احتواء حرفي): يلتقط كلمات أخرى تحتوي اللفظ — للاستعمال الصريح فقط";
}
