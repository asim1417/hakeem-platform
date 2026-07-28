import { describeAllConnectors, listConnectors } from "./connectors";
import { getConnectorStatus } from "./connectors/status";
import { isRasdSourceEnabled } from "./flags";

export interface RasdSourceHealth {
  sourceCode: string;
  displayName: string;
  ok: boolean;
  status?: number | null;
  error?: string;
  outcome?: string;
  checkedAt: string;
  /** Registry certification — never claim LIVE for unverified sources. */
  implementation: string;
  live: string;
  certification: string;
  enabled: boolean;
  liveDocumentsVerified: number | null;
  notLiveReason: string | null;
  notes: string[];
}

export async function healthCheckAllSources(): Promise<RasdSourceHealth[]> {
  const registry = describeAllConnectors();
  return Promise.all(
    listConnectors().map(async (connector) => {
      const meta = getConnectorStatus(connector.code);
      const enabled = isRasdSourceEnabled(connector.code);
      const base = {
        sourceCode: connector.code,
        displayName: connector.displayName,
        implementation: meta.implementation,
        live: meta.live,
        certification: meta.certification,
        enabled,
        liveDocumentsVerified: meta.liveDocumentsVerified,
        notLiveReason: meta.notLiveReason,
        notes: meta.notes,
        checkedAt: new Date().toISOString()
      };

      if (!enabled) {
        return {
          ...base,
          ok: false,
          outcome: "SKIPPED",
          error: `source disabled (${meta.flagName}=false)`
        };
      }

      try {
        const result = await connector.healthCheck();
        return {
          ...base,
          ok: result.ok,
          status: result.status,
          error: result.error,
          outcome: result.outcome ?? (result.ok ? "SUCCEEDED" : "FAILED")
        };
      } catch (error) {
        return {
          ...base,
          ok: false,
          outcome: "FAILED",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  ).then((rows) => {
    // Preserve registry order honesty even if a probe throws.
    void registry;
    return rows;
  });
}
