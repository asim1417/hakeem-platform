/**
 * بوابة الإصدار القانونية النهائية للكوربوس السعودي.
 *
 * لا تعتمد أرقام MVP التاريخية. النجاح يعني:
 * 1) كل نظام مخزن يعاد تدقيقه لحظياً ويكون READY.
 * 2) لا توجد مواد يتيمة بلا legalSystemId.
 * 3) الأنظمة الجوهرية المحددة موجودة.
 * 4) لا توجد وثائق رسمية غير متحققة داخل الأنظمة الجاهزة.
 *
 * التشغيل بعد تطبيق الهجرات والاستكمال:
 *   npm run qa:legal-release
 */
import { prisma } from "@/lib/prisma";
import { auditSystemReadiness } from "@/lib/modules/legal-core/system-readiness";

const REQUIRED = (process.env.LEGAL_REQUIRED_SYSTEMS ??
  "نظام المعاملات المدنية|نظام الإثبات|نظام المرافعات الشرعية|نظام الشركات")
  .split("|")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const systems = await prisma.legalSystem.findMany({
    select: { id: true, name: true, articleCount: true, launchStatus: true },
    orderBy: { name: "asc" },
  });
  if (!systems.length) throw new Error("LEGAL_RELEASE_BLOCKED: لا توجد أنظمة.");

  const missingRequired = REQUIRED.filter(
    (required) => !systems.some((s) => s.name.trim() === required),
  );
  if (missingRequired.length) {
    throw new Error("LEGAL_RELEASE_BLOCKED: أنظمة جوهرية مفقودة: " + missingRequired.join("، "));
  }

  const orphanArticles = await prisma.legalArticle.count({ where: { legalSystemId: null } });
  if (orphanArticles) {
    throw new Error("LEGAL_RELEASE_BLOCKED: مواد يتيمة بلا legalSystemId=" + orphanArticles);
  }

  const failures: Array<{ system: string; status: string; blockers: string[]; warnings: string[] }> = [];
  let articleTotal = 0;
  let documentTotal = 0;

  for (const system of systems) {
    const report = await auditSystemReadiness(system.id);
    articleTotal += report.articleCount;
    documentTotal += report.documentCount;
    if (report.status !== "READY") {
      failures.push({
        system: system.name,
        status: report.status,
        blockers: report.issues.filter((x) => x.severity === "BLOCKER").map((x) => x.code),
        warnings: report.issues.filter((x) => x.severity === "WARNING").map((x) => x.code),
      });
    }
  }

  const unverifiedDocs = await prisma.legalDocument.count({
    where: {
      system: { is: { launchStatus: "READY" } },
      verificationStatus: { notIn: ["SOURCE_MATCHED", "CROSS_SOURCE_MATCHED"] },
    },
  });
  if (unverifiedDocs) {
    failures.push({
      system: "__CORPUS__",
      status: "NOT_READY",
      blockers: ["UNVERIFIED_DOCUMENTS_IN_READY_SYSTEMS:" + unverifiedDocs],
      warnings: [],
    });
  }

  if (failures.length) {
    console.error(JSON.stringify({
      result: "BLOCKED",
      systems: systems.length,
      articles: articleTotal,
      documents: documentTotal,
      failures,
    }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    result: "READY",
    systems: systems.length,
    articles: articleTotal,
    documents: documentTotal,
    requiredSystems: REQUIRED,
    checkedAt: new Date().toISOString(),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
