import type { RasdSourceCode } from "../types";
import { runScan, type ScanResult } from "./orchestrator";

export interface WeeklyScanResult {
  quick: ScanResult;
  deep?: ScanResult;
}

export async function runWeeklyScan(options: {
  sources?: RasdSourceCode[];
  dryRun?: boolean;
  fixturesOnly?: boolean;
  actorId?: string;
} = {}): Promise<WeeklyScanResult> {
  const quick = await runScan({
    runType: "WEEKLY",
    sources: options.sources,
    dryRun: options.dryRun ?? true,
    fixturesOnly: options.fixturesOnly,
    limit: 25,
    actorId: options.actorId
  });

  const changedSources = quick.sources.filter((source) => source.changed > 0).map((source) => source.sourceCode);
  if (changedSources.length === 0 || quick.status === "FAILED") return { quick };

  const deep = await runScan({
    runType: "WEEKLY",
    sources: changedSources as RasdSourceCode[],
    dryRun: options.dryRun ?? true,
    fixturesOnly: options.fixturesOnly,
    limit: 100,
    actorId: options.actorId
  });
  return { quick, deep };
}
