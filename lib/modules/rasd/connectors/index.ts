import type { RasdSourceCode } from "../types";
import { isRasdSourceEnabled } from "../flags";
import type { LegislativeSourceConnector, RasdConnector } from "./base";
import { BoeConnector } from "./boe";
import { NcarConnector } from "./ncar";
import { UqnConnector } from "./uqn";
import { getConnectorStatus, listConnectorStatuses } from "./status";

export const allConnectors: LegislativeSourceConnector[] = [
  new BoeConnector(),
  new NcarConnector(),
  new UqnConnector()
];

export function listConnectors(): LegislativeSourceConnector[] {
  return [...allConnectors];
}

export function listEnabledConnectors(): LegislativeSourceConnector[] {
  return allConnectors.filter((connector) => isRasdSourceEnabled(connector.code));
}

export function getConnector(code: RasdSourceCode): LegislativeSourceConnector {
  const connector = allConnectors.find((item) => item.code === code);
  if (!connector) throw new Error(`Unsupported Rasd connector: ${code}`);
  return connector;
}

export function describeConnector(code: RasdSourceCode) {
  const status = getConnectorStatus(code);
  return {
    ...status,
    enabled: isRasdSourceEnabled(code),
    connectorPresent: true
  };
}

export function describeAllConnectors() {
  return listConnectorStatuses().map((status) => ({
    ...status,
    enabled: isRasdSourceEnabled(status.code),
    connectorPresent: true
  }));
}

export type { LegislativeSourceConnector, RasdConnector };
export * from "./base";
export * from "./contract";
export * from "./status";
export * from "./boe";
export * from "./ncar";
export * from "./uqn";
