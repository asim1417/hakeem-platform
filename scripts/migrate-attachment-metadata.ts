/**
 * ترحيل metadata القديمة من extractedText → عمود metadata.
 * لا يُشغَّل تلقائيًا مع migration النشر.
 *
 *   npm run migrate:attachment-metadata -- --dry-run
 *   npm run migrate:attachment-metadata -- --apply
 *
 * الوضع الافتراضي: dry-run. --apply مطلوب للكتابة.
 * ممنوع تشغيل --apply على الإنتاج في جولة المراجعة دون موافقة صريحة.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { decideAttachmentMetadataMigration } from "@/lib/modules/attachments/migrate-attachment-metadata-core";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

type Mode = "dry-run" | "apply";

function parseMode(argv: string[]): Mode {
  if (argv.includes("--apply")) return "apply";
  return "dry-run";
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  console.log(`migrate-attachment-metadata · mode=${mode} · batch=${BATCH_SIZE}`);

  let scanned = 0;
  let eligible = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.attachment.findMany({
      select: { id: true, extractedText: true, metadata: true, fileName: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const decision = decideAttachmentMetadataMigration(row);
      if (decision.action === "skip") {
        skipped += 1;
        continue;
      }
      eligible += 1;
      // لا تُطبع قيم metadata (قد تحوي storageUrl موقّعًا) — المفاتيح فقط.
      console.log(
        JSON.stringify({
          action: mode === "apply" ? "apply" : "would-migrate",
          id: decision.id,
          fileName: decision.fileName,
          keys: decision.metadataKeys
        })
      );

      if (mode !== "apply") continue;

      try {
        // تحديث ذرّي: كتابة metadata ثم تفريغ extractedText في نفس الصف.
        await prisma.attachment.update({
          where: { id: decision.id },
          data: {
            metadata: toInputJson(decision.metadata),
            extractedText: null
          }
        });
        migrated += 1;
      } catch (err) {
        failed += 1;
        console.error(
          JSON.stringify({
            action: "failed",
            id: decision.id,
            error: err instanceof Error ? err.name : "unknown"
          })
        );
      }
    }

    cursor = rows[rows.length - 1]?.id;
    if (rows.length < BATCH_SIZE) break;
  }

  const summary = {
    mode,
    scanned,
    eligible,
    migrated: mode === "apply" ? migrated : 0,
    skipped,
    failed,
    note:
      mode === "dry-run"
        ? "لم يُكتب شيء. أعد التشغيل مع --apply للترحيل."
        : failed > 0
          ? "اكتمل مع إخفاقات — راجع سجلات failed."
          : "اكتمل الترحيل. السجلات القديمة باتت تستخدم عمود metadata."
  };
  console.log(JSON.stringify(summary));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
