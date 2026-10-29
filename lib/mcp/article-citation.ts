/**
 * HKM-062 (مراجعة الجودة على #984، B2) — إحالة صريحة إلى مادة في السؤال: «المادة 55 من نظام العمل».
 *
 * hakeem_search يقدّم المادة المحال إليها أولًا (adapter.exactCitationHit). محلّل البحث العام (query-parse.ts) أوسع
 * من ذلك: «م» فيه بلا حد كلمة، فيلتقط «كم 60 يوم» و«رقم 120» و«(م/53)» في اسم النظام موادَّ. فهنا محلّل أضيق،
 * لا يقبل إلا:
 *   • «المادة/مادة» (ومعها و، ف، ب، ل: «بالمادة»، «للمادة») ثم الرقم، واختياريًا «رقم» والقوسان.
 *   • «م» كلمةً مستقلة ثم الرقم («م 55»، «م55»، «م(55)»)، لا بعد «رقم» ولا «المرسوم» ولا «الأمر»، ولا بصيغة المرسوم «م/NN».
 * و«مكرر» بعد الرقم لا تُقبل (المطابقة التامة للأصل وحده). دالة صرفة بلا قاعدة.
 */

const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(DIGITS.indexOf(d)));

/** تطبيع للمطابقة: الهمزات ألف، والتاء المربوطة هاء، والأرقام لاتينية، بلا تشكيل ولا تطويل. */
function norm(raw: string): string {
  return toLatin(String(raw ?? ""))
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

const LETTER = "ء-ي";
// «المادة» بسوابقها، كلمةً مستقلة.
const ARTICLE_WORD = new RegExp(`(?<![${LETTER}])(?:[وف]?[بل]?(?:ال)?|[وف]?لل)ماده(?![${LETTER}])\\s*(?:رقم\\s*)?\\(?\\s*(\\d{1,4})\\s*\\)?`, "u");
// «م» مستقلة: لا حرف قبلها ولا «/» بعدها قبل الرقم.
const ARTICLE_M = new RegExp(`(?<![${LETTER}/])م\\s*\\(?\\s*(\\d{1,4})\\s*\\)?`, "u");
// كلمة قبل «م» تجعلها رقم مرسوم أو أمر أو قرار لا مادة.
const DECREE_BEFORE = /(?:رقم|المرسوم|مرسوم|الملكي|ملكي|الامر|امر|القرار|قرار)\s*$/u;

export interface ArticleCitation {
  articleNumber: number;
  /** السؤال بلا الإحالة ولا أرقام المراسيم والتواريخ (لتعرّف اسم النظام). */
  systemHint: string;
}

export function explicitArticleCitation(query: string): ArticleCitation | null {
  const q = norm(query);
  let m: RegExpMatchArray | null = q.match(ARTICLE_WORD);
  if (!m) {
    const mm = q.match(ARTICLE_M);
    if (mm && mm.index !== undefined && !DECREE_BEFORE.test(q.slice(0, mm.index))) m = mm;
  }
  if (!m || m.index === undefined) return null;
  const after = q.slice(m.index + m[0].length);
  // «12 مكرر»، و«12/5/1440» تاريخ لا مادة.
  if (/^\s*مكرر/u.test(after) || /^\s*\/\s*\d/u.test(after)) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n <= 0) return null;
  const systemHint = (q.slice(0, m.index) + " " + after)
    .replace(/م\s*\/\s*\d+/gu, " ")
    .replace(/\d{1,4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,4}/gu, " ")
    .replace(/رقم\s*\(?\s*\d+\s*\)?/gu, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (systemHint.length < 3) return null;
  return { articleNumber: n, systemHint };
}
