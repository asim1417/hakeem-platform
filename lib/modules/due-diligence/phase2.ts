import type { DataSourceDefinition, DueDiligenceConnector } from "./core";
import { buildConfiguredConnectors, dueDiligenceSourceCatalog } from "./connectors";
import {
  HAKEEM_PUBLISHED_JUDGMENTS_SOURCE,
  HakeemPublishedJudgmentsConnector,
} from "./judgments";

/**
 * Phase 2 sources that are native to Hakim and do not depend on an external
 * adapter URL. Keeping them separate makes rollout/reversal explicit.
 */
export function buildPhase2Connectors(): DueDiligenceConnector[] {
  return [...buildConfiguredConnectors(), new HakeemPublishedJudgmentsConnector()];
}

export function phase2SourceCatalog(): DataSourceDefinition[] {
  return [...dueDiligenceSourceCatalog(), { ...HAKEEM_PUBLISHED_JUDGMENTS_SOURCE }];
}
