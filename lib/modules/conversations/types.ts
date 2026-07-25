import { z } from "zod";

export const CONVERSATION_SERVICES = ["ask", "judicial-assistant", "legal-chat"] as const;
export type ConversationService = (typeof CONVERSATION_SERVICES)[number];

export const CONVERSATION_STATUSES = ["active", "processing", "error"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_STATUSES = ["pending", "streaming", "completed", "failed", "cancelled"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system", "tool"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const conversationServiceSchema = z.enum(CONVERSATION_SERVICES);

export const messageAttachmentRefSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  extractedText: z.string().optional(),
  storageKey: z.string().optional(),
  processingStatus: z.enum(["inline", "pending", "ready", "failed"]).optional(),
});

export type MessageAttachmentRef = z.infer<typeof messageAttachmentRefSchema>;

export const retrievedSourceSchema = z.object({
  kind: z.enum(["article", "ruling", "principle", "document", "other"]),
  id: z.string().optional(),
  systemName: z.string().optional(),
  articleNumber: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  quote: z.string().optional(),
  url: z.string().optional(),
  score: z.number().optional(),
});

export type RetrievedSource = z.infer<typeof retrievedSourceSchema>;

export type ConversationListItem = {
  id: string;
  title: string;
  generatedTitle: string | null;
  serviceKey: ConversationService;
  mode: string;
  status: string;
  preview: string | null;
  updatedAt: string;
  createdAt: string;
  pinnedAt: string | null;
  archivedAt: string | null;
  judicialCaseId: string | null;
  caseFileId: string | null;
  messageCount: number;
  parentConversationId: string | null;
};

export type ConversationContext = {
  conversationId: string;
  serviceKey: ConversationService;
  mode: string;
  title: string;
  generatedTitle: string | null;
  status: string;
  summary: string | null;
  state: unknown;
  judicialCaseId: string | null;
  caseFileId: string | null;
  parentConversationId: string | null;
  branchFromMessageId: string | null;
  contextVersion: number;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    sequence: number;
    status: string;
    mode: string | null;
    model: string | null;
    clientRequestId: string | null;
    attachments: unknown;
    retrievedSources: unknown;
    warnings: unknown;
    inputSnapshot: unknown;
    outputSnapshot: unknown;
    toolCalls: unknown;
    jobId: string | null;
    createdAt: string;
  }>;
};
