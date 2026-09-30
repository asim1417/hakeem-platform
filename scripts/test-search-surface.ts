// اختبار قبول الموجة ١ (وجه البحث + مطابقة الأسماء) على لقطة المختبر المحلي.
// التشغيل: npx tsx scripts/test-search-surface.ts [snapshot.json]
// اللقطة تُنتج بـ ingest/search-surface-2026-09-28/tests/export_snapshot.py بعد build_surface.py.
import { readFileSync, writeFileSync } from "node:fs";
import { computeSurface, mapToSurface, inSurface, type SurfaceRow, type SurfaceMember } from "@/lib/modules/legal-core/search-surface";
import { matchSystemsInText, normalizeSystemName, type SystemRef } from "@/lib/modules/agents/substrate/systems-registry";
import { matchNameToRegistry } from "@/lib/modules/agents/thinking/resolve-scope";
import { parseArticleQuery } from "@/lib/modules/legal-search/query-parse";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

type Art = { id: string; legalSystemId: string; lawName: string; articleNumber: number; status: string; content: string };
const path = process.argv[2] ?? "ingest/search-surface-2026-09-28/tests/staging_snapshot.json";
const snap = JSON.parse(readFileSync(path, "utf8")) as { registry: SystemRef[]; rows: SurfaceRow[]; members: SurfaceMember[]; articles: Art[] };
const REG = snap.registry;
const byName = new Map(REG.map((r) => [r.name, r.id]));
const nameOf = new Map(REG.map((r) => [r.id, r.name]));
const id = (n: string) => {
  const v = byName.get(n);
  if (!v) throw new Error(`missing ${n}`);
  return v;
};

let pass = 0;
let fail = 0;
const results: Array<{ name: string; ok: boolean; got: string }> = [];
function check(name: string, ok: boolean, got: unknown) {
  const g = typeof got === "string" ? got : JSON.stringify(got);
  results.push({ name, ok, got: g });
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "✔" : "✘"} ${name} → ${g}`);
}

// مسار «المادة {رقم} {نظام}» كما في findExactArticleMatch بعد الموجة ١.
function exactArticle(q: string, asOf: string): Art | null {
  const parsed = parseArticleQuery(q);
  if (!parsed) return null;
  const core = normalizeSystemName(parsed.systemHint);
  const exact = REG.filter((r) => normalizeSystemName(r.name) === core);
  const refs = exact.length ? exact : matchSystemsInText(parsed.systemHint, REG);
  const surface = computeSurface(snap.rows, snap.members, asOf);
  for (const sid of mapToSurface(refs.map((r) => r.id), surface)) {
    const a = snap.articles.find((x) => x.legalSystemId === sid && x.articleNumber === parsed.articleNumber);
    if (a) return a;
  }
  return null;
}
// نطاق «اسأل حكيم»: الأنظمة المذكورة في السؤال بعد الوجه.
function scope(q: string, asOf = "2026-09-28"): string[] {
  const surface = computeSurface(snap.rows, snap.members, asOf);
  return mapToSurface(matchSystemsInText(q, REG).map((r) => r.id), surface).map((x) => nameOf.get(x) ?? x);
}

const EXE_OLD = "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ";
const EXE_NEW = "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ";
const CR_NEW = "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ";
const TN_NEW = "نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ";

// ① «المادة 1 من نظام التنفيذ»
for (const [asOf, want] of [["2026-09-28", EXE_OLD], ["2026-10-27", EXE_OLD], ["2026-10-28", EXE_NEW]] as const) {
  const a = exactArticle("المادة 1 من نظام التنفيذ", asOf);
  check(`«المادة 1 من نظام التنفيذ» في ${asOf} = ${want.includes("237") ? "م/237" : "م/53"}`, a?.legalSystemId === id(want), a?.lawName ?? null);
}
// ② «نظام السجل التجاري» → م/83 لا م/1 ولا المخلوط
check("«نظام السجل التجاري» = م/83 وحده", JSON.stringify(scope("ما شروط القيد في نظام السجل التجاري")) === JSON.stringify([CR_NEW]), scope("ما شروط القيد في نظام السجل التجاري"));
check("«المادة 3 من نظام السجل التجاري» = م/83", exactArticle("المادة 3 من نظام السجل التجاري", "2026-09-28")?.legalSystemId === id(CR_NEW), exactArticle("المادة 3 من نظام السجل التجاري", "2026-09-28")?.lawName);
check("«نظام الأسماء التجارية» = م/83 وحده", JSON.stringify(scope("نظام الأسماء التجارية")) === JSON.stringify([TN_NEW]), scope("نظام الأسماء التجارية"));
// ③ «الزراعة العضوية» لا تُقصر على نظام الزراعة
check("«الزراعة العضوية» → نظام الزراعة العضوية لا نظام الزراعة", JSON.stringify(scope("اشتراطات الزراعة العضوية")) === JSON.stringify(["نظام الزراعة العضوية"]), scope("اشتراطات الزراعة العضوية"));
// ④ «نظام التنفيذ أمام ديوان المظالم»
check("«نظام التنفيذ أمام ديوان المظالم» لا يُقصر على نظام التنفيذ", JSON.stringify(scope("ما حكم المادة 5 من نظام التنفيذ أمام ديوان المظالم")) === JSON.stringify(["نظام التنفيذ أمام ديوان المظالم"]), scope("ما حكم المادة 5 من نظام التنفيذ أمام ديوان المظالم"));
check("«المادة 1 من نظام التنفيذ أمام ديوان المظالم» من نظامه", exactArticle("المادة 1 من نظام التنفيذ أمام ديوان المظالم", "2026-09-28")?.lawName === "نظام التنفيذ أمام ديوان المظالم", exactArticle("المادة 1 من نظام التنفيذ أمام ديوان المظالم", "2026-09-28")?.lawName);
// ⑤ مادة ملغاة من الاثني عشر لا تتصدّر وجه الساري: كل مرشّحي «الاستثمار» بعد الوجه من أنظمة ظاهرة.
{
  const surface = computeSurface(snap.rows, snap.members, "2026-09-28");
  const hits = snap.articles.filter((a) => normalizeArabicText(a.content).includes(normalizeArabicText("الاستثمار")));
  const visible = hits.filter((a) => inSurface(a, surface));
  const leakedRepealed = visible.filter((a) => a.status === "ملغاة");
  check(`«الاستثمار»: ${hits.length} مرشحًا قبل الوجه، ${visible.length} بعده، ملغاة ظاهرة = 0`, leakedRepealed.length === 0 && visible.length > 0 && hits.length > visible.length, { before: hits.length, after: visible.length, repealedVisible: leakedRepealed.length });
  const twelveHidden = [...surface.hidden].filter((h) => snap.articles.some((a) => a.legalSystemId === h && a.status === "ملغاة")).length;
  check("الاثنا عشر كلها خارج وجه الساري", twelveHidden === 12, twelveHidden);
  check("المخلوط الثلاثة خارج الوجه", ["نظام التنفيذ", "نظام السجل التجاري", "نظام الأسماء التجارية"].every((n) => surface.hidden.has(id(n))), [...surface.hidden].length);
  const s28 = computeSurface(snap.rows, snap.members, "2026-10-28");
  check("في 2026-10-28: م/53 مخفي وم/237 ظاهر، والسجل والأسماء كما هما",
    s28.hidden.has(id(EXE_OLD)) && !s28.hidden.has(id(EXE_NEW)) && !s28.hidden.has(id(CR_NEW)) && !s28.hidden.has(id(TN_NEW)), { oldHidden: s28.hidden.has(id(EXE_OLD)), newHidden: s28.hidden.has(id(EXE_NEW)) });
  check("في 2026-09-28: م/237 (صادر لم يسرِ) مخفي", surface.hidden.has(id(EXE_NEW)), surface.hidden.has(id(EXE_NEW)));
}
// الأزواج العشرون: الأطول لا يُقصر على الأقصر، والأقصر لا يجرّ الأطول.
const PAIRS: Array<[string, string]> = [
  ["نظام العمل", "نظام العمل التطوعي"], ["نظام البريد", "نظام البريد 1406هـ"], ["نظام الإحصاء", "نظام الإحصاءات العامة للدولة"],
  ["نظام الإيداع", "نظام الإيداع في المخازن العامة"], ["نظام التنفيذ", "نظام التنفيذ أمام ديوان المظالم"], ["نظام الزراعة", "نظام الزراعة العضوية"],
  ["نظام الشركات", "نظام الشركات المهنية"], ["نظام المناطق", "نظام المناطق البحرية للمملكة العربية السعودية"], ["نظام الاستثمار", "نظام الاستثمار الأجنبي"],
  ["نظام إدارة النفايات", "نظام إدارة النفايات البلدية الصلبة"], ["نظام الغرف التجارية", "نظام الغرف التجارية والصناعية"],
  ["تنظيم إعانة البحث عن عمل", "تنظيم إعانة البحث عن عمل 1432هـ"], ["نظام التسجيل العيني للعقار", "نظام التسجيل العيني للعقار 1423هـ"],
  ["نظام صندوق التنمية العقارية", "نظام صندوق التنمية العقارية1394هـ"], ["تنظيم وكالة الأنباء السعودية", "تنظيم وكالة الأنباء السعودية1433هـ"],
  ["تعليمات الحسابات الاستثمارية", "تعليمات الحسابات الاستثمارية المعدلة"],
  ["نظام إدارة المواد الكيميائية", "نظام استيراد المواد الكيميائية وإدارتها (نظام إدارة المواد الكيميائية)"],
  ["نظام تملك غير السعوديين للعقار", "نظام تملك غير السعوديين للعقار واستثماره"], ["نظام ملكية الوحدات العقارية وفرزها", "نظام ملكية الوحدات العقارية وفرزها وإدارتها"],
  ["الضوابط والمتطلبات والمواصفات الفنية والقواعد الإجرائية اللازمة لتنفيذ أحكام لائحة الفوترة الإلكترونية",
   "الضوابط والمتطلبات والمواصفات الفنية والقواعد الإجرائية اللازمة لتنفيذ أحكام لائحة الفوترة الإلكترونية - قرار محافظ الهيئة رقم (62738) وتاريخ 23/11/1443هـ"],
];
let pairOk = 0;
for (const [shortN, longN] of PAIRS) {
  const longHits = matchSystemsInText(`سؤال عن ${longN}`, REG).map((r) => r.name);
  const shortHits = matchSystemsInText(`سؤال عن ${shortN}`, REG).map((r) => r.name);
  const nameLong = matchNameToRegistry(longN, REG).map((r) => r.name);
  const nameShort = matchNameToRegistry(shortN, REG).map((r) => r.name);
  const ok =
    longHits.includes(longN) && !longHits.includes(shortN) &&
    shortHits.includes(shortN) && !shortHits.includes(longN) &&
    nameLong.includes(longN) && !nameLong.includes(shortN) &&
    nameShort.includes(shortN) && !nameShort.includes(longN);
  if (ok) pairOk += 1;
  else console.log("  pair fail:", { shortN, longN, longHits, shortHits, nameLong, nameShort });
}
check(`الأزواج العشرون مميَّزة (سؤال + اسم النموذج)`, pairOk === PAIRS.length, `${pairOk}/${PAIRS.length}`);
// اللائحة التنفيذية تابعة: لا تبتلع النظام ولا يبتلعها اسم أقصر.
check("«اللائحة التنفيذية لنظام العمل» لا يبتلعها «نظام العمل»", JSON.stringify(matchSystemsInText("ما تقول اللائحة التنفيذية لنظام العمل", REG).map((r) => r.name)) === JSON.stringify(["اللائحة التنفيذية لنظام العمل"]), matchSystemsInText("ما تقول اللائحة التنفيذية لنظام العمل", REG).map((r) => r.name));
check("«نظام العمل» لا تجرّ لائحته", JSON.stringify(matchSystemsInText("إنهاء العقد في نظام العمل", REG).map((r) => r.name)) === JSON.stringify(["نظام العمل"]), matchSystemsInText("إنهاء العقد في نظام العمل", REG).map((r) => r.name));
check("اسم غير موجود → لا مطابقة", matchNameToRegistry("قانون المريخ", REG).length === 0, matchNameToRegistry("قانون المريخ", REG).length);
check("اسم بلا بادئة يساوي بعد التطبيع: «المعاملات المدنية» ⇄ «نظام المعاملات المدنية»", matchNameToRegistry("المعاملات المدنية", REG).map((r) => r.name).join() === "نظام المعاملات المدنية", matchNameToRegistry("المعاملات المدنية", REG).map((r) => r.name));

console.log(`\n${pass} ✔ / ${fail} ✘`);
if (process.env.SURFACE_TEST_JSON) {
  writeFileSync(process.env.SURFACE_TEST_JSON, JSON.stringify({ pass, fail, results }, null, 1));
}
process.exit(fail ? 1 : 0);
