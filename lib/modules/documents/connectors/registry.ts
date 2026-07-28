import { createDirectUrlConnector } from "./direct-url";
import type { DocumentSourceConnector } from "./types";
import { detectProviderFromUrl } from "./provider-detector";

/** سجل الموصلات — PR-2: Direct URL فقط. */
export function getDirectUrlConnector(): DocumentSourceConnector {
  return createDirectUrlConnector();
}

export function resolveConnectorForUrl(url: string): {
  connector: DocumentSourceConnector | null;
  provider: ReturnType<typeof detectProviderFromUrl>;
  deferred: boolean;
} {
  const provider = detectProviderFromUrl(url);
  if (provider === "DIRECT_URL") {
    return { connector: getDirectUrlConnector(), provider, deferred: false };
  }
  // Google/Microsoft/Dropbox/Box مؤجّلة — لا موصل في PR-2
  return { connector: null, provider, deferred: true };
}
