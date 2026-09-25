/**
 * build-rulings-search-norm — يملأ judicial_cases.search_norm بنصٍّ **منقّى من PDPL
 * ومطبَّع** (البند 1.7). يُشغَّل بعد هجرة 20260925060000.
 * على Neon يلزم --apply --i-understand-production و CONFIRM_NEON_WRITE=YES.
 *
 * يمرّ النص عبر sanitizeJudgmentDisplay قبل الحجب/التطبيع (فهرس فقط — لا يمسّ الحكم الأصلي).
 * dry-run افتراضيًّا؛ على Neon يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.
 */
import { PrismaClient } from "@prisma/client";
import { buildRulingSearchNorm } from "../../lib/modules/legal-core/rulings-search";

const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));
const BATCH = 500;
const REBUILD_ALL = process.argv.includes("--all");

async function main() {
  const prisma = new PrismaClient();
  if (isNeon && process.argv.includes("--apply") && !APPLY) {
    console.error("🛑 Neon: يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES (ويُفضّل Neon branch لا الإنتاج).");
    process.exit(2);
  }
  try {
    const total = await prisma.judicialCase.count();
    console.log(`${APPLY ? "🛠️ APPLY" : "🔎 DRY-RUN"} — أحكام: ${total}${REBUILD_ALL ? " (إعادة الكل)" : " (الناقص فقط)"}`);
    if (!APPLY) { console.log("ℹ️  DRY-RUN: لن تُكتب بيانات. أضف --apply (على Neon branch)."); return; }
    let done = 0;
    let cursor = "";
    for (;;) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; judgmentText: string; judgmentTitle: string | null }>>(
        REBUILD_ALL
          ? `SELECT id, "judgmentText" AS "judgmentText", "judgmentTitle" AS "judgmentTitle"
             FROM judicial_cases
             WHERE id > $1
             ORDER BY id
             LIMIT ${BATCH}`
          : `SELECT id, "judgmentText" AS "judgmentText", "judgmentTitle" AS "judgmentTitle"
             FROM judicial_cases
             WHERE id > $1 AND ("search_norm" IS NULL OR "search_norm" = '')
             ORDER BY id
             LIMIT ${BATCH}`,
        cursor,
      );
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      await prisma.$transaction(
        rows.map((r) => {
          const norm = buildRulingSearchNorm(r.judgmentTitle, r.judgmentText);
          return prisma.$executeRawUnsafe(`UPDATE "judicial_cases" SET "search_norm" = $1 WHERE "id" = $2`, norm, r.id);
        }),
      );
      done += rows.length;
      if (done % 5000 === 0) console.log(`  ${done}/${total}`);
    }
    console.log(`✓ عُبِّئ search_norm لـ ${done} حكمًا (منقّى عرض + PDPL). لم يُمسّ judgmentText.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
