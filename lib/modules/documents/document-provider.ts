// عقد محرّك المستندات الموحّد — المخطط السيادي §11. مزوّد قابل للاستبدال،
// لا جزء صلب من النواة. القدرات مُعلَنة؛ غير المدعوم يرمي NotSupportedError.

export type DocCapability =
  | "inspectDocument"
  | "importStructure"
  | "renderPreview"
  | "applyOperations"
  | "validateDocument"
  | "exportDocument";

export type ExportFormat = "text" | "html" | "docx" | "pdf";

export interface DocumentInspection {
  fileName?: string;
  mimeType?: string;
  pageCount?: number;
  warnings: string[];
}
export interface ValidationReport {
  ok: boolean;
  issues: string[];
}
export interface ExportResult {
  format: ExportFormat;
  bytes?: Buffer;
  text?: string;
}

export class DocNotSupportedError extends Error {
  constructor(op: DocCapability, provider: string) {
    super(`العملية «${op}» غير مدعومة في مزوّد المستندات «${provider}».`);
    this.name = "DocNotSupportedError";
  }
}

export interface DocumentProvider {
  readonly name: string;
  readonly capabilities: DocCapability[];
  inspectDocument?(input: { fileName?: string; mimeType?: string; bytes?: Buffer }): Promise<DocumentInspection>;
  importStructure?(input: unknown): Promise<unknown>;
  renderPreview?(input: unknown): Promise<unknown>;
  applyOperations?(input: unknown): Promise<unknown>;
  validateDocument?(input: { fileName?: string; mimeType?: string }): Promise<ValidationReport>;
  exportDocument?(input: { session: unknown; type: string; format: ExportFormat }): Promise<ExportResult>;
}

export function docSupports(p: DocumentProvider, cap: DocCapability): boolean {
  return p.capabilities.includes(cap);
}
