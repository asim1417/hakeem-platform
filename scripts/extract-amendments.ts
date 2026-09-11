/**
 * extract-amendments.ts — تعبئة `article_amendments` من حواشي التعديل في نصّ المواد.
 *
 * يقرأ كل مادة، يستخرج أحداث التعديل/الإلغاء/التصويب الصريحة (amendment-extractor)،
 * ويُنشئ صفوف `ArticleAmendment` بمصدر «extractor» وحالة «needs_review» للمراجعة البشريّة.
 * لا يلمس نصّ المادة (`content`)، ولا يجلب خارجيًّا. idempotent: لا يكرّر حدثًا موجودًا
 * (نفس النوع + مرجع الأداة) للمادة نفسها.
 *
 * تشغيل (كتابة مقفولة — عبر workflow):
 *   npx tsx scripts/extract-amendments.ts                                             # تجربة (dry-run)
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/extract-amendments.ts --apply
 * أعلام: --limit N (سقف المواد) · --apply (الكتابة). لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";
import { extractAmendments, type AmendmentChangeType } from "@/lib/modules/legal-core/amendment-extractor";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;
const BATCH = 500;

function assertAlignmentConfirmed() {
  if (APPLY && process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED مع --apply.");
    process.exit(1);
  }
}

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try { return new URL(raw).hostname; } catch { return "غير صالح"; }
}

async function main() {
  assertAlignmentConfirmed();
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log(`الوضع: ${APPLY ? "تطبيق (كتابة)" : "تجربة (قراءة فقط)"}${LIMIT ? ` · سقف ${LIMIT}` : ""}`);
  console.log("=".repeat(60));

  let cursor: string | null = null;
  let scanned = 0;
  let withEvents = 0;
  let newEvents = 0;
  const byType: Record<AmendmentChangeType, number> = { amended: 0, repealed: 0, reinstated: 0, corrected: 0 };
  const samples: string[] = [];

  for (;;) {
    const rows: Array<{ id: string; content: string | null; lawName: string; articleNumber: number }> =
      await prisma.legalArticle.findMany({
        where: {},
        select: { id: true, content: true, lawName: true, articleNumber: true },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
    if (!rows.length) break;

    for (const row of rows) {
      scanned += 1;
      const events = extractAmendments(row.content);
      if (!events.length) continue;

      // idempotency: اجلب الموجود لهذه المادة (النوع + المرجع + أعلى نسخة).
      const existing = await prisma.articleAmendment.findMany({
        where: { articleId: row.id },
        select: { changeType: true, decreeRef: true, version: true },
      });
      const existingKeys = new Set(existing.map((e) => `${e.changeType}|${e.decreeRef ?? ""}`));
      let nextVersion = existing.reduce((mx, e) => Math.max(mx, e.version), 0) + 1;

      const fresh = events.filter((e) => !existingKeys.has(`${e.changeType}|${e.decreeRef ?? ""}`));
      if (!fresh.length) continue;
      withEvents += 1;

      for (const ev of fresh) {
        byType[ev.changeType] += 1;
        newEvents += 1;
        if (samples.length < 10) {
          samples.push(`${row.lawName} — م/${row.articleNumber}: ${ev.changeType} · ${ev.decreeRef ?? ev.hijriDate ?? "—"}`);
        }
        if (APPLY) {
          await prisma.articleAmendment.create({
            data: {
              articleId: row.id,
              version: nextVersion,
              changeType: ev.changeType,
              decreeRef: ev.decreeRef ?? undefined,
              hijriDate: ev.hijriDate ?? undefined,
              summary: ev.summary,
              source: "extractor",
              reviewStatus: "needs_review",
            },
          }).catch((e: unknown) => {
            console.error(`  ! تعذّر إنشاء تعديل للمادة ${row.id}: ${e instanceof Error ? e.message : e}`);
          });
        }
        nextVersion += 1;
      }
    }

    cursor = rows[rows.length - 1].id;
    if (LIMIT && scanned >= LIMIT) break;
    process.stdout.write(`\r  فُحص: ${scanned} · مواد بأحداث: ${withEvents} · أحداث جديدة: ${newEvents}   `);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`المواد المفحوصة:      ${scanned.toLocaleString("en")}`);
  console.log(`مواد بأحداث تعديل:    ${withEvents.toLocaleString("en")}`);
  console.log(`أحداث جديدة:          ${newEvents.toLocaleString("en")}`);
  console.log(`  حسب النوع:          ${JSON.stringify(byType)}`);
  if (samples.length) {
    console.log("\nعيّنة:");
    for (const s of samples) console.log(`  • ${s}`);
  }
  if (!APPLY) console.log("\n(تجربة فقط — لم يُكتب شيء. أضِف --apply مع التأكيد للكتابة.)");
  else console.log(`\n✅ كُتب ${newEvents} حدثًا بمصدر «extractor» وحالة «needs_review» للمراجعة.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
