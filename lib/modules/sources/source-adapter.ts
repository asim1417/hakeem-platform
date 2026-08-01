// عقد المصادر الموحّد — المخطط السيادي §9. واجهة واحدة لكل مصدر خارجيّ.
// لا يستبدل الموصلات القائمة؛ يوحّد الإشارة إليها. القدرات مُعلَنة صراحةً،
// والعمليات غير المدعومة ترمي NotSupportedError (لا اختلاق نتائج).

export type SourceCapability =
  | "discover"
  | "fetchMetadata"
  | "fetchManifest"
  | "fetchText"
  | "fetchPages"
  | "fetchUpdates"
  | "resolveRights"
  | "verifyIntegrity";

export interface SourceItem {
  id: string;
  title?: string;
  url?: string;
}
export interface SourceMetadata {
  id: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  accessible: boolean;
  warnings?: string[];
}
export interface SourceManifest {
  id: string;
  parts: Array<{ id: string; kind: string }>;
}
export interface TextPayload {
  id: string;
  text: string;
}
export interface PagePayload {
  page: number;
  text: string;
}
export interface UpdateBatch {
  cursor: string | null;
  items: SourceItem[];
}
export interface RightsDecision {
  allowed: boolean;
  reason: string;
}
export interface IntegrityReport {
  ok: boolean;
  sha256?: string;
  detail?: string;
}

export class NotSupportedError extends Error {
  constructor(op: SourceCapability, provider: string) {
    super(`العملية «${op}» غير مدعومة في مصدر «${provider}».`);
    this.name = "NotSupportedError";
  }
}

/** عقد المصدر الموحّد (§9). كل عملية اختيارية عمليًّا عبر capabilities. */
export interface SourceAdapter {
  readonly provider: string;
  readonly capabilities: SourceCapability[];
  discover?(query: { q?: string }): Promise<SourceItem[]>;
  fetchMetadata?(id: string): Promise<SourceMetadata>;
  fetchManifest?(id: string): Promise<SourceManifest>;
  fetchText?(id: string): Promise<TextPayload>;
  fetchPages?(id: string): Promise<PagePayload[]>;
  fetchUpdates?(cursor?: string): Promise<UpdateBatch>;
  resolveRights?(id: string): Promise<RightsDecision>;
  verifyIntegrity?(payload: unknown): Promise<IntegrityReport>;
}

export function supports(adapter: SourceAdapter, cap: SourceCapability): boolean {
  return adapter.capabilities.includes(cap);
}
