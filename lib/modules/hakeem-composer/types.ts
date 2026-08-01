/**
 * أنواع صندوق حكيم الذكي — HakeemComposer
 * عقود الواجهة فقط؛ التنفيذ الفعلي يبقى على مسارات Ask/الجلسات القائمة.
 */

import type { AgentModeId } from "@/lib/modules/agents/modes";

export type ComposerSurface =
  | "ask"
  | "home"
  | "case"
  | "document"
  | "library"
  | "simulation"
  | "drafting"
  | "guest";

export type ComposerModeId = AgentModeId | "auto";

export type ComposerSourceId =
  | "legal-core"
  | "regulations"
  | "rulings-principles"
  | "attached-only"
  | "user-docs"
  | "case-files";

/** يُعاد تصديره من وحدة السياسة — عقد خادمي موحّد */
export type { SourcePolicy } from "./source-policy";

export type AttachmentStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "unsupported"
  | "encrypted";

export type ComposerAttachment = {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  kind?: string | null;
  extractedText: string;
  status: AttachmentStatus;
  progressMessage?: string;
  error?: string;
};

export type ComposerContextItem = {
  type: "case" | "document" | "system" | "session" | "source" | "tool" | "custom";
  id: string;
  label: string;
  removable?: boolean;
};

export type ComposerMention = {
  id: string;
  label: string;
  insertText: string;
  group: "systems" | "sessions" | "tools" | "sources" | "attachments";
  description?: string;
};

export type ComposerSlashCommand = {
  id: string;
  command: string;
  label: string;
  description: string;
  /** يضبط وضع Ask إن وُجد */
  modeId?: AgentModeId;
  /** يفعّل الدراسة الموسّعة */
  detailed?: boolean;
  /** يدرج قالبًا بعد الأمر */
  template?: string;
  /** أمر وكيل موجود في agents/commands */
  agentCommand?: boolean;
};

export type ComposerSuggestion = {
  id: string;
  label: string;
  insertText: string;
};

export type ComposerClientMeta = {
  locale: string;
  direction: "rtl" | "ltr";
  timezone: string;
  device: "mobile" | "tablet" | "desktop";
};

export type HakeemComposerRequest = {
  conversationId?: string;
  messageId: string;
  text: string;
  mode: ComposerModeId;
  detailed: boolean;
  attachments: Array<{
    id: string;
    type: string;
    name: string;
    extractedText?: string;
  }>;
  sources: ComposerSourceId[];
  /** عقد مصادر مهيكل — الإنفاذ على الخادم عند تفعيل العلم */
  sourcePolicy?: import("./source-policy").SourcePolicy;
  context: Array<{ type: string; id: string; label: string }>;
  client: ComposerClientMeta;
  preferences: {
    responseLength?: "concise" | "balanced" | "detailed";
    citationMode?: "required" | "preferred" | "off";
    legalJurisdiction?: string;
    /** انتقالي إلى حين اكتمال الإنفاذ الخادمي */
    sourceHint?: string;
  };
};

export type ComposerStatusKind =
  | "idle"
  | "recording"
  | "uploading"
  | "processing"
  | "submitting"
  | "streaming"
  | "offline"
  | "error";

export type HakeemComposerProps = {
  surface?: ComposerSurface;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  busy?: boolean;
  extracting?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxChars?: number;
  draftKey?: string;
  /** حفظ المسودة تلقائيًا عند التغيير */
  persistDraft?: boolean;
  modeId: ComposerModeId;
  onModeChange: (mode: ComposerModeId) => void;
  showModeSelector?: boolean;
  detailed: boolean;
  onDetailedChange: (detailed: boolean) => void;
  sources: ComposerSourceId[];
  onSourcesChange: (sources: ComposerSourceId[]) => void;
  attachments: ComposerAttachment[];
  onAttachFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  contextItems?: ComposerContextItem[];
  onRemoveContext?: (id: string) => void;
  suggestions?: ComposerSuggestion[];
  onSuggestionSelect?: (suggestion: ComposerSuggestion) => void;
  statusMessage?: string | null;
  errorMessage?: string | null;
  submitLabel?: string;
  followUp?: boolean;
  accept?: string;
  className?: string;
  /** يظهر شريط الأوضاع حتى بدون متغير البيئة */
  forceModeBar?: boolean;
};
