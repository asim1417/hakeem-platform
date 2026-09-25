/**
 * build-rulings-search-norm — يملأ judicial_cases.search_norm بنصٍّ **منقّى من PDPL
 * ومطبَّع** (البند 1.7). يُشغَّل بعد هجرة 20260925060000 على **Neon branch** لا الإنتاج.
 *
 * لا يُخزَّن أي رقم هوية/جوال في الفهرس (يُنقّى قبل التطبيع).
 * dry-run افتراضيًّا؛ على Neon يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeArabic } from "../../lib/modules/legal-core/bm25-tokenizer";
import { redactPII } from "../../lib/modules/legal-core/rulings-search";

const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));
const BATCH = 500;

async function main() {
  const prisma = new PrismaClient();
  if (isNeon && process.argv.includes("--apply") && !APPLY) {
    console.error("🛑 Neon: يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES (ويُفضّل Neon branch لا الإنتاج).");
    process.exit(2);
  }
  try {
    const total = await prisma.judicialCase.count();
    console.log(`${APPLY ? "🛠️ APPLY" : "🔎 DRY-RUN"} — أحكام: ${total}`);
    if (!APPLY) { console.log("ℹ️  DRY-RUN: لن تُكتب بيانات. أضف --apply (على Neon branch)."); return; }
    let done = 0;
    for (let skip = 0; skip < total; skip += BATCH) {
      const rows = await prisma.judicialCase.findMany({
        select: { id: true, judgmentText: true, judgmentTitle: true },
        orderBy: { id: "asc" }, skip, take: BATCH,
      });
      if (!rows.length) break;
      await prisma.$transaction(
        rows.map((r) => {
          const norm = normalizeArabic(redactPII(`${r.judgmentTitle ?? ""} ${r.judgmentText ?? ""}`));
          return prisma.$executeRawUnsafe(`UPDATE "judicial_cases" SET "search_norm" = $1 WHERE "id" = $2`, norm, r.id);
        }),
      );
      done += rows.length;
      if (done % 5000 === 0 || done === total) console.log(`  ${done}/${total}`);
    }
    console.log(`✓ عُبِّئ search_norm لـ ${done} حكمًا (منقّى PDPL).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
