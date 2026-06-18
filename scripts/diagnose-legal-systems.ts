/**
 * diagnose-legal-systems.ts — تشخيص قرائي لقاعدة الأنظمة والبحث (لا كتابة).
 *
 * يجيب على: لماذا تظهر أنظمة معيّنة دورياً ولا تظهر أخرى في البحث؟
 *
 * يقيس:
 *  1) توزيع المواد على الأنظمة (lawName): أكبر/أصغر الأنظمة، وأنظمة legal_systems بلا مواد.
 *  2) تغطية التضمين (embedding) على المواد.
 *  3) تشظّي أسماء الأنظمة (نفس النظام بصيَغ/مسافات مختلفة).
 *  4) «تمثيل البحث»: يشغّل استعلامات شائعة عبر searchLegalCore ويقيس كم نظاماً متمايزاً
 *     يظهر فعلاً، وأيّ أنظمة تهيمن — لكشف انحياز الاسترجاع.
 *
 * التشغيل (قراءة فقط): npm run diagnose:systems
 */
import { prisma } from "@/lib/prisma";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { searchLegalCore } from "@/lib/modules/legal-core/legal-retrieval";

// مصطلحات تشخيصية تغطّي مجالات قانونية متنوّعة (لقياس تنوّع الأنظمة الظاهرة).
const PROBE_TERMS = [
  "عقد", "العمل", "الأجرة", "الطلاق", "النفقة", "الميراث", "الشركة", "المرور",
  "العقار", "الإيجار", "التنفيذ", "الغبن", "التحكيم", "الجريمة", "الضريبة",
  "الملكية الفكرية", "الإفلاس", "التأمين", "الوكالة", "الرهن",
];

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";
}

async function section1_distribution() {
  console.log("\n" + "=".repeat(64));
  console.log("① توزيع المواد على الأنظمة");
  console.log("=".repeat(64));

  const systemCount = await prisma.legalSystem.count().catch(() => 0);
  const articleCount = await prisma.legalArticle.count().catch(() => 0);
  console.log(`legal_systems = ${systemCount.toLocaleString("en-US")} | legal_articles = ${articleCount.toLocaleString("en-US")}`);

  // التوزيع حسب lawName (هو ما يستعمله البحث فعلاً).
  const byLaw = await prisma.legalArticle
    .groupBy({ by: ["lawName"], _count: { _all: true } })
    .catch(() => [] as Array<{ lawName: string; _count: { _all: number } }>);
  const sorted = byLaw.map((g) => ({ lawName: g.lawName, count: g._count._all })).sort((a, b) => b.count - a.count);

  console.log(`\nأسماء أنظمة متمايزة في legal_articles (lawName): ${sorted.length.toLocaleString("en-US")}`);
  console.log("\nأكبر 15 نظاماً (قد تهيمن على نتائج البحث):");
  sorted.slice(0, 15).forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.count.toString().padStart(5)} مادة | ${s.lawName.slice(0, 60)}`));

  const small = sorted.filter((s) => s.count <= 3);
  console.log(`\nأنظمة بـ ≤3 مواد (قد لا تظهر في البحث): ${small.length}`);
  console.log(`أنظمة بمادة واحدة فقط: ${sorted.filter((s) => s.count === 1).length}`);

  // أنظمة legal_systems بلا أي مواد مرتبطة (عبر legalSystemId).
  try {
    const linkedIds = await prisma.legalArticle.findMany({
      where: { legalSystemId: { not: null } },
      distinct: ["legalSystemId"],
      select: { legalSystemId: true },
    });
    const linked = new Set(linkedIds.map((x) => x.legalSystemId));
    const orphanSystems = systemCount - linked.size;
    console.log(`\nأنظمة legal_systems مرتبطة بمواد (عبر legalSystemId): ${linked.size} من ${systemCount}`);
    console.log(`أنظمة بلا مواد مرتبطة بالـid: ${orphanSystems} (قد تكون المواد مرتبطة بالاسم lawName فقط)`);
  } catch {
    console.log("تعذّر حساب الأنظمة اليتيمة.");
  }

  // كم مادة بلا legalSystemId (مرتبطة بالاسم فقط)؟ مؤشّر تشظٍّ.
  const noSystemId = await prisma.legalArticle.count({ where: { legalSystemId: null } }).catch(() => 0);
  console.log(`مواد بلا legalSystemId (تعتمد lawName فقط): ${noSystemId.toLocaleString("en-US")} (${pct(noSystemId, articleCount)})`);

  return { systemCount, articleCount, distinctLawNames: sorted.length, topSystems: sorted.slice(0, 15) };
}

async function section2_embeddings(articleCount: number) {
  console.log("\n" + "=".repeat(64));
  console.log("② تغطية التضمين (embedding)");
  console.log("=".repeat(64));
  try {
    const withEmb = await prisma.legalArticle.count({ where: { embedding: { not: null as never } } }).catch(async () => {
      // Json null filter آمن
      const { Prisma } = await import("@prisma/client");
      return prisma.legalArticle.count({ where: { embedding: { not: Prisma.AnyNull } } });
    });
    console.log(`مواد لها embedding: ${withEmb.toLocaleString("en-US")} من ${articleCount.toLocaleString("en-US")} (${pct(withEmb, articleCount)})`);
    if (withEmb < articleCount) console.log("⚠ تغطية ناقصة ⇒ بعض المواد لا تُسترجَع دلالياً.");
  } catch (e) {
    console.log("تعذّر قياس التضمين:", e instanceof Error ? e.message.split("\n")[0] : e);
  }
}

async function section3_fragmentation() {
  console.log("\n" + "=".repeat(64));
  console.log("③ تشظّي أسماء الأنظمة (نفس النظام بصيَغ مختلفة)");
  console.log("=".repeat(64));
  const byLaw = await prisma.legalArticle
    .groupBy({ by: ["lawName"], _count: { _all: true } })
    .catch(() => [] as Array<{ lawName: string; _count: { _all: number } }>);
  const groups = new Map<string, Array<{ lawName: string; count: number }>>();
  for (const g of byLaw) {
    const key = normalizeArabicText((g.lawName || "").replace(/\s+/g, " ").trim());
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ lawName: g.lawName, count: g._count._all });
  }
  const fragmented = [...groups.values()].filter((v) => v.length > 1);
  console.log(`مجموعات أسماء مكرّرة/متشظّية: ${fragmented.length}`);
  fragmented.slice(0, 10).forEach((variants, i) => {
    console.log(`  ${i + 1}. ${variants.map((v) => `«${v.lawName.slice(0, 40)}» (${v.count})`).join("  ≈  ")}`);
  });
  if (fragmented.length) console.log("⚠ التشظّي يفرّق مواد النظام الواحد ⇒ يضعف ترتيبه ويشتّت النتائج.");
}

async function section4_searchRepresentation(distinctLawNames: number) {
  console.log("\n" + "=".repeat(64));
  console.log("④ تمثيل البحث — أيّ أنظمة تظهر فعلاً؟ (انحياز الاسترجاع)");
  console.log("=".repeat(64));
  const appearanceCount = new Map<string, number>(); // نظام → كم استعلاماً ظهر فيه
  const slotCount = new Map<string, number>(); // نظام → مجموع المواضع في كل النتائج

  for (const term of PROBE_TERMS) {
    try {
      const res = await searchLegalCore({ query: term, limit: 20, searchType: "derivatives" });
      const systemsInTop = new Set<string>();
      for (const r of res.results) {
        slotCount.set(r.systemName, (slotCount.get(r.systemName) ?? 0) + 1);
        systemsInTop.add(r.systemName);
      }
      for (const s of systemsInTop) appearanceCount.set(s, (appearanceCount.get(s) ?? 0) + 1);
      const top = res.results[0]?.systemName ?? "—";
      console.log(`  «${term}» → ${res.total} نتيجة | أنظمة متمايزة بأعلى ٢٠: ${systemsInTop.size} | الأعلى: ${top.slice(0, 40)}`);
    } catch (e) {
      console.log(`  «${term}» → خطأ: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    }
  }

  const distinctAppearing = appearanceCount.size;
  console.log(`\nأنظمة ظهرت في أيّ نتيجة عبر ${PROBE_TERMS.length} استعلاماً: ${distinctAppearing} من ${distinctLawNames} (${pct(distinctAppearing, distinctLawNames)})`);
  const dominators = [...slotCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("\nأكثر الأنظمة هيمنةً على مواضع النتائج (مؤشّر الانحياز):");
  dominators.forEach(([name, c], i) => console.log(`  ${String(i + 1).padStart(2)}. ${c.toString().padStart(4)} موضعاً | ${name.slice(0, 50)}`));

  if (distinctLawNames > 50 && distinctAppearing < distinctLawNames * 0.25) {
    console.log("\n🔴 انحياز قوي: أقل من ٢٥٪ من الأنظمة تظهر — يطابق فرضية الاقتطاع الأبجدي للمرشّحين (CANDIDATE_CAP + orderBy lawName asc).");
  } else if (distinctLawNames > 50) {
    console.log("\n🟡 تنوّع متوسط — راجع الأنظمة المهيمنة أعلاه.");
  }
}

async function main() {
  console.log("🔎 تشخيص قاعدة الأنظمة والبحث — قراءة فقط");
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL || "").hostname;
    } catch {
      return "unknown";
    }
  })();
  console.log(`الهدف (بصمة المضيف): ${host}`);
  if (/supabase/i.test(host)) {
    console.log("⚠ الهدف يبدو Supabase (قاعدة الأتمتة الأصغر) لا Neon — للحصول على صورة الإنتاج الحقيقية وجّه NEON_DATABASE_URL/الاتصال إلى Neon.");
  }

  const dist = await section1_distribution();
  await section2_embeddings(dist.articleCount);
  await section3_fragmentation();
  await section4_searchRepresentation(dist.distinctLawNames);

  console.log("\n" + "=".repeat(64));
  console.log("انتهى التشخيص (لم تُكتب أي بيانات).");
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
