import type { RasdSourceCode } from "../types";
import { runScan, type ScanResult } from "./orchestrator";

export async function runBaselineScan(options: {
  sources?: RasdSourceCode[];
  dryRun?: boolean;
  fixturesOnly?: boolean;
  limit?: number;
  actorId?: string;
} = {}): Promise<ScanResult> {
  return runScan({
    runType: "BASELINE",
    sources: options.sources,
    dryRun: options.dryRun ?? true,
    fixturesOnly: options.fixturesOnly,
    limit: options.limit,
    actorId: options.actorId
  });
}
