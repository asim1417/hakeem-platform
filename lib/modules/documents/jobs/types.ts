export type DocumentJobType =
  | "DOCUMENT_IMPORTED"
  | "MALWARE_SCAN"
  | "EXTRACT_TEXT"
  | "QUALITY_CHECK"
  | "CLEANUP_TEMP_FILE";

export interface DocumentJobPayload {
  attachmentId: string;
  userId: string;
  correlationId: string;
  attempt?: number;
  tempPath?: string;
}

export interface DocumentJobDispatcher {
  dispatch(type: DocumentJobType, payload: DocumentJobPayload): Promise<{ jobId: string }>;
}
