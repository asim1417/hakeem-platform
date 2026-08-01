import "server-only";

// مزوّد مستندات يلفّ مُصدِّر المحاكاة القائم خلف عقد §11 (قدرتا validate + export).
import {
  buildSimulationExport,
  toText,
  toHtml,
} from "@/lib/modules/exports/legal-documents";
import type {
  DocumentProvider,
  ValidationReport,
  ExportResult,
  ExportFormat,
} from "./document-provider";

const SUPPORTED_FORMATS: ExportFormat[] = ["text", "html"];

export function createSimulationDocumentProvider(): DocumentProvider {
  return {
    name: "simulation-export",
    capabilities: ["validateDocument", "exportDocument"],

    async validateDocument(input): Promise<ValidationReport> {
      const issues: string[] = [];
      if (!input.fileName) issues.push("اسم الملف مفقود");
      return { ok: issues.length === 0, issues };
    },

    async exportDocument(input): Promise<ExportResult> {
      const payload = buildSimulationExport(input.session as never, input.type);
      // toText/toHtml يعيدان Buffer (UTF-8). نعيد bytes + نصًّا مقروءًا.
      if (input.format === "html") {
        const buf = toHtml(payload);
        return { format: "html", bytes: buf, text: buf.toString("utf8") };
      }
      // بقيّة الصيغ في هذه الطبقة الخفيفة تعود نصًّا (docx/pdf عبر مسار التصدير الكامل).
      const buf = toText(payload);
      const format: ExportFormat = SUPPORTED_FORMATS.includes(input.format) ? input.format : "text";
      return { format, bytes: buf, text: buf.toString("utf8") };
    },
  };
}
