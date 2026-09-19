/**
 * تدقيق شامل لاكتمال حزمة كل نظام.
 * هذا الملف استُبدل بالبوابة الجديدة: لا يعتبر النظام كاملاً لمجرد وجود تمهيد وأداة إصدار.
 * يفحص تسلسل المواد + النص الرسمي + المرسوم بكامل وحداته + قرار مجلس الوزراء المشار إليه + المصدر والبصمة.
 */
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { auditSystemReadiness } from "@/lib/modules/legal-core/system-readiness";

function cell(v: unknown) {
  const s = String(v ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return /[",]/.test(s) ? '"' + s + '"' : s;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || /@localhost|@127\.0\.0\.1/.test(url)) {
    console.log("⏭️  تخطّي: لا DATABASE_URL حيّ — الحصر يحتاج قاعدة.");
    return;
  }

  const systems = await prisma.legalSystem.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows: unknown[][] = [];
  let ready = 0, review = 0, notReady = 0;
  for (const s of systems) {
    const report = await auditSystemReadiness(s.id);
    if (report.status === "READY") ready++;
    else if (report.status === "REVIEW_REQUIRED") review++;
    else notReady++;
    rows.push([
      s.id,
      s.name,
      report.status,
      report.articleCount,
      report.documentCount,
      report.issues.filter((i) => i.severity === "BLOCKER").length,
      report.issues.filter((i) => i.severity === "WARNING").length,
      report.councilDecisionRefs.map((r) => r.number).join("|"),
      report.issues.map((i) => i.code).join("|"),
    ]);
    console.log((report.status === "READY" ? "✅" : report.status === "REVIEW_REQUIRED" ? "⚠️" : "❌") + " " + s.name + " — " + report.status);
  }

  fs.mkdirSync("reports", { recursive: true });
  const out = "reports/legal-completeness-audit.csv";
  const header = ["system_id","name","launch_status","articles","documents","blockers","warnings","cabinet_decisions","issue_codes"];
  fs.writeFileSync(out, "\ufeff" + [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n", "utf8");

  console.log("\nالأنظمة: " + systems.length);
  console.log("READY=" + ready + " | REVIEW_REQUIRED=" + review + " | NOT_READY=" + notReady);
  console.log("التقرير: " + out);
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect().catch(() => undefined));
