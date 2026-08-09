/**
 * document-persist.ts — تخزين نتيجة القارئ في شجرة document_units (يربط المرحلة ٢
 * بالمرحلة ١). يُنشئ الوثيقة ثم الوحدات بترتيب القراءة، ويحلّ parentOrdinal → parent_id
 * (الأب يسبق ابنه دومًا في ترتيب القراءة). قابل لإعادة الاستخدام من الاستكمال والكرون.
 *
 * لا يلمس legal_articles. لا يعالج التعديل (سابعًا) — ذلك في طبقة الإدخال (الكرون)
 * التي تقرّر نسخة/حالة الوحدة قبل الاستدعاء. هنا: إدخال وثيقة كاملة كما وردت.
 */
import { prisma } from "@/lib/prisma";
import { parseDocument } from "@/lib/legal-parser";
import type { DocKind } from "@/lib/legal-parser";

export type DbDocType = "ROYAL_DECREE" | "COUNCIL_DECISION" | "AGENCY_DECISION" | "SYSTEM_TEXT" | "BYLAW";

/** DocumentType ⊇ DocKind بنفس القيم النصّية — تحويل مطابق. */
function docTypeToKind(dt: DbDocType): DocKind {
  return dt;
}

export interface PersistResult {
  documentId: string;
  unitCount: number;
  reconstructionOk: boolean;
  warnings: string[];
}

export async function persistParsedDocument(params: {
  systemId: string;
  docType: DbDocType;
  rawText: string;
  number?: string | null;
  hijriDate?: string | null;
  sourceGuid?: string | null;
  sourceUrl?: string | null;
  publishedAt?: Date | null;
}): Promise<PersistResult> {
  const doc = await prisma.legalDocument.create({
    data: {
      systemId: params.systemId,
      docType: params.docType,
      rawText: params.rawText,
      number: params.number ?? null,
      hijriDate: params.hijriDate ?? null,
      sourceGuid: params.sourceGuid ?? null,
      sourceUrl: params.sourceUrl ?? null,
      publishedAt: params.publishedAt ?? null,
    },
  });

  const parsed = parseDocument(params.rawText, { kind: docTypeToKind(params.docType) });
  const idByOrdinal = new Map<number, string>();
  for (const u of parsed.units) {
    const parentId = u.parentOrdinal != null ? idByOrdinal.get(u.parentOrdinal) ?? null : null;
    const created = await prisma.documentUnit.create({
      data: {
        systemId: params.systemId,
        documentId: doc.id,
        parentId,
        unitType: u.type,
        ordinal: u.ordinal,
        labelAr: u.label ?? null,
        number: u.number ?? null,
        textRaw: u.textRaw,
        textNormalized: u.textNormalized,
        path: u.path,
        charStart: u.charStart,
        charEnd: u.charEnd,
        sourceGuid: params.sourceGuid ?? null,
        sourceUrl: params.sourceUrl ?? null,
      },
    });
    idByOrdinal.set(u.ordinal, created.id);
  }

  return {
    documentId: doc.id,
    unitCount: parsed.units.length,
    reconstructionOk: parsed.reconstructionOk,
    warnings: parsed.warnings,
  };
}
