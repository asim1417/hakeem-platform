/**
 * Staging/ops alerts for Rasd — summary only, never full legal text.
 * Supports webhook URL and/or file sink. Secrets never logged.
 */
import { mkdirSync, appendFileSync } from "fs";
import path from "path";
import { listCircuits } from "../connectors/circuit-breaker";

export type RasdAlertKind =
  | "SOURCE_FAILURE"
  | "CIRCUIT_OPEN"
  | "CRON_FAILURE"
  | "NEW_DOCUMENT"
  | "SOURCE_CONFLICT"
  | "WORKER_HEARTBEAT";

export interface RasdAlertPayload {
  kind: RasdAlertKind;
  severity: "info" | "warning" | "critical";
  title: string;
  summary: string;
  adminPath?: string;
  sourceCode?: string;
  runId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

function webhookUrl(): string | undefined {
  const url = process.env.RASD_ALERT_WEBHOOK_URL?.trim();
  return url || undefined;
}

function fileSinkEnabled(): boolean {
  return process.env.RASD_ALERT_FILE_SINK !== "false";
}

export async function sendRasdAlert(payload: RasdAlertPayload): Promise<{ ok: boolean; channel: string; error?: string }> {
  const envelope = {
    ts: new Date().toISOString(),
    service: "hakeem-rasd",
    environment: process.env.RASD_ENVIRONMENT || process.env.VERCEL_ENV || "unknown",
    ...payload,
    adminUrlHint: payload.adminPath ? `/admin/rasd${payload.adminPath.startsWith("/") ? payload.adminPath : `/${payload.adminPath}`}` : "/admin/rasd/health"
  };

  // Never include secrets
  const safe = JSON.parse(JSON.stringify(envelope, (key, value) => {
    if (/secret|password|token|database_url|authorization/i.test(key)) return "[redacted]";
    return value;
  }));

  if (fileSinkEnabled()) {
    const dir = path.join(process.cwd(), "reports", "rasd");
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "alerts.jsonl"), `${JSON.stringify(safe)}\n`, "utf8");
  }

  const hook = webhookUrl();
  if (!hook) {
    return { ok: true, channel: "file-sink-only" };
  }

  try {
    const response = await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Hakeem-Rasd-Alert/1.0" },
      body: JSON.stringify(safe)
    });
    if (!response.ok) {
      return { ok: false, channel: "webhook", error: `HTTP ${response.status}` };
    }
    return { ok: true, channel: "webhook+file" };
  } catch (error) {
    return { ok: false, channel: "webhook", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function alertCircuitStates(): Promise<void> {
  for (const circuit of listCircuits()) {
    if (circuit.state === "OPEN") {
      await sendRasdAlert({
        kind: "CIRCUIT_OPEN",
        severity: "warning",
        title: `Circuit open: ${circuit.sourceCode}`,
        summary: `Source ${circuit.sourceCode} circuit is OPEN after ${circuit.failures} failures.`,
        sourceCode: circuit.sourceCode,
        adminPath: "/health",
        metadata: { failures: circuit.failures, lastError: circuit.lastError?.slice(0, 200) ?? null }
      });
    }
  }
}
