import { randomUUID } from "node:crypto";
import type { DocumentJobDispatcher, DocumentJobPayload, DocumentJobType } from "./types";

type Handler = (type: DocumentJobType, payload: DocumentJobPayload) => Promise<void>;

const inFlight = new Set<string>();

/**
 * منفّذ متزامن للتطوير/الاختبارات فقط.
 * لا يستخدم setTimeout بعد انتهاء الطلب — ينفّذ فورًا أو يسجّل فقط.
 */
export class InlineDocumentJobDispatcher implements DocumentJobDispatcher {
  constructor(private readonly handler?: Handler) {}

  async dispatch(type: DocumentJobType, payload: DocumentJobPayload): Promise<{ jobId: string }> {
    const dedupeKey = `${type}:${payload.attachmentId}:${payload.attempt ?? 1}`;
    if (inFlight.has(dedupeKey)) {
      return { jobId: `deduped:${dedupeKey}` };
    }
    const jobId = randomUUID();
    inFlight.add(dedupeKey);
    try {
      if (this.handler) {
        await this.handler(type, { ...payload, attempt: payload.attempt ?? 1 });
      }
    } finally {
      inFlight.delete(dedupeKey);
    }
    return { jobId };
  }
}

export function __resetInlineJobsForTests(): void {
  inFlight.clear();
}
