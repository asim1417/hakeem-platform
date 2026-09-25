/**
 * بوابة جاهزية إطلاق قاعدة الأنظمة.
 * قراءة فقط افتراضياً؛ --apply يحدّث launch_status/report، و--strict يفشل عند أي نظام غير READY.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { auditSystemReadiness, persistSystemReadiness } from "@/lib/modules/legal-core/system-readiness";

const APPLY = process.argv.includes("--apply");
const STRICT = process.argv.includes("--strict");
const lawArg = process.argv.find((a) => a.startsWith("--law="))?.slice("--law=".length).trim();

function assertWritable() {
  if (APPLY && process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    throw new Error("الكتابة مقفولة: اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED مع --apply.");
  }
}

function csvCell(v: unknown) {
  const s = String(v ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return /[",]/.test(s) ? '"' + s + '"' : s;
}

async function main() {
  assertWritable();
  const systems = await prisma.legalSystem.findMany({
    where: lawArg ? { name: { contains: lawArg, mode: "insensitive" } } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!systems.length) throw new Error(lawArg ? "لم يوجد نظام يطابق: " + lawArg : "لا توجد أنظمة.");

  const reports = [];
  for (const system of systems) {
    const report = await auditSystemReadiness(system.id);
    reports.push(report);
    if (APPLY) await persistSystemReadiness(report);

    const icon = report.status === "READY" ? "✅" : report.status === "REVIEW_REQUIRED" ? "⚠️" : "❌";
    const blockers = report.issues.filter((i) => i.severity === "BLOCKER").length;
    const warnings = report.issues.filter((i) => i.severity === "WARNING").length;
    console.log(icon + " " + system.name + " — " + report.status + " · blockers=" + blockers + " · warnings=" + warnings);
    for (const issue of report.issues.slice(0, 12)) console.log("   [" + issue.severity + "] " + issue.code + ": " + issue.message);
    if (report.issues.length > 12) console.log("   … و" + (report.issues.length - 12) + " ملاحظة أخرى");
  }

  fs.mkdirSync("reports", { recursive: true });
  const jsonPath = path.join("reports", "legal-launch-readiness.json");
  const csvPath = path.join("reports", "legal-launch-readiness.csv");
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), apply: APPLY, reports }, null, 2) + "\n", "utf8");
  const rows = [
    ["system", "status", "articles", "documents", "blockers", "warnings", "issue_codes"].join(","),
    ...reports.map((r) => [
      r.systemName, r.status, r.articleCount, r.documentCount,
      r.issues.filter((i) => i.severity === "BLOCKER").length,
      r.issues.filter((i) => i.severity === "WARNING").length,
      r.issues.map((i) => i.code).join("|"),
    ].map(csvCell).join(",")),
  ];
  fs.writeFileSync(csvPath, "\ufeff" + rows.join("\n") + "\n", "utf8");

  const ready = reports.filter((r) => r.status === "READY").length;
  const review = reports.filter((r) => r.status === "REVIEW_REQUIRED").length;
  const notReady = reports.filter((r) => r.status === "NOT_READY").length;
  console.log("\nالنتيجة: READY=" + ready + " · REVIEW_REQUIRED=" + review + " · NOT_READY=" + notReady);
  console.log("التقارير: " + jsonPath + " · " + csvPath);
  if (STRICT && ready !== reports.length) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect().catch(() => undefined));
