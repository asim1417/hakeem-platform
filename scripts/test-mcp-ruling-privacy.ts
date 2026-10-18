/**
 * HKM-012 (الأمر ٠٨، المسار ٣) — حجب أسماء الأفراد في مخرجات أدوات الأحكام في الموصل. بلا قاعدة.
 * أسماء وأرقام مصطنعة بالكامل.
 *   npm run test:mcp-ruling-privacy
 */
import { NAME_MASK } from "../lib/rulings/research/mask";
import { redactPII } from "../lib/modules/legal-core/rulings-search";
import { excerptFrom } from "../lib/modules/legal-core/ruling-excerpts";
import { maskRulingText, maskedChunk, maskedRulingExcerpts, sliceMasked } from "../lib/mcp/ruling-privacy";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

// أسماء مصطنعة: كل كلمة منها يجب ألا تظهر في أي مخرج.
const NAME_WORDS = ["غانم", "الموسوي", "زيدان", "مروان", "هلال", "الفلاني", "رجاء", "السندي", "قيصر", "الطاهري"];
const leaks = (s: string) => NAME_WORDS.filter((w) => new RegExp(`(^|[^\\u0621-\\u064A])${w}([^\\u0621-\\u064A]|$)`).test(s));

const RULING = [
  "الحمد لله وحده والصلاة والسلام على من لا نبي بعده.",
  "لدى الدائرة التجارية الأولى وبعد الاطلاع على أوراق القضية المقامة من المدعي/ غانم الموسوي ضد المدعى عليه/ زيدان الفلاني.",
  "الوقائع: تتلخص في أن المدعي تقدم بصحيفة دعوى ذكر فيها أن وكيله المحامي قيصر الطاهري أبرم عقدًا مع المدعى عليه.",
  "وحضر المدعو زيدان بن مروان بن هلال الفلاني بصفته شاهدًا، وحضرت الشاهدة رجاء السندي بما يوافق ذلك.",
  "الأسباب: وحيث إن المادة 107 من نظام المعاملات المدنية تقضي بفسخ العقد عند الإخلال، وحيث إن المدعي/ غانم الموسوي أثبت الإخلال.",
  "وحيث إن هوية المدعي رقم 1234567890 وجواله 0551234567 لا أثر لهما في الحكم.",
  "منطوق الحكم: حكمت الدائرة بفسخ العقد وإلزام المدعى عليه زيدان الفلاني بأن يدفع للمدعي/ غانم الموسوي مبلغ مائة ألف ريال.",
].join("\n");

// ١) الحجب نفسه
const m = maskRulingText(RULING);
ok(leaks(m).length === 0, `maskRulingText: لا اسم مصطنع في الحكم المحجوب (${leaks(m).join("،") || "لا تسرّب"})`);
ok(m.includes("المادة 107") && m.includes("مبلغ مائة ألف ريال") && m.includes("أبرم عقدًا"), "maskRulingText: رقم المادة والمبلغ وما بعد الاسم باقية");
ok(!m.includes("1234567890") && !m.includes("0551234567"), "maskRulingText: الهوية والجوال محجوبان");
ok(maskRulingText(null) === "" && maskRulingText(undefined) === "", "maskRulingText: الفارغ نص فارغ");

const masked: Array<[string, string]> = [
  ["بأن تدفع للمدعي/ غانم الموسوي مبلغًا", "للمدعي/"],
  ["وحكمت بالمدعى عليه/ زيدان الفلاني", "بالمدعى عليه/"],
  ["وللمستأنف ضده/ قيصر الطاهري حق الرد", "وللمستأنف ضده/"],
  ["حضر الوكيل/ قيصر الطاهري", "الوكيل/"],
  ["وكيل المدعية/ رجاء السندي", "وكيل المدعية/ (صفة تلي صفة)"],
  ["المدعي/ غانم الموسوي ضد المدعى عليه/ زيدان الفلاني", "طرفان فردان"],
  ["المتهم/ زيدان الفلاني", "المتهم/"],
  ["المستأنف عليه/ غانم الموسوي", "المستأنف عليه/"],
  ["طالب التنفيذ: زيدان الفلاني", "طالب التنفيذ:"],
  ["المدعي (غانم الموسوي)", "قوس"],
  ["وحضرت المدعية رجاء السندي", "حضرت + صفة"],
  ["بإلزام المدعى عليه زيدان الفلاني بأن يدفع", "بإلزام + صفة"],
  ["السيد غانم الموسوي", "لقب"],
  ["وكيله المحامي قيصر الطاهري أبرم عقدًا", "وكيله المحامي"],
];
for (const [src, label] of masked) {
  const out = maskRulingText(src);
  ok(leaks(out).length === 0 && out.includes(NAME_MASK), `يُحجب: ${label} → «${out}»`);
}
const kept: Array<[string, string]> = [
  ["حكمت للمدعي بمبلغ مائة ألف ريال", "المبلغ بعد «للمدعي» بلا فاصل"],
  ["للمدعين المطالبة وفق المادة 120", "«للمدعين» ليست «للمدعي»"],
  ["وحيث إن المدعي طلب فسخ العقد وأقر بالاستلام", "فعل بعد الصفة بلا فاصل"],
  ["المدعية/ شركة النخيل للتجارة", "الشركة"],
  ["وحضرت المدعية في الموعد المحدد", "حرف بعد الصفة"],
];
for (const [src, label] of kept) {
  const out = maskRulingText(src);
  ok(out === src, `لا يُحجب: ${label} → «${out}»`);
}
ok(!maskRulingText("المدعية رجاء").includes("المدعي[اسم]"), "الصفة كاملة: «المدعية» لا تنقسم إلى «المدعي» + اسم");

// ٢) المقتطف والمنطوق من النص المحجوب كاملًا
for (const q of ["فسخ العقد", "الإخلال", "غانم الموسوي", "شاهدًا", ""]) {
  const ex = maskedRulingExcerpts(RULING, q);
  ok(leaks(ex.snippet).length === 0 && leaks(ex.disposition ?? "").length === 0, `maskedRulingExcerpts «${q || "بلا لفظ"}»: لا اسم في المقتطف ولا المنطوق`);
}
// الدلالي: من الموضع المطابق نفسه (كما يقتطعه searchRulingsDirect من النص الخام)، لا من بداية الجزء.
const at = RULING.indexOf("وحيث إن المدعي/ غانم");
const original = redactPII(excerptFrom(RULING, at));
const sem = maskedRulingExcerpts(RULING, "", { part: "reasons", originalSnippet: original });
ok(sem.snippet.startsWith("وحيث إن المدعي/ [اسم]") && leaks(sem.snippet).length === 0, `الدلالي: يبدأ من الموضع المطابق محجوبًا («${sem.snippet.slice(0, 30)}…»)`);
const semFallback = maskedRulingExcerpts(RULING, "", { part: "reasons", originalSnippet: "نص لا يوجد في الحكم إطلاقًا ولا جزء منه" });
ok(leaks(semFallback.snippet).length === 0 && semFallback.snippet.length > 0, "الدلالي: مقتطف لا يوجد يرجع إلى بداية الجزء محجوبًا");

// ٣) شرائح الجلب: من النص المحجوب كاملًا، متتالية بلا فجوة ولا تداخل، وبلا اسم في أي حجم
const full = maskRulingText(RULING);
let allExact = true;
let leaked: string[] = [];
let chunks = 0;
for (let size = 1; size <= 400; size += 3) {
  let off: number | null = 0;
  let joined = "";
  for (let g = 0; off !== null && g < 5000; g++) {
    const s = sliceMasked(full, off, size);
    if (s.offset !== off) allExact = false;
    joined += s.text;
    leaked = leaked.concat(leaks(s.text));
    chunks++;
    off = s.nextOffset;
  }
  if (joined !== full) allExact = false;
}
ok(allExact, "الشرائح المتتالية = النص المحجوب حرفًا (لا فجوة ولا تداخل)");
ok(leaked.length === 0, `الشرائح: ${chunks} شريحة بلا اسم (${[...new Set(leaked)].join("،") || "لا تسرّب"})`);
const end = sliceMasked(full, full.length, 50);
ok(end.text === "" && end.nextOffset === null, "إزاحة عند النهاية = شريحة فارغة");
const beyond = sliceMasked(full, full.length + 99, 50);
ok(beyond.text === "" && beyond.nextOffset === null, "إزاحة بعد النهاية = شريحة فارغة");
const mid = sliceMasked(full, 10, 20);
ok(mid.text.length >= 20 && mid.text.length <= 60 && (mid.nextOffset === null || /\s/.test(full[mid.nextOffset] ?? " ")), "النهاية تُمدّ إلى مسافة ضمن ٤٠ حرفًا");
const mc = maskedChunk(RULING, 0, 10_000);
ok(mc.total === full.length && mc.text === full && mc.nextOffset === null, "maskedChunk: الحكم كله في شريحة واحدة محجوبًا");

console.log(failed === 0 ? "✓ حجب الأسماء في الموصل" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
