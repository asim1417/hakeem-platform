/**
 * HKM-012 (الأمر ٠٨، المسار ٣) — حجب أسماء الأفراد في مخرجات أدوات الأحكام في الموصل. بلا قاعدة.
 * أسماء وأرقام مصطنعة بالكامل.
 *   npm run test:mcp-ruling-privacy
 */
import { NAME_MASK } from "../lib/rulings/research/mask";
import { maskRulingText, maskedRulingExcerpts, safeChunkBounds, sentenceSafeBounds } from "../lib/mcp/ruling-privacy";

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
  "لدى الدائرة التجارية الأولى وبعد الاطلاع على أوراق القضية المقامة من المدعي/ غانم الموسوي ضد شركة النخيل للتجارة.",
  "الوقائع: تتلخص في أن المدعي تقدم بصحيفة دعوى ذكر فيها أن وكيله المحامي قيصر الطاهري أبرم عقدًا مع المدعى عليها.",
  "وحضر المدعو زيدان بن مروان بن هلال الفلاني بصفته شاهدًا، وأفادت الشاهدة رجاء السندي بما يوافق ذلك.",
  "الأسباب: وحيث إن المادة 107 من نظام المعاملات المدنية تقضي بفسخ العقد عند الإخلال، وحيث إن المدعي/ غانم الموسوي أثبت الإخلال.",
  "وحيث إن هوية المدعي رقم 1234567890 وجواله 0551234567 لا أثر لهما في الحكم.",
  "منطوق الحكم: حكمت الدائرة بفسخ العقد وإلزام شركة النخيل للتجارة بأن تدفع للمدعي/ غانم الموسوي مبلغ مائة ألف ريال.",
].join("\n");

// ١) الحجب نفسه
const m = maskRulingText(RULING);
ok(leaks(m).length === 0, `maskRulingText: لا اسم مصطنع في النص المحجوب (${leaks(m).join("،") || "لا تسرّب"})`);
ok(m.includes(NAME_MASK), "maskRulingText: علامة الاسم موجودة");
ok(m.includes("شركة النخيل للتجارة") && m.includes("المادة 107"), "maskRulingText: اسم الشركة ورقم المادة باقيان");
ok(!m.includes("1234567890") && !m.includes("0551234567"), "maskRulingText: الهوية والجوال محجوبان");
ok(maskRulingText(null) === "" && maskRulingText(undefined) === "", "maskRulingText: الفارغ نص فارغ");
for (const [src, label] of [
  ["بأن تدفع للمدعي/ غانم الموسوي مبلغًا", "للمدعي/"],
  ["وحكمت بالمدعى عليه زيدان الفلاني", "بالمدعى عليه"],
  ["وللمستأنف ضده قيصر الطاهري حق الرد", "وللمستأنف ضده"],
  ["كالمدعية رجاء السندي في ذلك", "كالمدعية"],
] as const) ok(leaks(maskRulingText(src)).length === 0 && maskRulingText(src).includes(NAME_MASK), `الصفة بعد حرف جر ملتصق «${label}» يُحجب ما بعدها`);

// ٢) المقتطف والمنطوق من النص المحجوب كاملًا
for (const q of ["فسخ العقد", "الإخلال", "غانم الموسوي", "شاهدًا", ""]) {
  const ex = maskedRulingExcerpts(RULING, q);
  ok(leaks(ex.snippet).length === 0 && leaks(ex.disposition ?? "").length === 0, `maskedRulingExcerpts «${q || "بلا لفظ"}»: لا اسم في المقتطف ولا المنطوق`);
}
const sem = maskedRulingExcerpts(RULING, "أي شيء", "reasons");
ok(leaks(sem.snippet).length === 0, "maskedRulingExcerpts (دلالي، الأسباب): لا اسم");
ok(maskedRulingExcerpts(RULING, "غانم الموسوي").snippet.length > 0, "البحث باسم فرد لا يعيد الاسم، والمقتطف غير فارغ");

// ٣) حدود الشريحة: «المدعي/» في شريحة والاسم في التالية لا يقع
const idx = RULING.indexOf("غانم");
const b = sentenceSafeBounds(RULING, 0, idx - 2, 0, RULING.length); // نهاية بين «المدعي/» والاسم
ok(b.end > RULING.indexOf("الموسوي"), "sentenceSafeBounds: النهاية تُمدّ إلى ما بعد الاسم (فاصل الجملة)");
const b2 = sentenceSafeBounds(RULING, idx + 2, RULING.length, 0, RULING.length); // بداية داخل الاسم
ok(b2.start <= RULING.lastIndexOf("المدعي/", idx), "sentenceSafeBounds: البداية تُرجع إلى أول الجملة");
const noBreak = "كلمة ".repeat(200);
const b3 = sentenceSafeBounds(noBreak, 13, 503, 0, noBreak.length);
ok(b3.end - 503 <= 300 && /\s/.test(noBreak[b3.end] ?? " ") && (b3.start === 0 || /\s/.test(noBreak[b3.start - 1])), "sentenceSafeBounds: بلا فاصل جملة يُكتفى بحد كلمة ضمن المدى");

// ٤) خاصية: تقطيع الحكم كله بأطوال وإزاحات مختلفة (كما يفعل hakeem_get_ruling بـ next_offset) لا يسرّب اسمًا
let chunks = 0;
let leaked: string[] = [];
let covered = true;
for (let maxChars = 20; maxChars <= 400; maxChars += 7) {
  let offset = 0;
  let prevEnd = 0;
  for (let guard = 0; guard < 500; guard++) {
    const { start, end } = safeChunkBounds(RULING, 0, RULING.length, offset, maxChars);
    if (start > prevEnd) covered = false;
    const out = maskRulingText(RULING.slice(start, end));
    leaked = leaked.concat(leaks(out));
    chunks++;
    prevEnd = end;
    if (end >= RULING.length) break;
    offset = end; // next_offset = start - lo + chunk.length = end (lo = 0)
  }
}
ok(leaked.length === 0, `التقطيع: ${chunks} شريحة بلا اسم مصطنع (${[...new Set(leaked)].join("،") || "لا تسرّب"})`);
ok(covered, "التقطيع: الشرائح المتتالية تغطي النص بلا فجوة");
// الإزاحة داخل الجزء: lo > 0
const lo = RULING.indexOf("الأسباب:");
const hi = RULING.length;
const c = safeChunkBounds(RULING, lo, hi, 5, 30);
ok(c.start >= lo && c.end <= hi, "safeChunkBounds: الحدود داخل الجزء المطلوب");
// الأرقام لا تُقطع
const numText = "رقم الهوية 1234567890 ثم نص";
const n = safeChunkBounds(numText, 0, numText.length, 0, 15);
ok(n.end >= numText.indexOf("1234567890") + 10 || n.end <= numText.indexOf("1234567890"), "safeChunkBounds: لا تقطع داخل رقم");

console.log(failed === 0 ? "✓ حجب الأسماء في الموصل" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
