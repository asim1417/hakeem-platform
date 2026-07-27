import type { RasdSourceCode } from "../types";
import type { RasdConnector } from "./base";
import { BoeConnector } from "./boe";
import { NcarConnector } from "./ncar";
import { UqnConnector } from "./uqn";

export const allConnectors: RasdConnector[] = [new BoeConnector(), new NcarConnector(), new UqnConnector()];

export function listConnectors(): RasdConnector[] {
  return [...allConnectors];
}

export function getConnector(code: RasdSourceCode): RasdConnector {
  const connector = allConnectors.find((item) => item.code === code);
  if (!connector) throw new Error(`Unsupported Rasd connector: ${code}`);
  return connector;
}

export * from "./base";
export * from "./boe";
export * from "./ncar";
export * from "./uqn";
