/**
 * mask — حجب البيانات الشخصية في نصوص الأحكام قبل العرض أو التصدير أو الإرسال إلى نموذج.
 *
 * يعيد استعمال redactPII القائم (الهوية والإقامة والجوال والآيبان والبريد، مع حماية أرقام
 * المواد والصكوك والتواريخ)، ويضيف حجب أسماء الأفراد بثلاث قواعد محافظة:
 *   ١. سلاسل النسب: «محمد بن عبدالله بن سعد القحطاني» ← [اسم]، ومعها «عبد ﷲ» و«آل/أبو فلان» بعدها.
 *   ٢. ما يلي صفة الطرف: «المدعي/ سعد الدوسري» ← «المدعي/ [اسم]». صفة الطرف تحتاج فاصلًا بعدها
 *      («/» أو «:» أو «-» أو قوس) أو كلمة محرّكة قبلها («حضر»، «بإلزام»)، واللقب («السيد»، «المحامي»،
 *      «المدعو») لا يحتاج. ويتوقف الاسم عند كلمة قاطعة أو صفة أو كلمة منوّنة، وبحد خمس كلمات.
 *      ولاحقة الجنس في القوالب («المدعي:ة»، «المدعى عليه:ا») من الصفة لا من الاسم. ومن الصفات «ضد/»
 *      وصفات أعضاء الدائرة («القاضي:»، «أمين السر:»)، وكلها بفاصل.
 *   ٣. ما يسبق مرسى الهوية: «ضد سعد علي الدوسري سجل مدني رقم» ← «ضد [اسم] سجل مدني رقم» (حتى خمس كلمات).
 *      المرسى يلزمه ما يدل على رقم بعده بقليل («رقم»، «(»، رقم، علامة حجب)، فـ«صورة سجل مدني» لا تُحجب؛
 *      والسجل التجاري ليس مرسى، فأسماء المنشآت تبقى. و«<نسبة> الجنسية» بعد الاسم مرسى أيضًا.
 * «ﷲ» والأشكال المعروضة والياء والكاف الفارسيتان ووصلا ZWNJ/ZWJ من حروف الاسم، والحركات داخل الاسم لا تقطعه.
 * لا تحجب أسماء الشركات والجهات (ليست بيانات شخصية)، ولا الصفات نفسها، ولا أرقام المواد.
 * الحجب قاعدي وقد يفوته اسم بلا صفة ولا نسب ولا مرسى؛ لذا يُقاس على العيّنة الذهبية ويُراجع.
 * الكلفة خطية في طول النص (كل تعبير يُمسح مرة في كل تمريرة).
 */
import { redactPII } from "../../modules/legal-core/rulings-search";

export const NAME_MASK = "[اسم]";

// حروف الاسم: العربية (والتطويل ضمنها)، والكاف والياء الفارسيتان، ووصلا ZWNJ/ZWJ، والأشكال المعروضة
// (ومنها «ﷲ» U+FDF2 حرفًا واحدًا كما في نصوص الأحكام المنشورة)، دون القوسين المزخرفين U+FD3E/U+FD3F.
const LETTERS = "\\u0621-\\u064A\\u06A9\\u06CC\\u200C\\u200D\\uFB50-\\uFD3D\\uFD50-\\uFDFF\\uFE70-\\uFEFC";
const HARAKAT = "\\u064B-\\u0652\\u0670";
const WORD = `[${LETTERS}][${LETTERS}${HARAKAT}]*`;
/** لفظ بحركات اختيارية بين حروفه وبعدها («بْن»، «بِنْت»). */
const withHarakat = (w: string) => [...w].map((c) => `${c}[${HARAKAT}]*`).join("");

// صفات الأطراف: يُحجب ما بعدها إن تلاها فاصل («/» أو «:» أو «-» أو قوس)، أو سبقها «حضر/بحضور».
// بلا ذلك يليها غالبًا فعل أو وصف («وحيث إن المدعي طلب…»، «للمدعي بمبلغ…») فلا يُحجب (HKM-012، الأمر ٠٨).
const PARTY_MARKERS = [
  "المدعي", "المدعية", "المدعيان", "المدعون", "المدعى عليه", "المدعى عليها", "المدعى عليهما", "المدعى عليهم",
  "المستأنف", "المستأنفة", "المستأنف ضده", "المستأنف ضدها", "المستأنف عليه", "المستأنف عليها",
  "المعترض", "المعترضة", "المعترض ضده", "المتهم", "المتهمة", "طالب التنفيذ", "المنفذ ضده", "المنفذ ضدها",
  "الشاهد", "الشاهدة", "الكفيل", "الضامن", "الوكيل الشرعي", "الوكيل", "الوكيلة", "وكيل", "وكيله", "وكيلها", "وكيلهم", "وكيلة",
  "الزوج", "الزوجة",
];
// «ضد/ فلان» في صدر الحكم، وأعضاء الدائرة في التوقيع («القاضي: فلان»، «أمين السر/ فلان») — بفاصل فقط،
// فلا يُحجب ما بعد «ضد الحكم» ولا «الحكم القاضي بإلزام»؛ ولا تقطع اسمًا إلا إذا تلاها فاصل («القاضي» اسم عائلة أيضًا).
const BENCH_MARKERS = ["ضد", "القاضي", "رئيس الدائرة", "عضو الدائرة", "عضو", "أمين السر", "أمين سر الدائرة", "كاتب الضبط", "الكاتب"];
PARTY_MARKERS.push(...BENCH_MARKERS);
// ألقاب يليها اسم الشخص دائمًا: يُحجب ما بعدها بلا فاصل.
const TITLE_MARKERS = [
  "السيد", "السيدة", "المواطن", "المواطنة", "المقيم", "المقيمة", "الأستاذ", "الأستاذة", "المحامي", "المحامية", "المدعو", "المدعوة",
  // «شخص آخر يدعى: فلان»، «حرر السند باسم فلان» (وما ليس اسمًا بعد «باسم» قاطع: «باسم الشركة»، «باسم موكله»، «باسم المدعي»).
  "يدعى", "تدعى", "باسم",
];
const ROLE_MARKERS = [...PARTY_MARKERS, ...TITLE_MARKERS];
// ألقاب لا يليها اسم إلا نكرة: «باسم الطرف الثاني»، «باسم الملك»، «يدعى العقد» ليست أسماء أفراد.
const FIRST_INDEFINITE = new Set(["يدعى", "تدعى", "باسم"]);
const TITLES = new Set(TITLE_MARKERS);
// ما يقطع الاسم بعد الصفة (حروف وأفعال وصفات تابعة).
// «علي» ليست هنا: اسم شائع («فلان علي أحمد»)؛ وتُعدّ قاطعة إذا تلتها كلمة تدل على أنها «على» (ALI_AS_ALA).
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
  // منطوق الأحكام بعد «القاضي:» ونحوها: ليست أسماء.
  "بإلزام", "إلزام", "الزام", "بالزام", "برفض", "رفض", "بعدم", "عدم", "بقبول", "قبول", "بصرف", "صرف", "بإثبات", "إثبات",
  "بفسخ", "فسخ", "بنقض", "نقض", "بتأييد", "تأييد",
  // الترحّم والدعاء بعد أعلام الفقه، وصلات القرابة: ليست من الاسم («ابن قدامة رحمه الله»، «فلان وأخوه»).
  "رحمه", "رحمها", "رحمهما", "رحمهم", "رضي", "تعالى", "حفظه", "حفظها", "وفقه", "غفر",
  "عنه", "عنها", "عنهما", "عنهم", "أخوه", "أخيه", "أخاه", "أخته", "ابنه", "ابنته", "والده", "والدته", "زوجته", "زوجها",
  // ما يلي اسم الطرف في صحيفة الدعوى ولائحتها: «أقام المدعي/ فلان دعواه بطلب…».
  "دعواه", "دعواها", "دعواهم", "دعوى", "الدعوى", "بدعوى", "بطلب", "طلبه", "طلبها", "يطالب", "تطالب", "مطالبا", "مطالبة",
  "المطالبة", "بالمطالبة", "حكم", "الحكم", "بحكم", "قائلا", "قائلة", "مفاده", "مفادها", "صحيفة", "بصحيفة", "لائحة", "بلائحة",
  "مذكرة", "بمذكرة", "الآتي", "بالآتي", "التالي", "يلي", "ما",
  // أفعال تسبق الاسم في الوقائع: «ادعى فلان…»، «أقام فلان…».
  "ادعى", "ادعت", "وادعى", "وادعت", "أقام", "أقامت", "وأقام", "وأقامت", "اقام", "واقام",
  // ما يلي «وكالة» بعد الصفة وليس اسمًا: «المدعي وكالة شرعية».
  "شرعية", "الشرعية", "عامة", "خاصة", "مطلقة",
  // ما يلي «باسم» وليس اسمًا: «باسم موكله»، «باسمه».
  "موكله", "موكلها", "موكلته", "موكلي", "موكلتي", "موكلنا", "موكليه", "موكلهم", "موكلتها",
  // أفعال تلي الاسم في الوقائع: «… فلان استحق الصرف».
  "استحق", "استحقت", "واستحق", "واستحقت", "يستحق", "تستحق",
]);
// «علي» المكتوبة بدل «على»: إذا تلتها إحدى هذه فهي حرف لا اسم («حضر المدعي علي الموعد…»).
const ALI_AS_ALA = new Set([
  "أن", "ان", "ذلك", "هذا", "هذه", "ما", "الحكم", "الدعوى", "العقد", "الموعد", "علم", "سبيل", "نحو", "النحو", "حد", "أساس",
  "اساس", "الطرفين", "المدعي", "المدعى", "المحكمة", "الدائرة",
]);

const alt = (list: string[]) => [...list].sort((a, b) => b.length - a.length).map((m) => m.replace(/ /g, "\\s+")).join("|");
const markerAlt = alt(ROLE_MARKERS);
// المعرّفة بعد حرف جر ملتصق: «للمدعي» (ل + المدعي بحذف الألف)، و«بالمدعي» و«كالمدعي» و«وللمدعي».
const lilAlt = alt(ROLE_MARKERS.filter((m) => m.startsWith("ال")).map((m) => m.slice(2)));
const SEP = `(?:[:/\\-–—(«]\\s*)`;
// الترتيب بين الصفة والفاصل: «المدعى عليه الثاني: فلان»، «المنفذ ضده الثالث/ فلان». بلا فاصل بعده لا يُعدّ فاصلًا.
const ORDINALS = ["الأول", "الاول", "الأولى", "الاولى", "الثاني", "الثانية", "الثالث", "الثالثة", "الرابع", "الرابعة", "الخامس", "الخامسة",
  "السادس", "السادسة", "السابع", "السابعة", "الثامن", "الثامنة", "التاسع", "التاسعة", "العاشر", "العاشرة"];
const ORD = `(?:\\s+(?:${ORDINALS.join("|")})(?![${LETTERS}${HARAKAT}]))?`;
// لاحقة الجنس بعد الفاصل في القوالب: «المدعي:ة/»، «المدعى عليه:ا» (حرف مفرد ثم فاصل اختياري).
const GENDER_SFX = `((?:[ةاه](?![${LETTERS}${HARAKAT}])\\s*${SEP}{0,2})?)`;
// الصفة وحدها (والفاصل بعدها)؛ الكلمات بعدها تُقرأ يدويًا، فالصفة المرفوضة لا تبتلع صفة تالية.
const MARKER_RE = new RegExp(
  `(^|[^${LETTERS}])((?:[وف]?[بكل]?)(?:${markerAlt})|[وف]?لل(?:${lilAlt}))(?![${LETTERS}${HARAKAT}])(${ORD}\\s*${SEP}{0,2})${GENDER_SFX}`,
  "g",
);
// صفة ملتصقة بما قبلها في النصوص المنشورة («…الحازميالمدعى عليه:فلان»): تُعدّ صفةً إن تلاها «:» أو «/».
const GLUED_RE = new RegExp(
  `(?<=[${LETTERS}])(${alt(PARTY_MARKERS.filter((m) => m.startsWith("ال")))})(?![${LETTERS}${HARAKAT}])(\\s*[:/]\\s*${SEP}?)${GENDER_SFX}`,
  "g",
);
// صفة الدائرة ملتصقة بالاسم بعدها («رئيس الدائرة القضائيةفلان»): تُعدّ صفة بفاصل عند موضع الالتصاق.
const BENCH_GLUED_RE = new RegExp(`(?<![${LETTERS}])((?:رئيس|عضو|أمين\\s+سر)\\s+الدائرة(?:\\s+القضائية)?)(?=[${LETTERS}])`, "g");
// عنوان جزء ملتصق بآخر الاسم («…الياميالوقائع:»): حدّ يُقطع عنده الاسم ولا يُحجب العنوان.
const GLUED_HEADING_RE = new RegExp(`(?<=[${LETTERS}])(?:الوقائع|الأسباب|الاسباب|منطوق\\s+الحكم|نص\\s+الحكم)(?=\\s*[:)])`, "g");

// سلسلة النسب: كلمة الاسم بحركاتها، و«عبد» المنفصلة جزء منها («عبد ﷲ»، «عبد الإله»)، والرابط بحركاته («بْن»).
const BIN = `(?:${["بنت", "ابنة", "ابن", "بن"].map(withHarakat).join("|")})`;
const NASAB_TOKEN = `(?:${withHarakat("عبد")}\\s+)?${WORD}`;
const NASAB_RE = new RegExp(`(?<![${LETTERS}${HARAKAT}])${NASAB_TOKEN}(?:\\s+${BIN}\\s+${NASAB_TOKEN})+`, "g");
// سابقة اسم العائلة: «آل فلان»، «ال فلان» (مفصولة)، «أبو فلان».
const FAMILY_PREFIX = new Set(["آل", "ال", "أبو", "ابو", "بو"]);
const STARTS_CHAIN = new RegExp(`^\\s+${BIN}\\s`);
// «ابن السبيل» مصطلح (مصارف الزكاة) لا رابط نسب: لا يبدأ سلسلة، ولا يُحجب، ويقطع ما قبله من اسم.
const SABIL = new RegExp(`^\\s*${withHarakat("ابن")}\\s+السبيل(?![${LETTERS}])`);
const SABIL_IN = new RegExp(`\\s+${withHarakat("ابن")}\\s+السبيل(?![${LETTERS}])`);
const CHAIN_HEAD = new RegExp(`^${NASAB_TOKEN}(?:\\s+${BIN}\\s+${NASAB_TOKEN})+`);
// كلمة قبل الصفة تجعل ما بعدها اسمًا بلا فاصل: «حضر المدعي فلان»، «بإلزام المدعى عليه فلان».
const TRIGGER_BEFORE = /(?:^|[^ء-ي])[وف]?(?:حضر|حضرت|بحضور|حضور|إلزام|بإلزام|الزام|بالزام|ألزم|ألزمت)\s+$/;
// الكلمة بحركاتها: «عقدًا» كلمة واحدة لا «عقد» ثم «ًا».
const TOKEN_RE = new RegExp(`\\s*([${LETTERS}${HARAKAT}]+)`, "y");
const TOKEN_CHAR = new RegExp(`[${LETTERS}${HARAKAT}]`);
const NEXT_WORD = new RegExp(`^\\s+([${LETTERS}${HARAKAT}]+)`);
// الكلمة بلا تطويل ولا حركات ولا وصل، وبالياء والكاف العربيتين، للمقارنة بالقوائم: «رقـــم» = «رقم».
const bare = (w: string): string => w.replace(/[ـً-ْٰ‌‍]/g, "").replace(/ی/g, "ي").replace(/ک/g, "ك");
const TANWEEN = /[ً-ٍ]/;
// صفة تبدأ عند الكلمة (بسوابقها وصيغتها المركبة): «والمدعى عليه/» بعد اسم أول تقطعه. صفات الدائرة و«ضد» تقطع
// إذا تلاها فاصل فقط.
const MARKER_AT = new RegExp(`^(?:(?:[وف]?[بكل]?)(${markerAlt})|[وف]?لل(${lilAlt}))(?![${LETTERS}${HARAKAT}])(\\s*[:/\\-–—(«])?`);
const BENCH = new Set(BENCH_MARKERS);
const BENCH_LIL = new Set(BENCH_MARKERS.filter((m) => m.startsWith("ال")).map((m) => m.slice(2)));
function markerStartsAt(text: string, at: number): boolean {
  const m = MARKER_AT.exec(text.slice(at, at + 40));
  if (!m) return false;
  const role = (m[1] ?? "").replace(/\s+/g, " ");
  const lil = (m[2] ?? "").replace(/\s+/g, " ");
  return (BENCH.has(role) || BENCH_LIL.has(lil)) ? Boolean(m[3]) : true;
}
// كلمة تبدأ بأداة تعريف مسبوقة بحرف («والتعويض»، «للتجارة»، «بالمبلغ»): ليست من الاسم.
const PREFIXED_DEFINITE = /^(?:وال|فال|بال|كال|لل)./;

const ROLE_WORDS = new Set(ROLE_MARKERS.filter((m) => !m.includes(" ") && !BENCH_MARKERS.includes(m)));
const markerOf = (role: string): string => {
  const r = role.replace(/\s+/g, " ");
  return ROLE_MARKERS.find((m) => r.endsWith(m)) ?? ROLE_MARKERS.find((m) => m.startsWith("ال") && r.endsWith(m.slice(2))) ?? r;
};

/**
 * كلمة لا تكون جزءًا من اسم: قاطعة (ولو بعد واو أو فاء: «ومبلغ»)، أو صفة، أو منوّنة، أو معرّفة مسبوقة بحرف،
 * أو صفة مركبة تبدأ عندها، أو «علي» بمعنى «على».
 */
function breaksName(text: string, tokenStart: number, w: string): boolean {
  const b = bare(w);
  if (STOP.has(b) || ROLE_WORDS.has(b) || TANWEEN.test(w) || PREFIXED_DEFINITE.test(b)) return true;
  if ((b.startsWith("و") || b.startsWith("ف")) && b.length > 2 && STOP.has(b.slice(1))) return true;
  if (markerStartsAt(text, tokenStart)) return true;
  if (b === "علي") {
    const next = NEXT_WORD.exec(text.slice(tokenStart + w.length, tokenStart + w.length + 40));
    if (next && ALI_AS_ALA.has(bare(next[1]))) return true;
  }
  return false;
}

const NAME_MAX = 5;
const PROXY_AFTER_ROLE = new RegExp(`^\\s*(?:وكالة|أصالة|اصالة)(?![${LETTERS}${HARAKAT}])\\s*(?:[:/\\-–—(«]\\s*)?`);

/** مواضع بدء الصفات والعناوين الملتصقة، مرتبة: حدّ كلمة لا يعبره اسم. */
const gluedStarts = (text: string): number[] =>
  [...text.matchAll(GLUED_RE), ...text.matchAll(GLUED_HEADING_RE)].map((g) => g.index ?? 0).sort((a, b) => a - b);
/** أول حدّ ملتصق داخل الكلمة (from, to)، أو -1 (بحث ثنائي). */
function cutAt(glued: number[], from: number, to: number): number {
  let lo = 0;
  let hi = glued.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (glued[mid] <= from) lo = mid + 1;
    else hi = mid;
  }
  return lo < glued.length && glued[lo] < to ? glued[lo] : -1;
}

type MarkerHit = { index: number; all: string; pre: string; role: string; sep: string; sfx: string; glued?: boolean };
/**
 * ماسح الصفات لنص واحد: الصفة التالية من موضعٍ، المنفصلة (MARKER_RE) أو الملتصقة (GLUED_RE)، أيهما أسبق.
 * تُحفظ آخر مطابقة لكل تعبير ولا يُعاد المسح إلا إذا تجاوزها الموضع، فالكلفة خطية لا تربيعية.
 * (أول مطابقة تبدأ عند موضع أو بعده لا تتوقف على موضع بدء المسح، لأن النظرة الخلفية ترى النص كله.)
 */
function markerScanner(text: string): (from: number) => MarkerHit | null {
  let a: MarkerHit | null = null;
  let aFrom = -1;
  let g: MarkerHit | null = null;
  let gFrom = -1;
  let b: MarkerHit | null = null;
  let bFrom = -1;
  return (from: number) => {
    if (bFrom < 0 || from < bFrom || (b !== null && b.index < from)) {
      BENCH_GLUED_RE.lastIndex = from;
      const m = BENCH_GLUED_RE.exec(text);
      b = m ? { index: m.index, all: m[0], pre: "", role: m[1], sep: "", sfx: "", glued: true } : null;
      bFrom = from;
    }
    const first = pick(from);
    if (!b) return first;
    if (!first) return b;
    // التساوي للملتصقة: «رئيس الدائرة القضائيةفلان» صفة ملتصقة لا صفة دائرة بلا فاصل.
    return b.index <= first.index + first.pre.length ? b : first;
  };
  function pick(from: number): MarkerHit | null {
    if (aFrom < 0 || from < aFrom || (a !== null && a.index < from)) {
      MARKER_RE.lastIndex = from;
      const m = MARKER_RE.exec(text);
      a = m ? { index: m.index, all: m[0], pre: m[1], role: m[2], sep: m[3], sfx: m[4] } : null;
      aFrom = from;
    }
    if (gFrom < 0 || from < gFrom || (g !== null && g.index < from)) {
      GLUED_RE.lastIndex = from;
      const m = GLUED_RE.exec(text);
      g = m ? { index: m.index, all: m[0], pre: "", role: m[1], sep: m[2], sfx: m[3] } : null;
      gFrom = from;
    }
    if (!a) return g;
    if (!g) return a;
    return g.index < a.index + a.pre.length ? g : a;
  }
}

/**
 * يحجب الاسم الذي يلي صفة الطرف (حتى ٥ كلمات، ويتوقف عند أول كلمة قاطعة أو صفة أخرى).
 * صفة الطرف تحتاج فاصلًا بعدها أو كلمة محرّكة قبلها («حضر»، «إلزام»)، واللقب لا يحتاج.
 */
function maskAfterRoles(text: string): string {
  let out = "";
  let last = 0;
  const glued = gluedStarts(text);
  const next = markerScanner(text);
  let from = 0;
  for (let m = next(from); m; m = next(from)) {
    const { all, pre, role, sep, sfx } = m;
    const roleStart = m.index + pre.length;
    if (!all.length) {
      from = m.index + 1;
      continue;
    }
    const hasSep = m.glued === true || /[:/\-–—(«]/.test(sep);
    // لاحقة الجنس لا تُعدّ إلا بعد فاصل («المدعي:ة»)؛ بلا فاصل فهي أول الكلمة التالية.
    const end = m.index + all.length - (hasSep ? 0 : sfx.length);
    const isTitle = TITLES.has(markerOf(role));
    const trigger = TRIGGER_BEFORE.test(text.slice(Math.max(0, roleStart - 16), roleStart));
    // «حضر المدعي وكالة فلان» / «المدعى عليه وكالة فلان» / «أصالة»: صفة الحضور ليست من الاسم، والاسم بعدها.
    const proxy = PROXY_AFTER_ROLE.exec(text.slice(end, end + 32));
    const nameFrom = proxy ? end + proxy[0].length : end;
    // المرفوضة: يُستأنف بعد الصفة نفسها لا بعد الفاصل، فيبقى الفاصل حدًّا قبل الصفة التالية («وكيله المحامي …»).
    if (!hasSep && !isTitle && !trigger && !proxy) {
      from = roleStart + role.length;
      continue;
    }
    if (FIRST_INDEFINITE.has(markerOf(role))) {
      const first = NEXT_WORD.exec(` ${text.slice(nameFrom, nameFrom + 40).replace(/^\s*/, "")}`);
      if (!first || bare(first[1]).startsWith("ال")) {
        from = roleStart + role.length;
        continue;
      }
    }
    // الكلمات بعد الفاصل: أسماء حتى ٥، وتتوقف عند كلمة قاطعة أو صفة.
    TOKEN_RE.lastIndex = nameFrom;
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
      if (/^[^\S\n]*\n/.test(text.slice(nameEnd, nameEnd + 64))) break;
    }
    if (count === 0) {
      from = roleStart + role.length;
      continue;
    }
    const nameStart = nameFrom + (text.slice(nameFrom, nameFrom + 64).match(/^\s*/)?.[0].length ?? 0);
    out += text.slice(last, nameStart) + NAME_MASK;
    last = nameEnd;
    from = nameEnd;
  }
  return out + text.slice(last);
}

/**
 * يحجب سلاسل النسب («فلان بن فلان …») ومعها حتى كلمتين بعدها (الجد واسم العائلة بسابقته «آل/أبو»)،
 * ما لم تكن الكلمة قاطعة أو صفة أو منوّنة أو معرّفة مسبوقة بحرف أو أولَ سلسلة تالية، ولا يتجاوز سطرًا أو جدولة.
 */
function maskNasab(text: string): string {
  let out = "";
  let last = 0;
  const glued = gluedStarts(text);
  NASAB_RE.lastIndex = 0;
  for (let m = NASAB_RE.exec(text); m; m = NASAB_RE.exec(text)) {
    // «ابن السبيل» في السلسلة: يُحجب ما قبله إن كان سلسلة وحده («لسالم بن علي ابن السبيل»)، ويبقى المصطلح.
    const sabil = SABIL_IN.exec(m[0]);
    if (sabil) {
      const head = CHAIN_HEAD.exec(m[0].slice(0, sabil.index));
      if (head) {
        out += text.slice(last, m.index) + NAME_MASK;
        last = m.index + head[0].length;
      }
      NASAB_RE.lastIndex = m.index + sabil.index + sabil[0].length;
      continue;
    }
    let end = m.index + m[0].length;
    for (let extra = 0; extra < 2; ) {
      TOKEN_RE.lastIndex = end;
      const t = TOKEN_RE.exec(text);
      // سطر أو جدولة بين الكلمتين: اسم آخر (قوائم أعضاء الدائرة).
      if (!t || /[\n\t]/.test(text.slice(end, TOKEN_RE.lastIndex - t[1].length))) break;
      const w = t[1];
      const tokenStart = TOKEN_RE.lastIndex - w.length;
      if (SABIL.test(text.slice(tokenStart, tokenStart + 24))) break;
      if (FAMILY_PREFIX.has(bare(w))) {
        // السابقة لا تُعدّ، ويلزم بعدها اسم؛ وما بعدها اسم ولو وافق كلمة قاطعة («آل طالب»).
        const after = TOKEN_RE.exec(text);
        if (!after || /[\n\t]/.test(text.slice(tokenStart + w.length, TOKEN_RE.lastIndex - after[1].length))) break;
        const a = after[1];
        const aStart = TOKEN_RE.lastIndex - a.length;
        if (ROLE_WORDS.has(bare(a)) || TANWEEN.test(a) || markerStartsAt(text, aStart)) break;
        end = TOKEN_RE.lastIndex;
        extra++;
        continue;
      }
      if (breaksName(text, tokenStart, w) || bare(w).length < 2) break;
      const cut = cutAt(glued, tokenStart, TOKEN_RE.lastIndex);
      if (cut !== -1) {
        end = cut;
        break;
      }
      // كلمة يليها «بن» أولُ سلسلة أخرى («… الجليفي عضو عمر بن …»): تُترك لها.
      const ahead = text.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 24);
      if (STARTS_CHAIN.test(ahead) && !SABIL.test(ahead)) break;
      end = TOKEN_RE.lastIndex;
      extra++;
    }
    out += text.slice(last, m.index) + NAME_MASK;
    last = end;
    NASAB_RE.lastIndex = end;
  }
  return out + text.slice(last);
}

// مراسي الهوية الشخصية (والتطويل بين حروفها: «ســـجل مدني»)، بالتنكير والتعريف («بموجب السجل المدني»).
// السجل التجاري ليس منها. يلزم بعد المرسى بقليل (على السطر نفسه) ما يدل على رقم: «(» أو «[» أو رقم أو «…».
const tat = (w: string) => [...w].join("ـ*");
const def = (w: string, lead: boolean) => `${lead ? "(?:بال|ال)?" : "(?:ال)?"}${tat(w)}`;
const ID_ANCHOR_WORDS: Array<[string, string | null]> = [
  ["سجل", "مدني"], ["هوية", "وطنية"], ["هوية", "مقيم"], ["هوية", "رقم"], ["رخصة", "إقامة"], ["رخصة", "اقامة"],
  ["إقامة", "رقم"], ["اقامة", "رقم"], ["بطاقة", "أحوال"], ["حفيظة", "نفوس"],
];
const ID_ANCHORS = [
  ...ID_ANCHOR_WORDS.map(([a, b]) => `${def(a, true)}\\s+${b === "رقم" ? tat(b) : def(b!, false)}`),
  // «رقم الهوية» و«رقم السجل المدني» و«رقم الإقامة».
  `${tat("رقم")}\\s+(?:${["هوية", "سجل", "إقامة", "اقامة"].map((w) => `ال${tat(w)}`).join("|")})`,
];
const ID_ANCHOR_RE = new RegExp(
  `(?<![${LETTERS}${HARAKAT}])(?:(?:بموجب|حامل|حاملة|يحمل|تحمل)\\s+)?(?:${ID_ANCHORS.join("|")})(?![${LETTERS}])(?=(?:[^\\n\\u0640]\\u0640*){0,25}?[(\\[0-9٠-٩…])`,
  "g",
);
// «<نسبة> الجنسية» بعد الاسم: «فلان سعودي الجنسية».
const NATIONALITY_RE = new RegExp(`(?<![${LETTERS}${HARAKAT}])[${LETTERS}]+(?:ي|ية)\\s+${tat("الجنسية")}(?![${LETTERS}])`, "g");
// ما يسبق المرسى وليس اسمًا: «صاحب هوية رقم»، «صورة سجل مدني»، «رسوم رخصة إقامة»، «من نظام العمل … هوية رقم».
const ANCHOR_STOP = new Set([
  "صاحب", "صاحبة", "حامل", "حاملة", "يحمل", "تحمل", "ويحمل", "وتحمل", "بطاقة", "برقم", "ورقم", "حسب", "بحسب", "باسم", "اسم",
  "المدعى", "المستأنف", "المسجل", "المسجلة", "لصاحبها", "لمالكها", "ومالكها",
  "صورة", "وصورة", "أصل", "اصل", "نسخة", "تجديد", "وتجديد", "إصدار", "اصدار", "رسوم", "انتهاء", "نقل", "ونقل", "وتسليمه",
  "أرفق", "وأرفق", "ارفق", "وارفق", "وقدم", "نظام", "وتعديلاتها", "بشأن", "يثبت", "ما", "العمل", "للعامل", "العامل", "ذات", "ذو",
  "شركة", "مؤسسة", "أجنبي", "أجنبية", "اجنبي", "اجنبية",
  // أفعال ومصادر وأوصاف عمالة قبل المرسى: «وانتهت رخصة إقامة…»، «فقدان هوية وطنية…»، «المكفول هندي الجنسية».
  "انتهت", "وانتهت", "تبين", "وتبين", "ألغيت", "الغيت", "ثبت", "وثبت", "فقدان", "استخراج", "تزوير", "بدل", "فاقد",
  "المكفول", "المكفولة", "مكفول", "مكفولة", "العاملة", "عاملا", "عاملة", "منزليا", "منزلية", "سائقا", "سائق", "السائق",
  "موظفا", "مقيما", "وافدا", "الوافد", "الوافدة", "المتوفى", "المتوفاة", "المتوفي", "وكان", "كانت", "وكانت", "أنه", "بأنه",
]);
const isSpace = (c: string | undefined) => c === " " || c === "\t" || c === " ";

/** يحجب ما يسبق المراسي من كلمات الاسم (حتى ٥، ويعبر «[اسم]» السابق وفاصلة قبل المرسى). */
function maskBeforeAnchors(text: string): string {
  const spans: Array<[number, number]> = [];
  const starts = [...text.matchAll(ID_ANCHOR_RE), ...text.matchAll(NATIONALITY_RE)].map((m) => m.index ?? 0).sort((a, b) => a - b);
  for (const start of starts) {
    let k = start;
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
        if (bare(w).length < 2 || breaksName(text, s, w) || ANCHOR_STOP.has(bare(w))) break;
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
  spans.sort((x, y) => x[0] - y[0]);
  let out = "";
  let last = 0;
  for (const [s, e] of spans) {
    if (s < last) continue;
    out += text.slice(last, s) + NAME_MASK;
    last = e;
  }
  return out + text.slice(last);
}

// أشكال العرض العربية (نص مستخرج من PDF) والحروف والأرقام كاملة العرض تُطبَّع وحدها (NFKC)، فتنطبق القواعد عليها.
// وما سواها من نص الحكم لا يُغيَّر: «ﷺ» و«ﷲ» (U+FDF0–U+FDFF) و«½» و«…» كما في المصدر، و«ﷲ» كما في search_norm.
const COMPAT_FORMS = /[\uFB50-\uFDEF\uFE70-\uFEFF\uFF00-\uFFEF]+/g;
export const normalizeCompatForms = (text: string): string => text.replace(COMPAT_FORMS, (s) => s.normalize("NFKC"));

/** الحجب الكامل: أرقام شخصية (redactPII) ثم الأسماء. */
export function maskPersonalData(text: string | null | undefined): string {
  if (!text) return "";
  // تمريرات متتالية: الصفة الثانية في «المدعي/ فلان ضد المدعى عليه/ فلان» تقع داخل كلمات التقاط الأولى.
  let out = maskNasab(redactPII(normalizeCompatForms(text)));
  for (let i = 0; i < 4; i++) {
    const next = maskAfterRoles(out);
    if (next === out) break;
    out = next;
  }
  out = maskBeforeAnchors(out);
  return out.replace(/(\[اسم\]\s*){2,}/g, `${NAME_MASK} `);
}
