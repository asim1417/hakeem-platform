/**
 * استكمال بصمة ومصدر الوثائق القانونية القائمة دون تغيير النص.
 * --apply فقط بعد تطبيق migration الخاصة بالجاهزية.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function inferSource(url: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === "ncar.gov.sa" || h === "www.ncar.gov.sa") return "NCAR";
    if (h === "laws.boe.gov.sa" || h === "boe.gov.sa" || h === "www.boe.gov.sa") return "BOE";
    if (h === "uqn.gov.sa" || h === "www.uqn.gov.sa") return "UQN";
    return null;
  } catch { return null; }
}

function hash(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function main() {
  if (APPLY && process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    throw new Error("الكتابة مقفولة: يلزم CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED.");
  }
  const docs = await prisma.legalDocument.findMany({
    select: { id: true, docType: true, sourceUrl: true, sourceCode: true, rawText: true, contentSha256: true, verificationStatus: true },
    orderBy: { createdAt: "asc" },
  });
  let official = 0, changed = 0, unverified = 0;
  for (const doc of docs) {
    const sourceCode = doc.sourceCode ?? inferSource(doc.sourceUrl);
    const contentSha256 = hash(doc.rawText);
    const officialSource = Boolean(sourceCode);
    if (officialSource) official++; else unverified++;
    const verificationStatus = officialSource ? "SOURCE_MATCHED" as const : "UNVERIFIED" as const;
    const needs = doc.sourceCode !== sourceCode || doc.contentSha256 !== contentSha256 || doc.verificationStatus !== verificationStatus;
    if (!needs) continue;
    changed++;
    console.log((APPLY ? "✓ " : "→ ") + doc.id + " " + doc.docType + " source=" + (sourceCode ?? "—") + " status=" + verificationStatus);
    if (APPLY) {
      await prisma.legalDocument.update({
        where: { id: doc.id },
        data: {
          sourceCode,
          contentSha256,
          verificationStatus,
          verifiedAt: officialSource ? new Date() : null,
        },
      });
    }
  }
  console.log("الوثائق=" + docs.length + " · مصدر رسمي=" + official + " · بلا مصدر رسمي=" + unverified + " · " + (APPLY ? "محدّث=" : "سيُحدّث=") + changed);
}

main()
  .catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect().catch(() => undefined));
