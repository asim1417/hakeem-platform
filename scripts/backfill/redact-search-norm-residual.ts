/**
 * تمريرة حجب ثانية على judicial_cases.search_norm.
 * الحجب الأول كان قبل التطبيع، فبقيت أرقام هندية تحوّلت إلى هوية لاتينية من 10 خانات.
 * والعمود على الإنتاج بُني بـ normalizeArabicText (scripts/backfill-rulings-search-norm.ts) بلا حجب،
 * فبقيت الأرقام هندية أيضًا (جرد ١٦/١٠/٢٠٢٦: نحو ٢٪ من الأحكام). يرصد الصيغتين ويحجب
 * مع الإبقاء على تطبيع العمود القائم (normalizeArabicText) كي لا يختلف عن بقية الصفوف وقرّائها.
 * يعدّ الصفوف فقط ولا يطبع نص الحكم.
 *
 * dry-run افتراضيًا. على Neon: --apply --i-understand-production + CONFIRM_NEON_WRITE=YES.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeArabicText } from "../../lib/modules/legal-core/arabic-morphology";
import { redactPII } from "../../lib/modules/legal-core/rulings-search";

const isNeon = /neon\.tech/i.test(process.env.DATABASE_URL || "");
const APPLY =
  process.argv.includes("--apply") &&
  (!isNeon || (process.argv.includes("--i-understand-production") && process.env.CONFIRM_NEON_WRITE === "YES"));
const BATCH = 200;
// أرقام لاتينية أو هندية (٠-٩).
const D = "[0-9٠-٩]";
const LEAK = `(search_norm ~ '(^|[^0-9٠-٩])[12١٢]${D}{9}([^0-9٠-٩]|$)')
  OR (search_norm ~ '(^|[^0-9٠-٩])[0٠][5٥]${D}{8}([^0-9٠-٩]|$)')
  OR (search_norm ~ '(^|[^0-9٠-٩])([0٠][0٠])?[9٩][6٦][6٦][5٥]${D}{8}([^0-9٠-٩]|$)')`;

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
        .map((r) => ({ id: r.id, prev: r.search_norm, next: normalizeArabicText(redactPII(r.search_norm)) }))
        .filter((r) => r.next.length > 0 && r.next !== r.prev);
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
