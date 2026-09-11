import type { DataSourceDefinition, DueDiligenceConnector } from "./core";
import { CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE } from "./cma";
import {
  SAMA_FINANCE_ENTITIES_SOURCE,
  SamaFinanceEntitiesConnector,
} from "./sama";
import { buildPhase2Connectors, phase2SourceCatalog } from "./phase2";

/**
 * Only sources that have a stable runtime path are instantiated here.
 * CMA remains in the catalog but is intentionally not instantiated until its
 * official Open Data API is reachable through an approved stable egress/adapter.
 */
export function buildPhase3Connectors(): DueDiligenceConnector[] {
  return [
    ...buildPhase2Connectors(),
    new SamaFinanceEntitiesConnector(),
  ];
}

export function phase3SourceCatalog(): DataSourceDefinition[] {
  const prior = phase2SourceCatalog();
  const genericRegulator = prior.find((source) => source.key === "saudi_regulatory");
  const concrete = prior.filter((source) => source.key !== "saudi_regulatory");
  return [
    ...concrete,
    { ...SAMA_FINANCE_ENTITIES_SOURCE },
    { ...CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE },
    ...(genericRegulator ? [genericRegulator] : []),
  ];
}
