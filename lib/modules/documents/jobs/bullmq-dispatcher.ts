import type { DocumentJobDispatcher, DocumentJobPayload, DocumentJobType } from "./types";

/**
 * هيكل BullMQ — يتطلب Redis. لا يدّعي نجاحًا دون عميل مُهيأ.
 */
export class BullMqDocumentJobDispatcher implements DocumentJobDispatcher {
  async dispatch(_type: DocumentJobType, _payload: DocumentJobPayload): Promise<{ jobId: string }> {
    throw new Error("BullMqDocumentJobDispatcher يتطلب Redis وتهيئة Queue — غير موصول في هذه المرحلة.");
  }
}
