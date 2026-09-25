/**
 * التحقق بعد إصلاح ترقيم نظام المعاملات المدنية (MADANI-RENUM-001).
 *
 * الفحص الحاسم: يقارن رقم كل مادة بالعدد الترتيبي في عنوانها الرسمي — وهما
 * حقلان مستقلّا المصدر. نجاحه يعني أن الترقيم صار مطابقًا للنصّ الرسميّ،
 * وهو ما لا يُثبته عدّ المواد ولا قيد التفرّد.
 *
 * التشغيل: npx tsx scripts/audit/verify-civil-renumber.ts
 * يخرج برمز 1 عند أي إخفاق — صالح لبوابة CI.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { parseArabicOrdinal, normalizeArabic } from "../../lib/modules/legal-core/arabic-ordinal";

const LAW = "نظام المعاملات المدنية";
const EXPECTED = 721;

async function main() {
  const prisma = new PrismaClient();
  const fail: string[] = [];
  const warn: string[] = [];
  try {
    const rows = await prisma.legalArticle.findMany({
      where: { lawName: LAW, articleNumber: { gt: 0 } },
      select: { id: true, articleNumber: true, title: true, content: true },
      orderBy: { articleNumber: "asc" },
    });

    console.log(`${LAW}: ${rows.length} مادة (المتوقع ${EXPECTED})`);
    if (rows.length !== EXPECTED) fail.push(`العدد ${rows.length} ≠ ${EXPECTED}`);

    // ① الرقم مقابل العنوان الترتيبي — الفحص الجوهري
    let unparsed = 0;
    for (const r of rows) {
      const parsed = parseArabicOrdinal(r.title ?? "");
      if (parsed === null) { unparsed++; warn.push(`م(${r.articleNumber}) عنوان غير قابل للتحليل: «${String(r.title).slice(0, 45)}»`); continue; }
      if (parsed !== r.articleNumber) fail.push(`م(${r.articleNumber}) عنوانها يدل على ${parsed} — إزاحة ${parsed - r.articleNumber}`);
    }

    // ② فجوات وتكرار الأرقام
    const nums = new Set(rows.map((r) => r.articleNumber));
    for (let i = 1; i <= EXPECTED; i++) if (!nums.has(i)) fail.push(`المادة ${i} مفقودة`);
    if (nums.has(EXPECTED + 1)) fail.push(`توجد مادة ${EXPECTED + 1} — زائدة`);

    // ③ تكرار النصوص
    const byHash = new Map<string, number[]>();
    for (const r of rows) {
      const t = String(r.content ?? "").trim();
      if (!t) { fail.push(`م(${r.articleNumber}) نصّها فارغ`); continue; }
      const h = crypto.createHash("sha256").update(normalizeArabic(t)).digest("hex");
      byHash.set(h, [...(byHash.get(h) ?? []), r.articleNumber]);
    }
    for (const [, ns] of byHash) if (ns.length > 1) fail.push(`نصّ مكرر في المواد: ${ns.join(", ")}`);

    // ④ مراسي المواصفة
    const at = (n: number) => rows.find((r) => r.articleNumber === n)?.content ?? "";
    const anchors: Array<[number, string, string]> = [
      [236, "إذا تعدد المدينون", "تعدد المدينين في التزام غير قابل للانقسام"],
      [237, "إذا تعدد الدائنون", "تعدد الدائنين — المادة المُستعادة"],
      [238, "للدائن أن يحيل حقه", "حوالة الحق"],
      [466, "إذا أخل المقاول", "إعذار المقاول وطلب الفسخ"],
      [469, "يلتزم صاحب العمل بالوفاء بالأجر", "أجر الأجزاء المنجزة"],
      [475, "ينتهي عقد المقاولة", "انتهاء المقاولة بإنجاز العمل"],
      [721, "يُعمل بهذا النظام", "مادة النفاذ"],
    ];
    // بعض المواد الرسمية تبدأ ببندٍ مرقّم («١- …»)؛ نُسقط بادئة الترقيم قبل فحص المرساة.
    const stripLead = (s: string) => s.trim().replace(/^[\u0660-\u0669\d]+\s*[-.)ـ]\s*/, "").trim();
    for (const [n, head, label] of anchors) {
      if (!stripLead(at(n)).startsWith(head)) fail.push(`المرساة م(${n}) [${label}] لا تبدأ بـ«${head}»`);
    }

    // ⑤ مراجع مخزَّنة بأرقام مُفكَّكة
    const stale = await prisma.consultationCitation.count({
      where: { lawName: LAW },
    }).catch(() => -1);
    if (stale >= 0) console.log(`استشهادات الاستشارات لهذا النظام: ${stale}`);

    if (warn.length) { console.log(`\n⚠️  تنبيهات (${warn.length}):`); warn.slice(0, 10).forEach((w) => console.log("   " + w)); }
    if (fail.length) {
      console.error(`\n❌ أخفق التحقق — ${fail.length} إخفاق:`);
      fail.slice(0, 30).forEach((f) => console.error("   " + f));
      if (fail.length > 30) console.error(`   … و${fail.length - 30} إخفاقًا آخر`);
      process.exit(1);
    }
    console.log(`\n✓ نجح التحقق: ${EXPECTED} مادة، كل رقم يطابق عنوانه الترتيبي، بلا فجوة ولا تكرار.`);
    if (unparsed) console.log(`  (${unparsed} عنوانًا تعذّر تحليله — راجع التنبيهات)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
