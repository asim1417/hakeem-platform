import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { isEmailConfigured, sendEmail } from "@/lib/modules/email/send";
import type { ScanResult } from "../scan/orchestrator";

export interface WeeklyDigest {
  generatedAt: string;
  subject: string;
  urgent: boolean;
  urgentFlags: string[];
  summary: {
    runId: string;
    status: string;
    documentsDiscovered: number;
    documentsChanged: number;
    documentsFailed: number;
    conflictsFound: number;
  };
  sources: ScanResult["sources"];
  failures: string[];
}

function recipientList(): string[] {
  return (process.env.RASD_DIGEST_TO || process.env.ADMIN_ALERT_EMAILS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function digestHtml(digest: WeeklyDigest): string {
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
      <h1>ملخص رصد الأسبوعي</h1>
      <p><strong>الحالة:</strong> ${digest.summary.status}</p>
      <p><strong>التغييرات:</strong> ${digest.summary.documentsChanged} — <strong>التعارضات:</strong> ${digest.summary.conflictsFound}</p>
      ${digest.urgent ? `<p style="color:#9f1239"><strong>تنبيهات عاجلة:</strong> ${digest.urgentFlags.join(", ")}</p>` : ""}
      <ul>
        ${digest.sources.map((source) => `<li>${source.sourceCode}: مكتشف ${source.discovered}، متغير ${source.changed}، فشل ${source.failed}</li>`).join("")}
      </ul>
    </div>
  `;
}

export async function buildWeeklyDigest(scanResult: ScanResult): Promise<WeeklyDigest> {
  const urgentFlags = [...scanResult.urgentFlags];
  if (scanResult.changes.some((change) => change.changeType === "REPEAL" || change.changeType === "ARTICLE_REPEALED")) {
    urgentFlags.push("REPEALED");
  }
  if (scanResult.conflicts.some((conflict) => conflict.severity === "CRITICAL")) urgentFlags.push("CRITICAL_CONFLICT");
  if (scanResult.sources.length > 0 && scanResult.sources.every((source) => !source.ok)) urgentFlags.push("ALL_SOURCES_FAILED");

  const uniqueFlags = [...new Set(urgentFlags)];
  const digest: WeeklyDigest = {
    generatedAt: new Date().toISOString(),
    subject: uniqueFlags.length ? "رصد: تنبيه عاجل في تحديثات الأنظمة" : "رصد: ملخص التحديثات الأسبوعي",
    urgent: uniqueFlags.length > 0,
    urgentFlags: uniqueFlags,
    summary: {
      runId: scanResult.runId,
      status: scanResult.status,
      documentsDiscovered: scanResult.counts.documentsDiscovered,
      documentsChanged: scanResult.counts.documentsChanged,
      documentsFailed: scanResult.counts.documentsFailed,
      conflictsFound: scanResult.counts.conflictsFound
    },
    sources: scanResult.sources,
    failures: scanResult.failures
  };

  const recipients = recipientList();
  if (isEmailConfigured() && recipients.length > 0) {
    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: digest.subject,
          html: digestHtml(digest),
          text: JSON.stringify(digest.summary)
        })
      )
    );
    return digest;
  }

  const dir = path.join(process.cwd(), "reports/rasd");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "last-digest.json"), JSON.stringify(digest, null, 2), "utf8");
  return digest;
}
