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
  const prior = phase2SourceCatalog();
  const genericRegulator = prior.find((source) => source.key === "saudi_regulatory");
  const concrete = prior.filter((source) => source.key !== "saudi_regulatory");
  return [
    ...concrete,
    { ...CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE },
    ...(genericRegulator ? [genericRegulator] : []),
  ];
}
