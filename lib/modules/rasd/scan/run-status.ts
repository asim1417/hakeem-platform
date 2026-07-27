import type { RasdRunStatus, RasdSourceCode } from "../types";
import type { SourceRunOutcome } from "../connectors/status";

export interface SourceOutcomeSummary {
  sourceCode: RasdSourceCode;
  outcome: SourceRunOutcome;
  ok: boolean;
  discovered?: number;
  fetched?: number;
  failed?: number;
  error?: string;
}

/**
 * Aggregate per-source outcomes into a run status.
 * Success of one source must not be discarded when another fails.
 */
export function resolveRunStatus(sources: SourceOutcomeSummary[]): {
  status: Extract<RasdRunStatus, "COMPLETED" | "PARTIAL" | "FAILED" | "DEGRADED" | "SKIPPED">;
  succeeded: RasdSourceCode[];
  failed: RasdSourceCode[];
  skipped: RasdSourceCode[];
  unreachable: RasdSourceCode[];
} {
  const succeeded: RasdSourceCode[] = [];
  const failed: RasdSourceCode[] = [];
  const skipped: RasdSourceCode[] = [];
  const unreachable: RasdSourceCode[] = [];
  const degraded: RasdSourceCode[] = [];

  for (const source of sources) {
    switch (source.outcome) {
      case "SUCCEEDED":
      case "PARTIAL":
        succeeded.push(source.sourceCode);
        break;
      case "SKIPPED":
        skipped.push(source.sourceCode);
        break;
      case "UNREACHABLE":
        unreachable.push(source.sourceCode);
        failed.push(source.sourceCode);
        break;
      case "DEGRADED":
        degraded.push(source.sourceCode);
        failed.push(source.sourceCode);
        break;
      case "FAILED":
      default:
        failed.push(source.sourceCode);
        break;
    }
  }

  if (sources.length === 0 || (succeeded.length === 0 && failed.length === 0 && skipped.length > 0)) {
    return { status: "SKIPPED", succeeded, failed, skipped, unreachable };
  }
  if (succeeded.length > 0 && failed.length > 0) {
    return { status: "PARTIAL", succeeded, failed, skipped, unreachable };
  }
  if (succeeded.length === 0 && failed.length > 0) {
    const onlyUnreachable =
      unreachable.length === failed.length && degraded.length === 0 && succeeded.length === 0;
    return {
      status: onlyUnreachable && skipped.length === 0 ? "FAILED" : "FAILED",
      succeeded,
      failed,
      skipped,
      unreachable
    };
  }
  if (degraded.length > 0 && succeeded.length === 0) {
    return { status: "DEGRADED", succeeded, failed, skipped, unreachable };
  }
  return { status: "COMPLETED", succeeded, failed, skipped, unreachable };
}

export function classifySourceFailure(error?: string): SourceRunOutcome {
  const text = (error ?? "").toLowerCase();
  if (!text) return "FAILED";
  if (
    text.includes("econnreset") ||
    text.includes("tls") ||
    text.includes("handshake") ||
    text.includes("unreachable") ||
    text.includes("enotfound") ||
    text.includes("etimedout") ||
    text.includes("network")
  ) {
    return "UNREACHABLE";
  }
  if (text.includes("degraded")) return "DEGRADED";
  return "FAILED";
}
