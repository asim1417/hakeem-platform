/**
 * ترحيل metadata القديمة من extractedText → عمود metadata.
 * لا يُشغَّل تلقائيًا مع migration النشر.
 *
 *   npm run migrate:attachment-metadata -- --dry-run
 *   npm run migrate:attachment-metadata -- --apply
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { decodeLegacyAttachmentPayload } from "@/lib/modules/attachments/attachment-metadata";

const prisma = new PrismaClient();

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
  console.log(`migrate-attachment-metadata · mode=${mode}`);

  const rows = await prisma.attachment.findMany({
    select: { id: true, extractedText: true, metadata: true, fileName: true }
  });

  let candidates = 0;
  let applied = 0;
  let skipped = 0;

  for (const row of rows) {
    const decoded = decodeLegacyAttachmentPayload(row.extractedText, row.metadata);
    if (!decoded.legacyMetadataDetected) {
      skipped += 1;
      continue;
    }
    candidates += 1;
    const summary = {
      id: row.id,
      fileName: row.fileName,
      keys: Object.keys(decoded.metadata).sort(),
      willClearExtractedText: true
    };
    console.log(JSON.stringify({ action: mode === "apply" ? "apply" : "would-migrate", ...summary }));

    if (mode === "apply") {
      await prisma.attachment.update({
        where: { id: row.id },
        data: {
          metadata: toInputJson(decoded.metadata),
          extractedText: null
        }
      });
      applied += 1;
    }
  }

  console.log(
    JSON.stringify({
      mode,
      scanned: rows.length,
      candidates,
      applied,
      skipped,
      note:
        mode === "dry-run"
          ? "لم يُكتب شيء. أعد التشغيل مع --apply للترحيل."
          : "اكتمل الترحيل. السجلات القديمة باتت تستخدم عمود metadata."
    })
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
