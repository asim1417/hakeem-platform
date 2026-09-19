/**
 * إدخال حزمة الوثائق الرسمية لنظام واحد أو أكثر:
 * المرسوم + قرار مجلس الوزراء + نص النظام + أي أداة أخرى، دون افتراض وثيقة واحدة لكل نظام.
 *
 * الملف:
 * data/backfill/text/<systemId>.json
 * إما وثيقة واحدة (توافق خلفي) أو:
 * {
 *   "systemId": "...",
 *   "documents": [
 *     {"docType":"ROYAL_DECREE","number":"م/191","hijriDate":"29/11/1444","rawText":"...","sourceCode":"UQN","sourceUrl":"...","verificationStatus":"SOURCE_MATCHED"},
 *     {"docType":"COUNCIL_DECISION","number":"820","hijriDate":"24/11/1444","rawText":"...","sourceCode":"UQN","sourceUrl":"...","verificationStatus":"SOURCE_MATCHED"},
 *     {"docType":"SYSTEM_TEXT","rawText":"...","sourceCode":"NCAR","sourceUrl":"...","verificationStatus":"SOURCE_MATCHED"}
 *   ]
 * }
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { persistParsedDocument, type DbDocType } from "@/lib/modules/legal-core/document-persist";
import { auditSystemReadiness, persistSystemReadiness } from "@/lib/modules/legal-core/system-readiness";

const APPLY = process.argv.includes("--apply");
const DIR = "data/backfill/text";

type VerificationStatus = "UNVERIFIED" | "SOURCE_MATCHED" | "CROSS_SOURCE_MATCHED" | "REVIEW_REQUIRED";

interface BackfillDocument {
  docType: DbDocType;
  rawText: string;
  number?: string;
  hijriDate?: string;
  sourceGuid?: string;
  sourceUrl?: string;
  sourceCode?: string;
  sourceDocumentId?: string;
  verificationStatus?: VerificationStatus;
  publishedAt?: string;
}

interface BackfillBundle {
  systemId?: string;
  documents: BackfillDocument[];
}

function assertWritable() {
  if (APPLY && process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    throw new Error("الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED مع --apply.");
  }
}

function asBundle(raw: BackfillDocument | BackfillBundle, fallbackSystemId: string): { systemId: string; documents: BackfillDocument[] } {
  if ("documents" in raw && Array.isArray(raw.documents)) {
    return { systemId: raw.systemId?.trim() || fallbackSystemId, documents: raw.documents };
  }
  return { systemId: fallbackSystemId, documents: [raw] };
}

async function existsAlready(systemId: string, d: BackfillDocument): Promise<boolean> {
  if (d.sourceGuid) {
    const found = await prisma.legalDocument.findUnique({ where: { sourceGuid: d.sourceGuid }, select: { id: true } });
    if (found) return true;
  }
  const found = await prisma.legalDocument.findFirst({
    where: {
      systemId,
      docType: d.docType,
      ...(d.sourceCode ? { sourceCode: d.sourceCode } : {}),
      ...(d.sourceDocumentId ? { sourceDocumentId: d.sourceDocumentId } :
        d.sourceUrl ? { sourceUrl: d.sourceUrl } :
        d.number ? { number: d.number } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

async function main() {
  assertWritable();
  if (!existsSync(DIR)) {
    console.log("⏭️  لا مجلد " + DIR + " — لا مدخلات للاستكمال.");
    return;
  }
  const files = readdirSync(DIR).filter((name) => name.endsWith(".json"));
  console.log("ملفات الاستكمال: " + files.length + ". apply=" + APPLY);

  let inserted = 0;
  let skipped = 0;
  let raised = 0;

  for (const file of files) {
    const fallbackSystemId = file.replace(/\.json$/, "").split("__")[0];
    const raw = JSON.parse(readFileSync(DIR + "/" + file, "utf-8")) as BackfillDocument | BackfillBundle;
    const bundle = asBundle(raw, fallbackSystemId);
    const system = await prisma.legalSystem.findUnique({ where: { id: bundle.systemId }, select: { id: true, name: true } });
    if (!system) {
      console.log("  ⚠️ نظام غير موجود: " + bundle.systemId + " (" + file + ")");
      continue;
    }

    console.log("\n" + system.name + " — " + bundle.documents.length + " وثيقة");
    for (const d of bundle.documents) {
      if (!d.rawText?.trim()) {
        raised++;
        console.log("  ✗ " + d.docType + ": نص فارغ — مرفوض");
        continue;
      }
      if (!APPLY) {
        console.log("  → " + d.docType + " " + (d.number ?? "") + " (" + d.rawText.length + " حرفًا) source=" + (d.sourceCode ?? "—"));
        continue;
      }
      if (await existsAlready(system.id, d)) {
        skipped++;
        console.log("  ↷ موجودة مسبقًا: " + d.docType + " " + (d.number ?? ""));
        continue;
      }

      const res = await persistParsedDocument({
        systemId: system.id,
        docType: d.docType,
        rawText: d.rawText,
        number: d.number ?? null,
        hijriDate: d.hijriDate ?? null,
        sourceGuid: d.sourceGuid ?? null,
        sourceUrl: d.sourceUrl ?? null,
        sourceCode: d.sourceCode ?? null,
        sourceDocumentId: d.sourceDocumentId ?? null,
        verificationStatus: d.verificationStatus ?? "UNVERIFIED",
        publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
      });
      inserted++;
      if (!res.reconstructionOk || res.warnings.length) {
        raised++;
        console.log("  ⚠️ " + d.docType + ": reconstruction=" + res.reconstructionOk + " warnings=" + res.warnings.length);
      } else {
        console.log("  ✓ " + d.docType + ": " + res.unitCount + " وحدة");
      }
    }

    if (APPLY) {
      const report = await auditSystemReadiness(system.id);
      await persistSystemReadiness(report);
      console.log("  بوابة الإطلاق: " + report.status + " · issues=" + report.issues.length);
    }
  }

  console.log("\nتم: inserted=" + inserted + " · skipped=" + skipped + " · raised=" + raised);
  if (!APPLY) console.log("معاينة فقط — لم تُكتب بيانات.");
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect().catch(() => undefined));
