/**
 * منطق ترحيل metadata القديم — قابل للاختبار بلا قاعدة بيانات.
 */
import { decodeLegacyAttachmentPayload } from "@/lib/modules/attachments/attachment-metadata";

export type MigrationRow = {
  id: string;
  fileName: string;
  extractedText: string | null;
  metadata: unknown;
};

export type MigrationDecision =
  | { action: "skip"; reason: "not-legacy-metadata" | "already-migrated" }
  | {
      action: "migrate";
      id: string;
      fileName: string;
      metadataKeys: string[];
      metadata: Record<string, unknown>;
    };

/** قرار ترحيل لسجل واحد — idempotent. */
export function decideAttachmentMetadataMigration(row: MigrationRow): MigrationDecision {
  const decoded = decodeLegacyAttachmentPayload(row.extractedText, row.metadata);
  if (!decoded.legacyMetadataDetected) {
    return { action: "skip", reason: "not-legacy-metadata" };
  }
  // أُفرغ extractedText سابقًا ولا يوجد JSON قديم → لا يُعاد الترحيل.
  if (row.extractedText === null) {
    return { action: "skip", reason: "already-migrated" };
  }
  return {
    action: "migrate",
    id: row.id,
    fileName: row.fileName,
    metadataKeys: Object.keys(decoded.metadata).sort(),
    metadata: decoded.metadata
  };
}
