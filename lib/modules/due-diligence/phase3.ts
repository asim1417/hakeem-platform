import type { DataSourceDefinition, DueDiligenceConnector } from "./core";
import {
  CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE,
  CmaCapitalMarketInstitutionsConnector,
} from "./cma";
import { buildPhase2Connectors, phase2SourceCatalog } from "./phase2";

export function buildPhase3Connectors(): DueDiligenceConnector[] {
  return [...buildPhase2Connectors(), new CmaCapitalMarketInstitutionsConnector()];
}

export function phase3SourceCatalog(): DataSourceDefinition[] {
  return [...phase2SourceCatalog(), { ...CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE }];
}
