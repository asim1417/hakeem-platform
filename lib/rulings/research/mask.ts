/**
 * mask — حجب البيانات الشخصية في نصوص الأحكام قبل العرض أو التصدير أو الإرسال إلى نموذج.
 *
 * يعيد استعمال redactPII القائم (الهوية والإقامة والجوال والآيبان والبريد، مع حماية أرقام
 * المواد والصكوك والتواريخ)، ويضيف حجب أسماء الأفراد بقاعدتين محافظتين:
 *   ١. سلاسل النسب: «محمد بن عبدالله بن سعد القحطاني» ← [اسم]، ومعها «عبد ﷲ» و«آل/أبو فلان» بعدها.
 *   ٢. ما يلي صفة الطرف: «المدعي/ سعد الدوسري» ← «المدعي/ [اسم]». صفة الطرف تحتاج فاصلًا بعدها
 *      («/» أو «:» أو «-» أو قوس) أو كلمة محرّكة قبلها («حضر»، «بإلزام»)، واللقب («السيد»، «المحامي»،
 *      «المدعو») لا يحتاج. ويتوقف الاسم عند كلمة قاطعة أو صفة أو كلمة منوّنة، وبحد خمس كلمات.
 *      ولاحقة الجنس في القوالب («المدعي:ة»، «المدعى عليه:ا») من الصفة لا من الاسم.
 *   ٣. ما يسبق مرسى الهوية: «ضد سعد علي الدوسري سجل مدني رقم» ← «ضد [اسم] سجل مدني رقم» (حتى خمس كلمات،
 *      والسجل التجاري لا يُعدّ، فأسماء المنشآت تبقى).
 * «ﷲ» حرف واحد في النصوص المنشورة («عبدﷲ»)، فيُعدّ من حروف الاسم؛ والتطويل لا يمنع مطابقة الكلمة القاطعة.
 * لا تحجب أسماء الشركات والجهات (ليست بيانات شخصية)، ولا الصفات نفسها، ولا أرقام المواد.
 * الحجب قاعدي وقد يفوته اسم بلا صفة ولا نسب؛ لذا يُقاس على العيّنة الذهبية ويُراجع.
 */
import { redactPII } from "../../modules/legal-core/rulings-search";

export const NAME_MASK = "[اسم]";

// الحروف العربية (والتطويل ضمنها) و«ﷲ» (U+FDF2) حرفًا واحدًا كما في نصوص الأحكام المنشورة.
const LETTERS = "\\u0621-\\u064A\\uFDF2";
const AR = `[${LETTERS}]+`;
// صفات الأطراف: يُحجب ما بعدها إن تلاها فاصل («/» أو «:» أو «-» أو قوس)، أو سبقها «حضر/بحضور».
// بلا ذلك يليها غالبًا فعل أو وصف («وحيث إن المدعي طلب…»، «للمدعي بمبلغ…») فلا يُحجب (HKM-012، الأمر ٠٨).
const PARTY_MARKERS = [
  "المدعي", "المدعية", "المدعيان", "المدعون", "المدعى عليه", "المدعى عليها", "المدعى عليهما", "المدعى عليهم",
  "المستأنف", "المستأنفة", "المستأنف ضده", "المستأنف ضدها", "المستأنف عليه", "المستأنف عليها",
  "المعترض", "المعترضة", "المعترض ضده", "المتهم", "المتهمة", "طالب التنفيذ", "المنفذ ضده", "المنفذ ضدها",
  "الشاهد", "الشاهدة", "الكفيل", "الضامن", "الوكيل الشرعي", "الوكيل", "الوكيلة", "وكيل", "وكيله", "وكيلها", "وكيلهم", "وكيلة",
  "الزوج", "الزوجة",
];
// ألقاب يليها اسم الشخص دائمًا: يُحجب ما بعدها بلا فاصل.
const TITLE_MARKERS = [
  "السيد", "السيدة", "المواطن", "المواطنة", "المقيم", "المقيمة", "الأستاذ", "الأستاذة", "المحامي", "المحامية", "المدعو", "المدعوة",
];
const ROLE_MARKERS = [...PARTY_MARKERS, ...TITLE_MARKERS];
const TITLES = new Set(TITLE_MARKERS);
// ما يقطع الاسم بعد الصفة (حروف وأفعال وصفات تابعة).
// «علي» ليست هنا: اسم شائع («فلان علي أحمد»)، وكتابة «على» بالياء لا تلي الاسم إلا نادرًا.
const STOP = new Set([
  "بأن", "بان", "أن", "ان", "إن", "على", "في", "عن", "من", "إلى", "الى", "ضد", "مع", "الذي", "التي",
  "وقد", "قد", "حيث", "بصفته", "بصفتها", "بموجب", "هوية", "سجل", "رقم", "المذكور", "المذكورة", "المشار",
  "شركة", "مؤسسة", "الشركة", "المؤسسة", "بنك", "البنك", "الجهة", "وزارة", "الوزارة", "هيئة", "الهيئة",
  "وكالة", "بالوكالة", "أصالة", "اصالة", "ولم", "ولا", "لم", "لا", "قدم", "تقدم", "يطلب", "طلب", "وطلب",
  "أنه", "انه", "أنها", "انها", "فقد", "وحضر", "حضر", "الحاضر", "الحاضرة", "و", "ثم", "بعد", "قبل",
  "بما", "مما", "كما", "أفاد", "أفادت", "وأفاد", "وأفادت", "أقر", "أقرت", "وأقر", "وأقرت", "قرر", "وقرر",
  "بمبلغ", "مبلغ", "الجنسية", "سعودي", "سعودية", "يوافق", "وذلك", "وهو", "وهي", "هو", "هي",
  "بدفع", "بسداد", "بتسليم", "بإعادة", "بالتعويض", "برد", "بأداء", "بإخلاء", "بالمبلغ", "بمبالغ", "يدفع", "تدفع",
  "أبرم", "أبرمت", "ذكر", "وذكر", "أجاب", "وأجاب", "أنكر", "وأنكر", "اعترض", "واعترض", "قال", "وقال", "أوضح", "وأوضح",
  "أضاف", "وأضاف", "طالب", "وطالب", "دفع", "ودفع", "التزم", "استلم", "يملك", "يقيم", "المقيم", "الساكن",
  // روابط تبدأ بها الجمل والأجزاء: الاسم لا يبتلعها ولا يمحو مراسي المقطِّع.
  "وحيث", "ولما", "لما", "كان", "وبما", "فأجاب", "وبعرض", "بعرض", "ذلك", "وبسؤال", "بسؤاله", "وبناء", "بناء", "لذا",
  "لذلك", "فلهذه", "وعليه", "الأسباب", "منطوق", "حكمت", "وحكمت", "الدائرة", "المحكمة", "نص", "وبالاطلاع", "وباطلاع",
  // ما يلي «بإلزام» أو اللقب وليس اسمًا: «بإلزام المدعى عليه سداد…»، «حضر المدعي بنفسه»، «للمحامي الترافع»، «المواطن السعودي».
  "سداد", "تسليم", "إعادة", "رد", "أداء", "دفع", "بنفسه", "بنفسها", "بنفسيهما", "شخصيا", "الترافع", "الحضور", "السعودي",
  "السعودية", "المذكورين", "المذكورتين", "المختص", "المختصة",
  // بقية الصفة المركبة («المدعى عليه») لا تكون اسمًا.
  "عليه", "عليها", "عليهما", "عليهم", "ضده", "ضدها",
]);

const alt = (list: string[]) => [...list].sort((a, b) => b.length - a.length).map((m) => m.replace(/ /g, "\\s+")).join("|");
const markerAlt = alt(ROLE_MARKERS);
// المعرّفة بعد حرف جر ملتصق: «للمدعي» (ل + المدعي بحذف الألف)، و«بالمدعي» و«كالمدعي» و«وللمدعي».
const lilAlt = alt(ROLE_MARKERS.filter((m) => m.startsWith("ال")).map((m) => m.slice(2)));
// الصفة وحدها (والفاصل بعدها)؛ الكلمات بعدها تُقرأ يدويًا، فالصفة المرفوضة لا تبتلع صفة تالية.
// لاحقة الجنس بعد الفاصل في القوالب: «المدعي:ة/»، «المدعى عليه:ا» (حرف مفرد ثم فاصل اختياري).
const MARKER_RE = new RegExp(
  `(^|[^${LETTERS}])((?:[وف]?[بكل]?)(?:${markerAlt})|[وف]?لل(?:${lilAlt}))(?![${LETTERS}\\u064B-\\u0652])` +
    `(\\s*(?:[:/\\-–—(«]\\s*){0,2})((?:[ةاه](?![${LETTERS}\\u064B-\\u0652])\\s*(?:[:/\\-–—(«]\\s*){0,2})?)`,
  "g",
);
// كلمة الاسم في سلسلة النسب: «عبد» المنفصلة جزء منها («عبد ﷲ»، «عبد الإله»).
const NASAB_TOKEN = `(?:عبد\\s+)?${AR}`;
const NASAB_RE = new RegExp(`(?<![${LETTERS}])${NASAB_TOKEN}(?:\\s+(?:بن|بنت|ابن|ابنة)\\s+${NASAB_TOKEN})+`, "g");
// سابقة اسم العائلة: «آل فلان»، «ال فلان» (مفصولة)، «أبو فلان».
const FAMILY_PREFIX = new Set(["آل", "ال", "أبو", "ابو", "بو"]);
const STARTS_CHAIN = /^\s+(?:بن|بنت|ابن|ابنة)\s/;
// كلمة قبل الصفة تجعل ما بعدها اسمًا بلا فاصل: «حضر المدعي فلان»، «بإلزام المدعى عليه فلان».
const TRIGGER_BEFORE = /(?:^|[^ء-ي])[وف]?(?:حضر|حضرت|بحضور|حضور|إلزام|بإلزام|الزام|بالزام|ألزم|ألزمت)\s+$/;
// الكلمة بحركاتها: «عقدًا» كلمة واحدة لا «عقد» ثم «ًا».
const TOKEN_RE = /\s*([\u0621-\u064A\u064B-\u0652\uFDF2]+)/y;
const TOKEN_CHAR = /[\u0621-\u064A\u064B-\u0652\uFDF2]/;
// الكلمة بلا تطويل ولا حركات، للمقارنة بالقوائم: «رقـــم» = «رقم».
const bare = (w: string): string => w.replace(/[\u0640\u064B-\u0652]/g, "");
const TANWEEN = /[\u064B-\u064D]/;
// صفة تبدأ عند الكلمة (بسوابقها وصيغتها المركبة): «والمدعى عليه/» بعد اسم أول تقطعه.
const MARKER_AT = new RegExp(`^(?:(?:[وف]?[بكل]?)(?:${markerAlt})|[وف]?لل(?:${lilAlt}))(?![${LETTERS}\\u064B-\\u0652])`);

const ROLE_WORDS = new Set(ROLE_MARKERS.filter((m) => !m.includes(" ")));
const markerOf = (role: string): string => {
  const r = role.replace(/\s+/g, " ");
  return ROLE_MARKERS.find((m) => r.endsWith(m)) ?? ROLE_MARKERS.find((m) => m.startsWith("ال") && r.endsWith(m.slice(2))) ?? r;
};

/** كلمة لا تكون جزءًا من اسم: قاطعة، أو صفة، أو منوّنة، أو صفة مركبة تبدأ عندها. */
const breaksName = (text: string, tokenStart: number, w: string): boolean =>
  STOP.has(bare(w)) || ROLE_WORDS.has(bare(w)) || TANWEEN.test(w) || MARKER_AT.test(text.slice(tokenStart, tokenStart + 40));

const NAME_MAX = 5;

/**
 * يحجب الاسم الذي يلي صفة الطرف (حتى ٥ كلمات، ويتوقف عند أول كلمة قاطعة أو صفة أخرى).
 * صفة الطرف تحتاج فاصلًا بعدها أو كلمة محرّكة قبلها («حضر»، «إلزام»)، واللقب لا يحتاج.
 */
// صفة ملتصقة بما قبلها في النصوص المنشورة («…الحازميالمدعى عليه:فلان»): تُعدّ صفةً إن تلاها «:» أو «/».
const GLUED_RE = new RegExp(
  `(?<=[${LETTERS}])(${alt(PARTY_MARKERS.filter((m) => m.startsWith("ال")))})(?![${LETTERS}\\u064B-\\u0652])` +
    `(\\s*[:/]\\s*(?:[:/\\-–—(«]\\s*)?)((?:[ةاه](?![${LETTERS}\\u064B-\\u0652])\\s*(?:[:/\\-–—(«]\\s*){0,2})?)`,
  "g",
);
// عنوان جزء ملتصق بآخر الاسم («…الياميالوقائع:»): حدّ يُقطع عنده الاسم ولا يُحجب العنوان.
const GLUED_HEADING_RE = new RegExp(`(?<=[${LETTERS}])(?:الوقائع|الأسباب|الاسباب|منطوق\\s+الحكم|نص\\s+الحكم)(?=\\s*[:)])`, "g");
/** مواضع بدء الصفات والعناوين الملتصقة: حدّ كلمة لا يعبره اسم. */
const gluedStarts = (text: string): number[] =>
  [...text.matchAll(GLUED_RE), ...text.matchAll(GLUED_HEADING_RE)].map((g) => g.index ?? 0).sort((a, b) => a - b);
/** أول حدّ ملتصق داخل الكلمة [from, to)، أو -1. */
const cutAt = (glued: number[], from: number, to: number): number => glued.find((p) => p > from && p < to) ?? -1;

type MarkerHit = { index: number; all: string; pre: string; role: string; sep: string; sfx: string };
/** الصفة التالية من موضعٍ: المنفصلة (MARKER_RE) أو الملتصقة (GLUED_RE)، أيهما أسبق. */
function nextMarker(text: string, from: number): MarkerHit | null {
  MARKER_RE.lastIndex = from;
  GLUED_RE.lastIndex = from;
  const a = MARKER_RE.exec(text);
  const g = GLUED_RE.exec(text);
  const ah = a ? { index: a.index, all: a[0], pre: a[1], role: a[2], sep: a[3], sfx: a[4] } : null;
  const gh = g ? { index: g.index, all: g[0], pre: "", role: g[1], sep: g[2], sfx: g[3] } : null;
  if (!ah) return gh;
  if (!gh) return ah;
  return gh.index < ah.index + ah.pre.length ? gh : ah;
}

function maskAfterRoles(text: string): string {
  let out = "";
  let last = 0;
  const glued = gluedStarts(text);
  let from = 0;
  for (let m = nextMarker(text, from); m; m = nextMarker(text, from)) {
    const { all, pre, role, sep, sfx } = m;
    const roleStart = m.index + pre.length;
    if (!all.length) {
      from = m.index + 1;
      continue;
    }
    const hasSep = /[:/\-–—(«]/.test(sep);
    // لاحقة الجنس لا تُعدّ إلا بعد فاصل («المدعي:ة»)؛ بلا فاصل فهي أول الكلمة التالية.
    const end = m.index + all.length - (hasSep ? 0 : sfx.length);
    const isTitle = TITLES.has(markerOf(role));
    const trigger = TRIGGER_BEFORE.test(text.slice(Math.max(0, roleStart - 16), roleStart));
    // المرفوضة: يُستأنف بعد الصفة نفسها لا بعد الفاصل، فيبقى الفاصل حدًّا قبل الصفة التالية («وكيله المحامي …»).
    if (!hasSep && !isTitle && !trigger) {
      from = roleStart + role.length;
      continue;
    }
    // الكلمات بعد الفاصل: أسماء حتى ٥، وتتوقف عند كلمة قاطعة أو صفة.
    TOKEN_RE.lastIndex = end;
    let nameEnd = -1;
    let count = 0;
    for (let t = TOKEN_RE.exec(text); t && count < NAME_MAX; t = TOKEN_RE.exec(text)) {
      const w = t[1];
      // المنوّن ليس اسم علم في نصوص الأحكام («عقدًا»، «مبلغًا»)؛ والشدة والحركات قد تكون في الاسم («محمّد»).
      const tokenStart = TOKEN_RE.lastIndex - w.length;
      if (breaksName(text, tokenStart, w)) break;
      // صفة ملتصقة بآخر الكلمة: الاسم ينتهي عندها، والصفة تُقرأ بعده.
      const cut = cutAt(glued, tokenStart, TOKEN_RE.lastIndex);
      if (cut !== -1) {
        nameEnd = cut;
        count++;
        break;
      }
      nameEnd = TOKEN_RE.lastIndex;
      count++;
      // اسم لا يمتد عبر فاصل جملة أو سطر.
      if (/^[^\S\n]*\n/.test(text.slice(nameEnd))) break;
    }
    if (count === 0) {
      from = roleStart + role.length;
      continue;
    }
    const nameStart = end + (text.slice(end).match(/^\s*/)?.[0].length ?? 0);
    out += text.slice(last, nameStart) + NAME_MASK;
    last = nameEnd;
    from = nameEnd;
  }
  return out + text.slice(last);
}

/**
 * يحجب سلاسل النسب («فلان بن فلان …») ومعها حتى كلمتين بعدها (الجد واسم العائلة بسابقته «آل/أبو»)،
 * ما لم تكن الكلمة قاطعة أو صفة أو منوّنة، ولا يتجاوز سطرًا.
 */
function maskNasab(text: string): string {
  let out = "";
  let last = 0;
  const glued = gluedStarts(text);
  NASAB_RE.lastIndex = 0;
  for (let m = NASAB_RE.exec(text); m; m = NASAB_RE.exec(text)) {
    let end = m.index + m[0].length;
    for (let extra = 0; extra < 2; ) {
      TOKEN_RE.lastIndex = end;
      const t = TOKEN_RE.exec(text);
      // سطر أو جدولة بين الكلمتين: اسم آخر (قوائم أعضاء الدائرة).
      if (!t || /[\n\t]/.test(text.slice(end, TOKEN_RE.lastIndex - t[1].length))) break;
      const w = t[1];
      const tokenStart = TOKEN_RE.lastIndex - w.length;
      if (FAMILY_PREFIX.has(bare(w))) {
        // السابقة لا تُعدّ، ويلزم بعدها اسم؛ وما بعدها اسم ولو وافق كلمة قاطعة («آل طالب»).
        const after = TOKEN_RE.exec(text);
        if (!after || /[\n\t]/.test(text.slice(TOKEN_RE.lastIndex - after[1].length - 2, TOKEN_RE.lastIndex - after[1].length))) break;
        const a = after[1];
        if (ROLE_WORDS.has(bare(a)) || TANWEEN.test(a) || MARKER_AT.test(text.slice(TOKEN_RE.lastIndex - a.length, TOKEN_RE.lastIndex - a.length + 40))) break;
        end = TOKEN_RE.lastIndex;
        extra++;
        continue;
      }
      if (breaksName(text, tokenStart, w) || w.length < 2) break;
      const cut = cutAt(glued, tokenStart, TOKEN_RE.lastIndex);
      if (cut !== -1) {
        end = cut;
        break;
      }
      // كلمة يليها «بن» أولُ سلسلة أخرى («… الجليفي عضو عمر بن …»): تُترك لها.
      if (STARTS_CHAIN.test(text.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 8))) break;
      end = TOKEN_RE.lastIndex;
      extra++;
    }
    out += text.slice(last, m.index) + NAME_MASK;
    last = end;
    NASAB_RE.lastIndex = end;
  }
  return out + text.slice(last);
}

// مراسي الهوية الشخصية (والتطويل بين حروفها: «ســـجل مدني»). السجل التجاري ليس منها.
const tat = (w: string) => [...w].join("\u0640*");
const ID_ANCHORS = ["سجل مدني", "هوية وطنية", "هوية مقيم", "هوية رقم", "رخصة إقامة", "رخصة اقامة", "إقامة رقم", "اقامة رقم", "بطاقة أحوال", "حفيظة نفوس"];
const ID_ANCHOR_RE = new RegExp(
  `(?<![${LETTERS}\\u064B-\\u0652])(?:${ID_ANCHORS.map((a) => a.split(" ").map(tat).join("\\s+")).join("|")})(?![${LETTERS}])`,
  "g",
);
// ما يسبق مرسى الهوية وليس اسمًا: «صاحب هوية رقم»، «المدعى عليه هوية…».
const ANCHOR_STOP = new Set([
  "صاحب", "صاحبة", "حامل", "حاملة", "يحمل", "تحمل", "ويحمل", "وتحمل", "بطاقة", "برقم", "ورقم", "حسب", "بحسب", "باسم", "اسم",
  "المدعى", "المستأنف", "المسجل", "المسجلة", "لصاحبها", "لمالكها", "ومالكها",
]);
const isSpace = (c: string | undefined) => c === " " || c === "\t" || c === "\u00A0";

/** يحجب ما يسبق مرسى الهوية من كلمات الاسم (حتى ٥، ويعبر «[اسم]» السابق وفاصلة قبل المرسى). */
function maskBeforeIdAnchors(text: string): string {
  const spans: Array<[number, number]> = [];
  ID_ANCHOR_RE.lastIndex = 0;
  for (const m of text.matchAll(ID_ANCHOR_RE)) {
    let k = m.index ?? 0;
    while (k > 0 && isSpace(text[k - 1])) k--;
    if (k > 0 && (text[k - 1] === "،" || text[k - 1] === ",")) {
      k--;
      while (k > 0 && isSpace(text[k - 1])) k--;
    }
    const nameEnd = k;
    let nameStart = -1;
    let count = 0;
    while (count < NAME_MAX && k > 0) {
      if (text.slice(Math.max(0, k - NAME_MASK.length), k) === NAME_MASK) {
        k -= NAME_MASK.length;
        nameStart = k;
      } else {
        let s = k;
        while (s > 0 && TOKEN_CHAR.test(text[s - 1])) s--;
        if (s === k) break;
        const w = text.slice(s, k);
        if (w.length < 2 || breaksName(text, s, w) || ANCHOR_STOP.has(bare(w))) break;
        nameStart = s;
        count++;
        k = s;
      }
      // الكلمات مفصولة بمسافة على السطر نفسه؛ ما سواها (ترقيم، سطر) حدّ الاسم.
      if (!isSpace(text[k - 1])) break;
      while (k > 0 && isSpace(text[k - 1])) k--;
    }
    if (count > 0 && nameStart >= 0) spans.push([nameStart, nameEnd]);
  }
  if (!spans.length) return text;
  let out = "";
  let last = 0;
  for (const [s, e] of spans) {
    if (s < last) continue;
    out += text.slice(last, s) + NAME_MASK;
    last = e;
  }
  return out + text.slice(last);
}

/** الحجب الكامل: أرقام شخصية (redactPII) ثم الأسماء. */
export function maskPersonalData(text: string | null | undefined): string {
  if (!text) return "";
  // تمريرات متتالية: الصفة الثانية في «المدعي/ فلان ضد المدعى عليه/ فلان» تقع داخل كلمات التقاط الأولى.
  let out = maskNasab(redactPII(text));
  for (let i = 0; i < 4; i++) {
    const next = maskAfterRoles(out);
    if (next === out) break;
    out = next;
  }
  out = maskBeforeIdAnchors(out);
  return out.replace(/(\[اسم\]\s*){2,}/g, `${NAME_MASK} `);
}
