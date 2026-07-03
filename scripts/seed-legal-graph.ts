/**
 * seed-legal-graph.ts — يبني الرسم القانوني رباعي الطبقات من بيانات القاعدة الرسمية:
 *   عُقد SYSTEM_ARTICLE للأنظمة الأساسية، وعُقد BYLAW_ARTICLE/CONTROL/PROCEDURE للأدوات المرتبطة،
 *   وعلاقات صريحة (EXPLICIT، 0.98) عبر محلّل «المادة (كذا) من النظام».
 *
 * الطبقة البنيوية (STRUCTURAL، 0.9) محفوظة لدمج nezams لاحقًا (لا تُلفَّق محاذاة رقمية).
 * idempotent: عُقد createMany({skipDuplicates})، علاقات upsert على (source,target,type) — الأعلى ثقة يرجّح.
 * وضعان: بلا CONFIRM ⇒ جاف (إحصاء + عيّنة، بلا كتابة). مع CONFIRM=NEON_RUNTIME_CONFIRMED ⇒ كتابة.
 */
import { prisma } from "@/lib/prisma";
import { extractSystemRefs } from "@/lib/legal-graph/reference-parser";

type NodeType = "SYSTEM_ARTICLE" | "BYLAW_ARTICLE" | "CONTROL" | "PROCEDURE";
type RelType = "IMPLEMENTS" | "GOVERNED_BY" | "PROCEDURE_FOR";

const confirmed = process.env.CONFIRM_RUNTIME_DB_ALIGNMENT === "NEON_RUNTIME_CONFIRMED";

const CORE_SYSTEMS = [
  "نظام المعاملات المدنية", "نظام المرافعات الشرعية", "نظام الإثبات", "نظام الأحوال الشخصية",
  "نظام الإجراءات الجزائية", "نظام الشركات", "نظام المحاكم التجارية", "نظام العمل",
  "نظام الإفلاس", "نظام التوثيق", "نظام التحكيم",
];

// الأدوات المرتبطة (لوائح/ضوابط/أدلة) وأنظمتها الأمّ — أسماء مطابِقة لِ lawName في القاعدة.
const INSTRUMENTS: Array<{ law: string; type: NodeType; parent: string }> = [
  { law: "اللائحة التنفيذية لنظام المحاكم التجارية", type: "BYLAW_ARTICLE", parent: "نظام المحاكم التجارية" },
  { law: "اللوائح التنفيذية لنظام المرافعات الشرعية", type: "BYLAW_ARTICLE", parent: "نظام المرافعات الشرعية" },
  { law: "لائحة نظام الأحوال الشخصية", type: "BYLAW_ARTICLE", parent: "نظام الأحوال الشخصية" },
  { law: "اللائحة التنفيذية لنظام التوثيق", type: "BYLAW_ARTICLE", parent: "نظام التوثيق" },
  { law: "اللائحة التنفيذية لنظام الإجراءات الجزائية", type: "BYLAW_ARTICLE", parent: "نظام الإجراءات الجزائية" },
  { law: "اللائحة التنفيذية لنظام الإفلاس", type: "BYLAW_ARTICLE", parent: "نظام الإفلاس" },
  { law: "اللائحة التنفيذية لنظام التحكيم", type: "BYLAW_ARTICLE", parent: "نظام التحكيم" },
  { law: "لائحة قسمة الأموال المشتركة", type: "BYLAW_ARTICLE", parent: "نظام المرافعات الشرعية" },
  { law: "اللائحة التنفيذية لإجراءات الاستئناف", type: "BYLAW_ARTICLE", parent: "نظام المرافعات الشرعية" },
  { law: "اللائحة التنفيذية لطرق الاعتراض على الأحكام", type: "BYLAW_ARTICLE", parent: "نظام المرافعات الشرعية" },
  { law: "ضوابط إجراءات الإثبات إلكترونياً", type: "CONTROL", parent: "نظام الإثبات" },
  { law: "الأدلة الإجرائية لنظام الإثبات", type: "PROCEDURE", parent: "نظام الإثبات" },
  { law: "القواعد الخاصة بتنظيم شؤون الخبرة أمام المحاكم", type: "CONTROL", parent: "نظام الإثبات" },
  { law: "لائحة التقارير الطبية", type: "BYLAW_ARTICLE", parent: "نظام الأحوال الشخصية" },
  { law: "آلية الاستعانة بمحام على نفقة الدولة للمتهم في الجرائم الكبيرة", type: "PROCEDURE", parent: "نظام الإجراءات الجزائية" },
  { law: "القواعد المنظمة لإجراءات قضايا الإفلاس في المحاكم التجارية", type: "CONTROL", parent: "نظام الإفلاس" },
  { law: "قواعد تحديد أتعاب الخبراء والأمناء في نظام الإفلاس", type: "CONTROL", parent: "نظام الإفلاس" },
  { law: "القواعد المنظمة لإجراءات الإفلاس العابرة للحدود", type: "CONTROL", parent: "نظام الإفلاس" },
];

const REL_FOR: Record<NodeType, RelType> = { SYSTEM_ARTICLE: "IMPLEMENTS", BYLAW_ARTICLE: "IMPLEMENTS", CONTROL: "GOVERNED_BY", PROCEDURE: "PROCEDURE_FOR" };
const nid = (type: string, law: string, n: number) => `${type}::${law}::${n}`;

type Art = { id: string; articleNumber: number; content: string };
const loadArticles = (law: string) =>
  prisma.legalArticle.findMany({ where: { lawName: law }, select: { id: true, articleNumber: true, content: true }, orderBy: { articleNumber: "asc" } });

async function main() {
  console.log("═".repeat(96));
  console.log(`بناء الرسم القانوني — الوضع: ${confirmed ? "كتابة (مؤكَّد)" : "جاف (قراءة فقط)"}`);
  console.log("═".repeat(96));

  const nodes: Array<{ id: string; type: NodeType; law: string; number: number; articleId: string }> = [];
  const sysIndex = new Map<string, string>(); // `${law}::${n}` → nodeId

  // ① عُقد الأنظمة الأساسية
  for (const sys of CORE_SYSTEMS) {
    const arts = await loadArticles(sys);
    for (const a of arts) {
      const id = nid("SYSART", sys, a.articleNumber);
      nodes.push({ id, type: "SYSTEM_ARTICLE", law: sys, number: a.articleNumber, articleId: a.id });
      sysIndex.set(`${sys}::${a.articleNumber}`, id);
    }
    if (!arts.length) console.log(`   ⚠ «${sys}» بلا مواد في القاعدة.`);
  }
  console.log(`عُقد SYSTEM_ARTICLE: ${nodes.length}`);

  // ② عُقد الأدوات + العلاقات الصريحة
  const edges: Array<{ sourceId: string; targetId: string; type: RelType; evidence: string; confidence: number; source: "EXPLICIT" }> = [];
  const unresolved: string[] = [];
  const byType: Record<string, number> = {};
  let instrNodeCount = 0;

  for (const it of INSTRUMENTS) {
    const arts = await loadArticles(it.law);
    if (!arts.length) { console.log(`   ⚠ الأداة «${it.law}» بلا مواد — تخطّي.`); continue; }
    const prefix = it.type === "BYLAW_ARTICLE" ? "BYLAW" : it.type === "CONTROL" ? "CTRL" : "PROC";
    let explicitHere = 0;
    for (const a of arts) {
      const nodeId = nid(prefix, it.law, a.articleNumber);
      nodes.push({ id: nodeId, type: it.type, law: it.law, number: a.articleNumber, articleId: a.id });
      instrNodeCount++;
      for (const ref of extractSystemRefs(a.content)) {
        const target = sysIndex.get(`${it.parent}::${ref.number}`);
        if (!target) { unresolved.push(`«${it.law}» م${a.articleNumber} → ${it.parent} م${ref.number} (غير موجودة)`); continue; }
        edges.push({ sourceId: nodeId, targetId: target, type: REL_FOR[it.type], evidence: `المادة (${ref.evidence}) من النظام`, confidence: 0.98, source: "EXPLICIT" });
        explicitHere++;
      }
    }
    byType[it.type] = (byType[it.type] ?? 0) + arts.length;
    console.log(`   • [${it.type}] «${it.law}» — عُقد=${arts.length} · علاقات صريحة=${explicitHere}`);
  }

  // إزالة تكرار العلاقات على (source,target,type) — الأعلى ثقة يرجّح (كلها 0.98 هنا)
  const edgeMap = new Map<string, (typeof edges)[number]>();
  for (const e of edges) {
    const k = `${e.sourceId}|${e.targetId}|${e.type}`;
    const prev = edgeMap.get(k);
    if (!prev || e.confidence > prev.confidence) edgeMap.set(k, e);
  }
  const uniqueEdges = [...edgeMap.values()];

  console.log("\n" + "─".repeat(96));
  console.log(`إجمالي العُقد: ${nodes.length} (نظام=${nodes.length - instrNodeCount} · أدوات=${instrNodeCount})`);
  console.log(`العلاقات الصريحة الفريدة (EXPLICIT 0.98): ${uniqueEdges.length}`);
  console.log(`إشارات بلا مقابل (unresolved): ${unresolved.length}`);
  for (const u of unresolved.slice(0, 12)) console.log(`   ⚠ ${u}`);

  // عيّنة للمراجعة
  console.log("\nعيّنة علاقات صريحة:");
  for (const e of uniqueEdges.slice(0, 6)) console.log(`   ${e.sourceId}  ──${e.type}(${e.confidence})──▶  ${e.targetId}   [${e.evidence}]`);

  if (!confirmed) {
    console.log("\n(وضع جاف — لم يُكتب شيء. CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED للتنفيذ.)");
    await prisma.$disconnect();
    return;
  }

  // ③ كتابة العُقد (createMany skipDuplicates) على دفعات
  console.log("\nكتابة العُقد…");
  const BATCH = 1000;
  let written = 0;
  for (let i = 0; i < nodes.length; i += BATCH) {
    const chunk = nodes.slice(i, i + BATCH).map((n) => ({ id: n.id, type: n.type, law: n.law, number: n.number, articleId: n.articleId }));
    const r = await prisma.legalGraphNode.createMany({ data: chunk, skipDuplicates: true });
    written += r.count;
  }
  console.log(`✓ عُقد جديدة: ${written} / ${nodes.length} (الموجود سابقًا مُتخطّى).`);

  // ④ كتابة العلاقات (upsert — idempotent، الأعلى ثقة يرجّح)
  console.log("كتابة العلاقات…");
  let relWritten = 0;
  for (const e of uniqueEdges) {
    await prisma.legalGraphEdge.upsert({
      where: { sourceId_targetId_type: { sourceId: e.sourceId, targetId: e.targetId, type: e.type } },
      update: { evidence: e.evidence, confidence: e.confidence, source: e.source },
      create: { sourceId: e.sourceId, targetId: e.targetId, type: e.type, evidence: e.evidence, confidence: e.confidence, source: e.source },
    });
    relWritten++;
  }
  console.log(`✓ علاقات مكتوبة (upsert): ${relWritten}`);

  const [nCount, eCount] = await Promise.all([prisma.legalGraphNode.count(), prisma.legalGraphEdge.count()]);
  console.log(`\nالإجمالي في القاعدة الآن — عُقد=${nCount} · علاقات=${eCount}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗ فشل seed-legal-graph:", e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
