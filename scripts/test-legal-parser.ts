/**
 * test-legal-parser.ts — اختبارات مكتبة القراءة (المرحلة ٢) على ثلاث عيّنات.
 *
 * ملاحظة: العيّنات هنا **مُصطنَعة** مطابِقة لصيَغ أم القرى (نظام بأبوابه، مرسوم
 * ببنوده، لائحة بفقرات فرعية) — لأن جلب العيّنات الحيّة من rssFeed/21 محجوب بسياسة
 * الشبكة في بيئة البناء. النجاح الحاكم = إعادة تركيب النصّ حرفيًّا + شجرة صحيحة.
 * يجب تكرار الاختبار على ثلاث عيّنات حقيقية في بيئةٍ تصل للمصدر قبل الاعتماد.
 *
 * تشغيل: npx tsx scripts/test-legal-parser.ts
 */
import { parseDocument } from "@/lib/legal-parser";
import type { DocUnitType } from "@/lib/legal-parser";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
}

// ── عيّنة ١: نظام بأبوابه (تمهيد + استناد + باب + فصل + مواد + تعريفات + فقرات) ──
const SYSTEM = `نظام تجريبي للاختبار

بناءً على النظام الأساسي للحكم، وبعد الاطلاع على قرار مجلس الوزراء رقم (١).

الباب الأول: أحكام عامة

المادة الأولى: يقصد بالألفاظ والعبارات الآتية المعاني المبينة أمام كل منها:
النظام: هذا النظام.
اللائحة: اللائحة التنفيذية لهذا النظام.

المادة الثانية: تسري أحكام هذا النظام على ما يأتي:
1- الحالة الأولى.
2- الحالة الثانية.

الفصل الأول: الالتزامات

المادة الثالثة عشرة: على المكلف الآتي:
أ- الالتزام الأول.
ب- الالتزام الثاني.
`;

// ── عيّنة ٢: مرسوم ملكي ببنوده (افتتاحية + استنادات + بنود منطوق) ──
const DECREE = `الرقم: م/١
التاريخ: ١٨/١١/١٤٣١هـ

بعون الله تعالى، نحن ملك المملكة العربية السعودية.

بناءً على المادة السبعين من النظام الأساسي للحكم.
وبعد الاطلاع على المرسوم الملكي رقم (م/١٩١) وتاريخ ١٨/١١/١٤٣١هـ.
وبعد النظر في قرار مجلس الوزراء رقم (٤٣).
رسمنا بما هو آت:
أولاً: الموافقة على نظام كذا بالصيغة المرافقة له.
ثانياً: على سمو ولي العهد ونواب رئيس مجلس الوزراء تنفيذ هذا المرسوم.
`;

// ── عيّنة ٣: لائحة بفقراتها الفرعية ──
const BYLAW = `اللائحة التنفيذية لنظام تجريبي

المادة الأولى: تعاريف عامة لأغراض هذه اللائحة.

المادة الثانية: على الجهة اتباع الآتي:
1- الإجراء الأول:
أ- خطوة أولى.
ب- خطوة ثانية.
2- الإجراء الثاني.
`;

function types(units: { type: DocUnitType }[]): Set<DocUnitType> {
  return new Set(units.map((u) => u.type));
}

console.log("عيّنة ١: نظام بأبوابه");
{
  const r = parseDocument(SYSTEM);
  const t = types(r.units);
  check("إعادة التركيب حرفية", r.reconstructionOk);
  check("النوع نظام", r.kind === "SYSTEM_TEXT", r.kind);
  check("يحوي باب/فصل/مادة", t.has("PART") && t.has("CHAPTER") && t.has("ARTICLE"));
  check("يحوي تعريفات", t.has("DEFINITION_ITEM"));
  check("يحوي فقرة وفقرة فرعية", t.has("PARAGRAPH") && t.has("SUBPARAGRAPH"));
  const arts = r.units.filter((u) => u.type === "ARTICLE").map((u) => u.number);
  check("أرقام المواد 1,2,13", JSON.stringify(arts) === JSON.stringify(["1", "2", "13"]), JSON.stringify(arts));
  const defs = r.units.filter((u) => u.type === "DEFINITION_ITEM");
  check("تعريفان (النظام/اللائحة)", defs.length === 2, defs.map((d) => d.label).join(", "));
  // في هذه العيّنة تتبع الفقرات الفرعية المادة ١٣ مباشرةً (بلا فقرة وسيطة) — فالأب مادة.
  const sub = r.units.find((u) => u.type === "SUBPARAGRAPH");
  const parent = sub?.parentOrdinal != null ? r.units[sub.parentOrdinal] : undefined;
  check("الفقرة الفرعية بنت المادة ١٣", parent?.type === "ARTICLE" && parent?.number === "13", parent ? `${parent.type}:${parent.number}` : "—");
}

console.log("عيّنة ٢: مرسوم ببنوده");
{
  const r = parseDocument(DECREE);
  const t = types(r.units);
  check("إعادة التركيب حرفية", r.reconstructionOk);
  check("النوع مرسوم", r.kind === "ROYAL_DECREE", r.kind);
  check("افتتاحية أداة", t.has("INSTRUMENT_OPENING"));
  const recitals = r.units.filter((u) => u.type === "RECITAL");
  check("ثلاثة استنادات", recitals.length === 3, String(recitals.length));
  const clauses = r.units.filter((u) => u.type === "INSTRUMENT_CLAUSE");
  check("بندان منطوقان (1,2)", clauses.map((c) => c.number).join(",") === "1,2", clauses.map((c) => c.number).join(","));
  const cited = recitals.find((rc) => rc.recital?.number);
  check("استخراج إحالة استناد (رقم)", Boolean(cited?.recital?.number), cited?.recital?.number ?? "");
  check("استخراج تاريخ هجري", Boolean(cited?.recital?.hijriDate), cited?.recital?.hijriDate ?? "");
}

console.log("عيّنة ٣: لائحة بفقرات فرعية");
{
  const r = parseDocument(BYLAW, { kind: "BYLAW" });
  const t = types(r.units);
  check("إعادة التركيب حرفية", r.reconstructionOk);
  check("يحوي فقرات فرعية", t.has("SUBPARAGRAPH"));
  const subs = r.units.filter((u) => u.type === "SUBPARAGRAPH").map((u) => u.number);
  check("ترقيم الحروف أ=1 ب=2", JSON.stringify(subs) === JSON.stringify(["1", "2"]), JSON.stringify(subs));
  const sub = r.units.find((u) => u.type === "SUBPARAGRAPH");
  check("مسار هرمي للفقرة الفرعية", Boolean(sub && /article:2\/para:1\/sub:1/.test(sub.path)), sub?.path ?? "");
}

console.log(`\n${failures === 0 ? "✓ PASS" : "✗ FAIL"} — ${failures} إخفاق(ات).`);
process.exit(failures === 0 ? 0 : 1);
