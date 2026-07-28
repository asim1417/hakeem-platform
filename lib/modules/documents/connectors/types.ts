import type { AttachmentSourceProvider } from "@prisma/client";

export interface InspectedDirectFile {
  normalizedUrl: string;
  safeDisplayUrl: string;
  fileName?: string;
  reportedMimeType?: string;
  reportedSize?: number;
  finalHost: string;
  redirects: number;
  warnings: string[];
  requiresAuthentication: boolean;
  accessible: boolean;
  provider: "DIRECT_URL";
}

export interface DownloadedDirectFile {
  temporaryPath: string;
  sha256: string;
  size: number;
  reportedMimeType?: string;
  detectedMimeType: string;
  fileName: string;
}

export type ConnectorInput = {
  url: string;
};

export interface DocumentSourceConnector {
  provider: AttachmentSourceProvider | "DIRECT_URL";
  canHandle(input: { url?: string; externalId?: string }): boolean;
  inspect(input: ConnectorInput): Promise<InspectedDirectFile>;
  download(input: ConnectorInput): Promise<DownloadedDirectFile>;
}
