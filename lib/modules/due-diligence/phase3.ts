import type { DataSourceDefinition, DueDiligenceConnector } from "./core";
import { CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE } from "./cma";
import { CST_IOT_ENTITIES_SOURCE, CstIotEntitiesConnector } from "./cst";
import { NCEC_QUALIFIED_AGENCIES_SOURCE } from "./ncec";
import { SASO_CONFORMITY_BODIES_SOURCE, SasoConformityBodiesConnector } from "./saso";
import { SFDA_LICENSED_ESTABLISHMENTS_SOURCE, SfdaLicensedEstablishmentsConnector } from "./sfda";
import {
  SAMA_FINANCE_ENTITIES_SOURCE,
  SamaFinanceEntitiesConnector,
} from "./sama";
import { buildPhase2Connectors, phase2SourceCatalog } from "./phase2";

/**
 * Only sources with a stable public/runtime path are instantiated here.
 * CMA and NCEC remain catalogued but are intentionally not instantiated until
 * their official data can be consumed through a stable approved server path.
 */
export function buildPhase3Connectors(): DueDiligenceConnector[] {
  return [
    ...buildPhase2Connectors(),
    new SamaFinanceEntitiesConnector(),
    new SfdaLicensedEstablishmentsConnector(),
    new CstIotEntitiesConnector(),
    new SasoConformityBodiesConnector(),
  ];
}

export function phase3SourceCatalog(): DataSourceDefinition[] {
  const prior = phase2SourceCatalog();
  const genericRegulator = prior.find((source) => source.key === "saudi_regulatory");
  const concrete = prior.filter((source) => source.key !== "saudi_regulatory");
  return [
    ...concrete,
    { ...SAMA_FINANCE_ENTITIES_SOURCE },
    { ...SFDA_LICENSED_ESTABLISHMENTS_SOURCE },
    { ...CST_IOT_ENTITIES_SOURCE },
    { ...SASO_CONFORMITY_BODIES_SOURCE },
    { ...NCEC_QUALIFIED_AGENCIES_SOURCE, status: "REVIEW_REQUIRED" },
    { ...CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE },
    ...(genericRegulator ? [genericRegulator] : []),
  ];
}
