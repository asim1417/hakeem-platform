import { listConnectors } from "./connectors";

export interface RasdSourceHealth {
  sourceCode: string;
  ok: boolean;
  status?: number;
  error?: string;
  checkedAt: string;
}

export async function healthCheckAllSources(): Promise<RasdSourceHealth[]> {
  return Promise.all(
    listConnectors().map(async (connector) => {
      try {
        const result = await connector.healthCheck();
        return {
          sourceCode: connector.code,
          ok: result.ok,
          status: result.status,
          error: result.error,
          checkedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          sourceCode: connector.code,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          checkedAt: new Date().toISOString()
        };
      }
    })
  );
}
