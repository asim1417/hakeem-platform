import type { RasdSourceCode } from "../types";

export interface SourceHealthResult {
  ok: boolean;
  status?: number | null;
  error?: string;
  /** High-level reachability classification for orchestration. */
  outcome?: "SUCCEEDED" | "FAILED" | "UNREACHABLE" | "DEGRADED" | "SKIPPED";
  checkedAt?: string;
}

export interface DiscoveryOptions {
  since?: Date;
  limit?: number;
  sitemapUrl?: string;
  indexUrl?: string;
  fixturePath?: string;
  fixturesOnly?: boolean;
}

export type { RasdSourceCode };
