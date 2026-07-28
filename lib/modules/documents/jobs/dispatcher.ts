import { isDocumentQueueEnabled } from "@/lib/modules/documents/document-limits";
import { BullMqDocumentJobDispatcher } from "./bullmq-dispatcher";
import { InlineDocumentJobDispatcher } from "./inline-dispatcher";
import type { DocumentJobDispatcher, DocumentJobPayload, DocumentJobType } from "./types";

let singleton: DocumentJobDispatcher | null = null;

/**
 * BullMQ يُفعَّل فقط عند DOCUMENT_QUEUE_ENABLED + Redis + DOCUMENT_BULLMQ_WIRED=true.
 * وإلا Inline — لا يدّعي تنفيذ خلفية Serverless دون Queue حقيقي.
 */
export function getDocumentJobDispatcher(): DocumentJobDispatcher {
  if (singleton) return singleton;
  const redis = process.env.REDIS_URL || process.env.DOCUMENT_REDIS_URL;
  const bullWired = process.env.DOCUMENT_BULLMQ_WIRED === "true" || process.env.DOCUMENT_BULLMQ_WIRED === "1";
  if (isDocumentQueueEnabled() && redis && bullWired) {
    singleton = new BullMqDocumentJobDispatcher();
  } else {
    singleton = new InlineDocumentJobDispatcher();
  }
  return singleton;
}

export function __setDocumentJobDispatcherForTests(d: DocumentJobDispatcher | null): void {
  singleton = d;
}

export async function dispatchDocumentJob(
  type: DocumentJobType,
  payload: DocumentJobPayload
): Promise<{ jobId: string; mode: "inline" | "queue" }> {
  const redis = process.env.REDIS_URL || process.env.DOCUMENT_REDIS_URL;
  const bullWired = process.env.DOCUMENT_BULLMQ_WIRED === "true" || process.env.DOCUMENT_BULLMQ_WIRED === "1";
  const mode =
    isDocumentQueueEnabled() && redis && bullWired ? "queue" : "inline";
  const job = await getDocumentJobDispatcher().dispatch(type, payload);
  return { ...job, mode };
}

export type { DocumentJobDispatcher, DocumentJobPayload, DocumentJobType };
