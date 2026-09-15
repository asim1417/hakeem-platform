/**
 * scripts/backfill/ingest.ts — إدخال المجلوب عبر القارئ وربطه بسجل النظام (ثامنًا-٣)
 * وتحديث completeness. لا يمسّ وحدات المواد القائمة.
 *
 * المصدر: ملفات نصّ مُستخلَصة data/backfill/text/<systemId>.json بالشكل:
 *   { "docType": "ROYAL_DECREE", "rawText": "...", "number": "م/191", "hijriDate": "..." }
 * (خطوة الاستخلاص من HTML البوابة في fetch-boe/عمل بشريّ — النصّ الخام هو المدخل.)
 *
 * ⚠️ كتابة على القاعدة ⇒ مقفولة خلف CONFIRM_RUNTIME_DB_ALIGNMENT + --apply.
 *   npx tsx scripts/backfill/ingest.ts                                   # معاينة
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED \
 *     npx tsx scripts/backfill/ingest.ts --apply                          # إدخال
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { persistParsedDocument, type DbDocType } from "@/lib/modules/legal-core/document-persist";

const APPLY = process.argv.includes("--apply");
const DIR = "data/backfill/text";

interface BackfillFile {
  docType: DbDocType;
  rawText: string;
  number?: string;
  hijriDate?: string;
  sourceUrl?: string;
}

function assertWritable() {
  if (APPLY && process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED مع --apply.");
    process.exit(1);
  }
}

async function main() {
  assertWritable();
  if (!existsSync(DIR)) {
    console.log(`⏭️  لا مجلد ${DIR} — لا مدخلات للاستكمال.`);
    return;
  }
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  console.log(`ملفات الاستكمال: ${files.length}. apply=${APPLY}`);

  let done = 0;
  let raised = 0;
  for (const f of files) {
    const systemId = f.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(`${DIR}/${f}`, "utf-8")) as BackfillFile;
    const system = await prisma.legalSystem.findUnique({ where: { id: systemId }, select: { id: true, name: true } });
    if (!system) { console.log(`  ⚠️ نظام غير موجود: ${systemId}`); continue; }

    if (!APPLY) {
      console.log(`  - ${system.name}: ${data.docType} (${data.rawText.length} حرفًا)`);
      continue;
    }

    const res = await persistParsedDocument({
      systemId, docType: data.docType, rawText: data.rawText,
      number: data.number ?? null, hijriDate: data.hijriDate ?? null, sourceUrl: data.sourceUrl ?? null,
    });
    // تحديث الاكتمال: كامل إذا صحّت إعادة التركيب ووُجدت أداة إصدار.
    const hasInstrument = ["ROYAL_DECREE", "COUNCIL_DECISION", "AGENCY_DECISION"].includes(data.docType);
    if (!res.reconstructionOk || res.warnings.length) {
      raised++;
      console.log(`  ⚠️ رُفع للمراجعة: ${system.name} (تحذيرات: ${res.warnings.length})`);
    }
    await prisma.legalSystem.update({
      where: { id: systemId },
      data: { completeness: hasInstrument && res.reconstructionOk ? "COMPLETE" : "IN_PROGRESS" },
    });
    done++;
    console.log(`  ✓ ${system.name}: ${res.unitCount} وحدة، إعادة تركيب=${res.reconstructionOk}`);
  }
  console.log(`تم: ${done} | مرفوع للمراجعة: ${raised}.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
