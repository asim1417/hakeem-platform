/**
 * تمريرة حجب ثانية على judicial_cases.search_norm.
 * الحجب الأول كان قبل التطبيع، فبقيت أرقام هندية تحوّلت إلى هوية لاتينية من 10 خانات.
 * يعدّ الصفوف فقط ولا يطبع نص الحكم.
 *
 * dry-run افتراضيًا. على Neon: --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeArabic } from "../../lib/modules/legal-core/bm25-tokenizer";
import { redactPII } from "../../lib/modules/legal-core/rulings-search";

const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));
const BATCH = 200;
const LEAK = `(search_norm ~ '(^|[^0-9])[12][0-9]{9}([^0-9]|$)')
  OR (search_norm ~ '(^|[^0-9])05[0-9]{8}([^0-9]|$)')
  OR (search_norm ~ '(^|[^0-9])(009665|9665)[0-9]{8}([^0-9]|$)')`;

async function countLeaks(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT count(*)::bigint AS c FROM judicial_cases WHERE ${LEAK}`,
  );
  return Number(rows[0]?.c ?? 0);
}

async function main() {
  const prisma = new PrismaClient();
  if (isNeon && process.argv.includes("--apply") && !APPLY) {
    console.error("Neon: يتطلّب --apply --i-understand-production + CONFIRM_NEON_WRITE=YES");
    process.exit(2);
  }
  try {
    const before = await countLeaks(prisma);
    console.log(`${APPLY ? "APPLY" : "DRY-RUN"} — صفوف فيها نمط هوية/جوال: ${before}`);
    if (!APPLY) return;
    let scanned = 0;
    let changed = 0;
    let cursor = "";
    for (;;) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; search_norm: string }>>(
        `SELECT id, search_norm FROM judicial_cases
         WHERE id > $1 AND (${LEAK})
         ORDER BY id
         LIMIT ${BATCH}`,
        cursor,
      );
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      const updates = rows
        .map((r) => ({ id: r.id, next: normalizeArabic(redactPII(r.search_norm)) }))
        .filter((r) => r.next.length > 0);
      if (updates.length) {
        await prisma.$transaction(
          updates.map((r) =>
            prisma.$executeRawUnsafe(`UPDATE judicial_cases SET search_norm = $1 WHERE id = $2`, r.next, r.id),
          ),
        );
        changed += updates.length;
      }
      scanned += rows.length;
      console.log(`  ممسوح: ${scanned} | مُحدَّث: ${changed}`);
    }
    const after = await countLeaks(prisma);
    console.log(`تم. قبل: ${before} | بعد: ${after} | مُحدَّث: ${changed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(1);
});
