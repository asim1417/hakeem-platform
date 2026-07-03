import referenceJson from "@/data/legal-document-reference.json";
import type { LegalDocumentReference } from "./types";

// المرجع التشغيلي لتصنيف وترميز المستندات — طبقة بيانات قابلة للتحديث دون لمس الشيفرة.
// تنبيه حاكم: مرجع تنظيمي مساعد يحتاج مراجعة قانونية، وليس تنظيماً رسمياً.
export const legalDocumentReference = referenceJson as unknown as LegalDocumentReference;

/** فحص اتساق المرجع — مكافئ validate() في reference_classify.py */
export function validateReference(ref: LegalDocumentReference = legalDocumentReference): string[] {
  const errors: string[] = [];
  const typeCodes = new Set(ref.doc_types.map((d) => d.code));
  const issuerCodes = new Set(ref.issuers.map((i) => i.code));

  for (const docType of ref.doc_types) {
    for (const issuerCode of docType.typical_issuers) {
      if (!issuerCodes.has(issuerCode)) {
        errors.push(`نوع ${docType.code}: جهة غير معرّفة ${issuerCode}`);
      }
    }
  }
  for (const stage of ref.lifecycle) {
    for (const output of stage.outputs) {
      if (!typeCodes.has(output)) {
        errors.push(`مرحلة ${stage.name}: نوع غير معرّف ${output}`);
      }
    }
  }
  if (typeCodes.size !== ref.doc_types.length) {
    errors.push("رموز أنواع مكرّرة");
  }
  return errors;
}

/** فئات المكنز الفعلية (باستبعاد حقل التوثيق _note) */
export function thesaurusCategories(
  ref: LegalDocumentReference = legalDocumentReference
): Array<{ category: string; terms: string[] }> {
  return Object.entries(ref.thesaurus)
    .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
    .map(([category, terms]) => ({ category, terms }));
}
