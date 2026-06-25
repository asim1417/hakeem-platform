/**
 * qa-relations-integrity.ts — فحص تكامل مرجعي للرسم المعرفي (المرحلة ٤، قراءة فقط).
 *
 * legal_relations يربط كيانات بأنواع متعددة (article|ruling|principle|system) عبر
 * source_id/target_id كنصوص بلا FK صلب. هذا الفحص يكشف الإشارات المعلّقة (dangling):
 * معرّفات لا توجد في جداولها. لا يحذف ولا يكتب شيئًا — يعرض الأعداد وعيّنات فقط.
 *
 * تشغيل: npm run qa:relations
 * يخرج برمز 1 إن وُجد أي dangling (لبوابة CI)، وإلا 0.
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type EntityType = "article" | "ruling" | "principle" | "system";
const TYPES: EntityType[] = ["article", "ruling", "principle", "system"];

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

/** يُرجع مجموعة المعرّفات الموجودة فعليًّا من بين المطلوبة (لجدول النوع)، بدفعات. */
async function existingIds(type: EntityType, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const chunk = 1000;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    let rows: Array<{ id: string }> = [];
    if (type === "article") rows = await prisma.legalArticle.findMany({ where: { id: { in: slice } }, select: { id: true } });
    else if (type === "ruling") rows = await prisma.judicialCase.findMany({ where: { id: { in: slice } }, select: { id: true } });
    else if (type === "principle") rows = await prisma.judicialPrinciple.findMany({ where: { id: { in: slice } }, select: { id: true } });
    else if (type === "system") rows = await prisma.legalSystem.findMany({ where: { id: { in: slice } }, select: { id: true } });
    for (const r of rows) found.add(r.id);
  }
  return found;
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log("=".repeat(64));

  const total = await prisma.legalRelation.count();
  console.log(`إجمالي العلاقات: ${total.toLocaleString("en")}`);

  const relations = await prisma.legalRelation.findMany({
    select: { id: true, sourceType: true, sourceId: true, targetType: true, targetId: true }
  });

  // اجمع المعرّفات المطلوبة لكل نوع (من الطرفين)، ثم تحقّق وجودها.
  const wanted = new Map<EntityType, Set<string>>(TYPES.map((t) => [t, new Set<string>()]));
  let unknownType = 0;
  for (const r of relations) {
    if (wanted.has(r.sourceType as EntityType)) wanted.get(r.sourceType as EntityType)!.add(r.sourceId);
    else unknownType += 1;
    if (wanted.has(r.targetType as EntityType)) wanted.get(r.targetType as EntityType)!.add(r.targetId);
    else unknownType += 1;
  }

  const existing = new Map<EntityType, Set<string>>();
  for (const t of TYPES) existing.set(t, await existingIds(t, [...wanted.get(t)!]));

  const isDangling = (type: string, id: string) => {
    if (!wanted.has(type as EntityType)) return true; // نوع غير معروف = معلّق
    return !existing.get(type as EntityType)!.has(id);
  };

  let danglingSource = 0;
  let danglingTarget = 0;
  const samples: string[] = [];
  for (const r of relations) {
    const ds = isDangling(r.sourceType, r.sourceId);
    const dt = isDangling(r.targetType, r.targetId);
    if (ds) danglingSource += 1;
    if (dt) danglingTarget += 1;
    if ((ds || dt) && samples.length < 10) {
      samples.push(`   • علاقة ${r.id}: ${r.sourceType}:${r.sourceId}${ds ? " ⟵معلّق" : ""} → ${r.targetType}:${r.targetId}${dt ? " ⟵معلّق" : ""}`);
    }
  }

  console.log("\nأعداد المعرّفات المرجعية لكل نوع (الطرفان مجتمعان):");
  for (const t of TYPES) console.log(`   ${t.padEnd(10)} مطلوب=${wanted.get(t)!.size}  موجود=${existing.get(t)!.size}`);

  console.log(`\nإشارات معلّقة في source: ${danglingSource}`);
  console.log(`إشارات معلّقة في target: ${danglingTarget}`);
  if (unknownType) console.log(`أطراف بنوع غير معروف:   ${unknownType}`);
  const totalDangling = danglingSource + danglingTarget;
  if (samples.length) {
    console.log("\nعيّنات (حتى 10 علاقات بطرف معلّق):");
    samples.forEach((s) => console.log(s));
  }

  console.log("\n" + "=".repeat(64));
  if (totalDangling === 0 && unknownType === 0) {
    console.log("✅ صفر إشارات معلّقة — تكامل مرجعي سليم في legal_relations.");
    return;
  }
  console.log(`🔴 توجد ${totalDangling} إشارة معلّقة. لا حذف تلقائي — اعرضها واطلب الموافقة قبل أي تنظيف.`);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
