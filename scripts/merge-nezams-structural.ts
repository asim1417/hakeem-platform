/**
 * merge-nezams-structural.ts — يدمج الطبقة البنيوية (0.9) من nezams في الرسم القائم.
 *
 * nezams يزاوج كل مادة نظام N ببنود لائحتها «N/m». عناوين لائحتنا (المصدر الرسمي) تحمل نفس
 * البنود بترتيب معكوس «m/N» — تطابق حتمي مُتحقَّق من البيانات. فنُنشئ علاقة IMPLEMENTS بنيوية
 * (0.9، STRUCTURAL، verifiedBy=nezams) من عقدة اللائحة إلى عقدة مادة النظام. الصريحة (0.98) ترجّح.
 *
 * وضعان: بلا CONFIRM ⇒ جاف. مع CONFIRM=NEON_RUNTIME_CONFIRMED ⇒ كتابة. idempotent (لا يخفض ثقة قائمة).
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const confirmed = process.env.CONFIRM_RUNTIME_DB_ALIGNMENT === "NEON_RUNTIME_CONFIRMED";

// خريطة صفحة nezams → (اسم النظام، اسم اللائحة) في قاعدتنا. match = جزء مميّز مُطبَّع.
const LAW_MAP: Array<{ match: string; systemLaw: string; bylawLaw: string }> = [
  { match: "مرافعات", systemLaw: "نظام المرافعات الشرعية", bylawLaw: "اللوائح التنفيذية لنظام المرافعات الشرعية" },
  { match: "اجراءات الجزائيه", systemLaw: "نظام الإجراءات الجزائية", bylawLaw: "اللائحة التنفيذية لنظام الإجراءات الجزائية" },
];

// تطبيع عربي للمطابقة المرنة لاسم الصفحة (تجريد الهمزات/التطويل، ة→ه، ى→ي).
const normAr = (s: string) => (s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه");

const EN2AR: Record<string, string> = { "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤", "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩" };
const toArabic = (s: string | number) => String(s).replace(/[0-9]/g, (d) => EN2AR[d]);
const normLabel = (s: string) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/\s+/g, "");

type Page = { law: string; url: string; pairings: Array<{ sysNum: number; bylawLabels: string[]; explicitRefs: number[] }> };

async function main() {
  console.log("═".repeat(96));
  console.log(`دمج الطبقة البنيوية من nezams — الوضع: ${confirmed ? "كتابة (مؤكَّد)" : "جاف (قراءة فقط)"}`);
  console.log("═".repeat(96));

  const pages = JSON.parse(readFileSync("data/nezams_pairings.json", "utf8")) as Page[];
  let totalEdges = 0, totalMissingBylaw = 0, totalMissingNode = 0, written = 0, skippedExplicit = 0;

  for (const page of pages) {
    const cfg = LAW_MAP.find((m) => normAr(page.law).includes(normAr(m.match)));
    if (!cfg) { console.log(`⚠ لا خريطة لصفحة «${page.law}» — تخطّي.`); continue; }
    console.log(`\n▮ ${page.law} → نظام=«${cfg.systemLaw}» · لائحة=«${cfg.bylawLaw}»`);

    // خريطة عنوان اللائحة «m/N» → رقم المادة (لتحديد عقدة اللائحة)
    const arts = await prisma.legalArticle.findMany({ where: { lawName: cfg.bylawLaw }, select: { articleNumber: true, title: true } });
    const titleToNum = new Map<string, number>();
    for (const a of arts) titleToNum.set(normLabel(a.title), a.articleNumber);

    // عُقد موجودة (للتأكد قبل إنشاء العلاقة)
    const nodes = await prisma.legalGraphNode.findMany({ where: { law: { in: [cfg.systemLaw, cfg.bylawLaw] } }, select: { id: true } });
    const nodeIds = new Set(nodes.map((n) => n.id));

    // إزالة تكرار مواد النظام
    const bySys = new Map<number, string[]>();
    for (const p of page.pairings) if (!bySys.has(p.sysNum) || p.bylawLabels.length) bySys.set(p.sysNum, p.bylawLabels);

    const edges: Array<{ sourceId: string; targetId: string; evidence: string }> = [];
    for (const [sysNum, labels] of bySys) {
      const sysNodeId = `SYSART::${cfg.systemLaw}::${sysNum}`;
      if (!nodeIds.has(sysNodeId)) { totalMissingNode++; continue; }
      for (const label of labels) {
        const [n, m] = normLabel(label).split("/"); // nezams «N/m»
        if (!n || !m) continue;
        // نجرّب الاتجاهين: «m/N» (معكوس كالمرافعات) و«N/m» (نفس الترتيب) — أيُّهما طابق عنوان لائحتنا.
        const bylawArtNum = titleToNum.get(normLabel(`${toArabic(m)}/${toArabic(n)}`)) ?? titleToNum.get(normLabel(`${toArabic(n)}/${toArabic(m)}`));
        if (bylawArtNum == null) { totalMissingBylaw++; continue; }
        const bylawNodeId = `BYLAW::${cfg.bylawLaw}::${bylawArtNum}`;
        if (!nodeIds.has(bylawNodeId)) { totalMissingNode++; continue; }
        edges.push({ sourceId: bylawNodeId, targetId: sysNodeId, evidence: `مزاوجة nezams: بند ${label}` });
      }
    }
    // إزالة تكرار الحواف
    const uniq = new Map<string, (typeof edges)[number]>();
    for (const e of edges) uniq.set(`${e.sourceId}|${e.targetId}`, e);
    const list = [...uniq.values()];
    totalEdges += list.length;
    // تغطية الطبقة الصريحة القائمة لهذا النظام (لبيان أن اللوائح غير المُزاوَجة بنيويًّا مربوطة صريحًا)
    const explicitCount = await prisma.legalGraphEdge.count({ where: { type: "IMPLEMENTS", source: "EXPLICIT", targetNode: { law: cfg.systemLaw } } });
    console.log(`   بنود مُزاوَجة صالحة (بنيوي 0.9): ${list.length} · لائحة غير مُطابَقة=${totalMissingBylaw} · عُقد ناقصة=${totalMissingNode}`);
    console.log(`   علاقات صريحة قائمة (0.98) إلى «${cfg.systemLaw}»: ${explicitCount}`);
    if (list.length < 5 && explicitCount > 0) console.log(`   ℹ لائحة هذا النظام غير مُرقَّمة «N/m» — العلاقة مُغطّاة بالطبقة الصريحة أعلاه (سلوك صحيح).`);
    console.log("   عيّنة بنيوية:");
    for (const e of list.slice(0, 5)) console.log(`     ${e.sourceId}  ──IMPLEMENTS(0.9,STRUCTURAL)──▶  ${e.targetId}  [${e.evidence}]`);

    if (!confirmed) continue;
    for (const e of list) {
      const existing = await prisma.legalGraphEdge.findUnique({ where: { sourceId_targetId_type: { sourceId: e.sourceId, targetId: e.targetId, type: "IMPLEMENTS" } }, select: { confidence: true } });
      if (existing && existing.confidence >= 0.9) { skippedExplicit++; continue; } // لا نخفض الصريحة
      await prisma.legalGraphEdge.upsert({
        where: { sourceId_targetId_type: { sourceId: e.sourceId, targetId: e.targetId, type: "IMPLEMENTS" } },
        update: { confidence: 0.9, source: "STRUCTURAL", evidence: e.evidence, verifiedBy: "nezams" },
        create: { sourceId: e.sourceId, targetId: e.targetId, type: "IMPLEMENTS", confidence: 0.9, source: "STRUCTURAL", evidence: e.evidence, verifiedBy: "nezams" },
      });
      written++;
    }
  }

  console.log("\n" + "─".repeat(96));
  console.log(`إجمالي علاقات بنيوية مرشّحة: ${totalEdges}`);
  if (confirmed) {
    console.log(`مكتوبة (جديدة/محدّثة): ${written} · مُتخطّاة (صريحة قائمة أقوى): ${skippedExplicit}`);
    const [nc, ec] = await Promise.all([prisma.legalGraphNode.count(), prisma.legalGraphEdge.count()]);
    const bySource = await prisma.legalGraphEdge.groupBy({ by: ["source"], _count: true });
    console.log(`الرسم الآن — عُقد=${nc} · علاقات=${ec} · حسب المصدر: ${bySource.map((s) => `${s.source}=${s._count}`).join(" · ")}`);
  } else {
    console.log("(وضع جاف — لم يُكتب شيء. CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED للتنفيذ.)");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗ فشل merge-nezams:", e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
