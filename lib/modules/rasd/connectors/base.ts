import type { ConnectorDiscoverOptions, ConnectorDiscoverResult, ConnectorFetchOptions, FetchResult, RasdSourceCode } from "../types";

export interface RasdConnector {
  code: RasdSourceCode;
  discover(opts?: ConnectorDiscoverOptions): Promise<ConnectorDiscoverResult>;
  fetchDocument(url: string, opts?: ConnectorFetchOptions): Promise<FetchResult>;
  healthCheck(): Promise<{ ok: boolean; status?: number; error?: string }>;
}
