/**
 * mask — حجب البيانات الشخصية في نصوص الأحكام قبل العرض أو التصدير أو الإرسال إلى نموذج.
 *
 * يعيد استعمال redactPII القائم (الهوية والإقامة والجوال والآيبان والبريد، مع حماية أرقام
 * المواد والصكوك والتواريخ)، ويضيف حجب أسماء الأفراد بقاعدتين محافظتين:
 *   ١. سلاسل النسب: «محمد بن عبدالله بن سعد القحطاني» ← [اسم].
 *   ٢. ما يلي صفة الطرف: «المدعي/ سعد الدوسري» ← «المدعي/ [اسم]».
 * لا تحجب أسماء الشركات والجهات (ليست بيانات شخصية)، ولا الصفات نفسها، ولا أرقام المواد.
 * الحجب قاعدي وقد يفوته اسم بلا صفة ولا نسب؛ لذا يُقاس على العيّنة الذهبية ويُراجع.
 */
import { redactPII } from "../../modules/legal-core/rulings-search";

export const NAME_MASK = "[اسم]";

const AR = "[\\u0621-\\u064A]+";
// صفات يليها اسم شخص طبيعي (لا «شركة» ولا «مؤسسة» ولا «الجهة»).
const ROLE_MARKERS = [
  "المدعي", "المدعية", "المدعى عليه", "المدعى عليها", "المدعيان", "المدعى عليهما",
  "المستأنف", "المستأنفة", "المستأنف ضده", "المستأنف ضدها",
  "السيد", "السيدة", "المواطن", "المواطنة", "المقيم", "المقيمة", "الأستاذ", "الأستاذة",
  "المحامي", "المحامية", "وكيل", "وكيله", "وكيلها", "وكيلهم", "وكيلة", "المدعو", "المدعوة",
  "الشاهد", "الشاهدة", "الكفيل", "الضامن",
];
// ما يقطع الاسم بعد الصفة (حروف وأفعال وصفات تابعة).
const STOP = new Set([
  "بأن", "بان", "أن", "ان", "إن", "على", "علي", "في", "عن", "من", "إلى", "الى", "ضد", "مع", "الذي", "التي",
  "وقد", "قد", "حيث", "بصفته", "بصفتها", "بموجب", "هوية", "سجل", "رقم", "المذكور", "المذكورة", "المشار",
  "شركة", "مؤسسة", "الشركة", "المؤسسة", "بنك", "البنك", "الجهة", "وزارة", "الوزارة", "هيئة", "الهيئة",
  "وكالة", "بالوكالة", "أصالة", "اصالة", "ولم", "ولا", "لم", "لا", "قدم", "تقدم", "يطلب", "طلب", "وطلب",
  "أنه", "انه", "أنها", "انها", "فقد", "وحضر", "حضر", "الحاضر", "الحاضرة", "و", "ثم", "بعد", "قبل",
]);

const markerAlt = ROLE_MARKERS.sort((a, b) => b.length - a.length).map((m) => m.replace(/ /g, "\\s+")).join("|");
// الصفة المعرّفة بعد حرف جر ملتصق: «للمدعي» (ل + المدعي بحذف الألف)، و«بالمدعي» و«كالمدعي» و«وللمدعي» (HKM-012، الأمر ٠٨).
const lilAlt = ROLE_MARKERS.filter((m) => m.startsWith("ال")).map((m) => m.slice(2).replace(/ /g, "\\s+")).join("|");
const ROLE_RE = new RegExp(
  `(^|[^\\u0621-\\u064A])((?:[وف]?[بكل]?)(?:${markerAlt})|[وف]?لل(?:${lilAlt}))(\\s*[:/،-]?\\s*)((?:${AR}\\s*){1,5})`,
  "g",
);
const NASAB_RE = new RegExp(`${AR}(?:\\s+(?:بن|بنت|ابن|ابنة)\\s+${AR})+(?:\\s+(?:آل\\s+)?${AR})?`, "g");

const ROLE_WORDS = new Set(ROLE_MARKERS.filter((m) => !m.includes(" ")));

/** يحجب الاسم الذي يلي صفة الطرف (حتى ٤ كلمات، ويتوقف عند أول كلمة قاطعة). صفة تالية تبقى. */
function maskAfterRoles(text: string): string {
  return text.replace(ROLE_RE, (all, pre: string, role: string, sep: string, words: string) => {
    const toks = words.trim().split(/\s+/);
    let i = 0;
    const kept: string[] = [];
    while (i < toks.length && ROLE_WORDS.has(toks[i])) kept.push(toks[i++]); // «وكيله المحامي …»
    const name: string[] = [];
    while (i < toks.length && !STOP.has(toks[i]) && !ROLE_WORDS.has(toks[i]) && name.length < 4) name.push(toks[i++]);
    if (!name.length) return all;
    const rest = toks.slice(i).join(" ");
    const trailing = /\s$/.test(words) ? " " : "";
    const head = kept.length ? `${kept.join(" ")} ` : "";
    return `${pre}${role}${sep}${head}${NAME_MASK}${rest ? " " + rest : ""}${trailing}`;
  });
}

/** يحجب سلاسل النسب («فلان بن فلان …»). */
function maskNasab(text: string): string {
  return text.replace(NASAB_RE, NAME_MASK);
}

/** الحجب الكامل: أرقام شخصية (redactPII) ثم الأسماء. */
export function maskPersonalData(text: string | null | undefined): string {
  if (!text) return "";
  return maskAfterRoles(maskNasab(redactPII(text))).replace(/(\[اسم\]\s*){2,}/g, `${NAME_MASK} `);
}
