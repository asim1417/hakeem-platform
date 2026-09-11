import type { DataSourceDefinition, DueDiligenceConnector } from "./core";
import {
  CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE,
  CmaCapitalMarketInstitutionsConnector,
} from "./cma";
import {
  SAMA_FINANCE_ENTITIES_SOURCE,
  SamaFinanceEntitiesConnector,
} from "./sama";
import { buildPhase2Connectors, phase2SourceCatalog } from "./phase2";

export function buildPhase3Connectors(): DueDiligenceConnector[] {
  return [
    ...buildPhase2Connectors(),
    new CmaCapitalMarketInstitutionsConnector(),
    new SamaFinanceEntitiesConnector(),
  ];
}

export function phase3SourceCatalog(): DataSourceDefinition[] {
  const prior = phase2SourceCatalog();
  const genericRegulator = prior.find((source) => source.key === "saudi_regulatory");
  const concrete = prior.filter((source) => source.key !== "saudi_regulatory");
  return [
    ...concrete,
    { ...CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE },
    { ...SAMA_FINANCE_ENTITIES_SOURCE },
    ...(genericRegulator ? [genericRegulator] : []),
  ];
}
