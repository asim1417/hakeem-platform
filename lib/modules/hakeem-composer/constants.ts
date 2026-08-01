import type {
  ComposerModeId,
  ComposerSlashCommand,
  ComposerSourceId,
  ComposerSuggestion,
  ComposerSurface,
  HakeemComposerRequest,
} from "./types";
import { composerSourcesToPolicy } from "./source-policy";

export const COMPOSER_CSS_VARS = {
  bg: "var(--composer-bg, var(--hakeem-paper, var(--paper, #fff)))",
  border: "var(--composer-border, var(--ink-15))",
  borderFocus: "var(--composer-border-focus, var(--gold))",
  shadow: "var(--composer-shadow, var(--sh-md))",
  text: "var(--composer-text, var(--ink))",
  muted: "var(--composer-muted, var(--ink-60))",
  accent: "var(--composer-accent, var(--navy))",
  danger: "var(--composer-danger, var(--ruby))",
  radius: "var(--composer-radius, var(--r-xl))",
} as const;

export const COMPOSER_ACCEPT =
  ".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.gif";

export const COMPOSER_MAX_ATTACHMENTS = 10;
export const COMPOSER_MAX_DOC_CHARS = 200_000;
export const COMPOSER_EXPAND_THRESHOLD = 600;

export const COMPOSER_PLACEHOLDERS = [
  "اسأل حكيم عن مسألة قانونية أو ارفع مستندًا لتحليله",
  "اكتب سؤالك، ألصق نصًا، أو أرفق ملف القضية",
  "ما المسألة القانونية التي تريد بحثها؟",
  "اطلب تحليلًا، صياغة، بحثًا أو مراجعة مستند",
] as const;

export const COMPOSER_SOURCES: Array<{
  id: ComposerSourceId;
  label: string;
  description: string;
  hint: string;
}> = [
  {
    id: "legal-core",
    label: "مكتبة الأنظمة",
    description: "النواة النظامية السعودية",
    hint: "ابحث أولًا في الأنظمة السعودية الموثّقة في النواة.",
  },
  {
    id: "regulations",
    label: "اللوائح",
    description: "اللوائح التنفيذية والتنظيمية",
    hint: "راعِ اللوائح التنفيذية والتنظيمية ذات الصلة إن وُجدت في النواة.",
  },
  {
    id: "rulings-principles",
    label: "الأحكام والمبادئ",
    description: "سوابق ومبادئ للاستئناس",
    hint: "إن وُجدت أحكام أو مبادئ ذات صلة فاستأنس بها مع تمييزها عن السند النظامي.",
  },
  {
    id: "attached-only",
    label: "المرفقات فقط",
    description: "اعتمد على الملفات المرفقة",
    hint: "اعتمد على المستندات المرفقة فقط ولا تبحث خارجها إلا لضرورة الاستشهاد النظامي الصريح.",
  },
  {
    id: "user-docs",
    label: "مستندات المستخدم",
    description: "ملفاتك في الجلسة",
    hint: "فضّل مستندات المستخدم المرفقة في هذه الجلسة.",
  },
  {
    id: "case-files",
    label: "ملفات القضية",
    description: "سياق ملف القضية النشط",
    hint: "اربط الإجابة بملف القضية النشط إن وُجد في السياق.",
  },
];

export const DEFAULT_SOURCES: ComposerSourceId[] = ["legal-core"];

/** أوامر مختصرة للصندوق — تشمل أوامر الوكلاء + أوضاع Ask. */
export const COMPOSER_SLASH_COMMANDS: ComposerSlashCommand[] = [
  {
    id: "research",
    command: "/بحث",
    label: "بحث نظامي",
    description: "ابحث في الأنظمة السعودية",
    modeId: "ask",
    template: "",
  },
  {
    id: "analyze",
    command: "/تحليل",
    label: "تحليل قضية",
    description: "حلّل الوقائع والطلبات والدفوع",
    modeId: "analyze-case",
    template: "",
  },
  {
    id: "draft",
    command: "/صياغة",
    label: "صياغة قانونية",
    description: "صغ مذكرة أو خطابًا أو عقدًا",
    modeId: "action-plan",
    template: "صغ ",
  },
  {
    id: "compare",
    command: "/مقارنة",
    label: "مقارنة",
    description: "قارن بين نصّين أو حكمين",
    modeId: "ask",
    template: "قارن بين ",
  },
  {
    id: "summarize",
    command: "/تلخيص",
    label: "تلخيص",
    description: "لخّص المستند أو الوقائع",
    modeId: "ask",
    template: "لخّص ",
  },
  {
    id: "cite",
    command: "/استشهاد",
    label: "استشهاد",
    description: "ابحث عن المواد النظامية المستندة",
    modeId: "ask",
    template: "ما المواد النظامية المنظمة لـ ",
  },
  {
    id: "case",
    command: "/قضية",
    label: "قضية",
    description: "تحليل ملف قضية",
    modeId: "analyze-case",
  },
  {
    id: "ruling",
    command: "/حكم",
    label: "فحص حكم",
    description: "دقّق حكمًا قضائيًا",
    modeId: "ask",
    agentCommand: true,
    template: "/فحص-حكم ",
  },
  {
    id: "contract",
    command: "/عقد",
    label: "مراجعة عقد",
    description: "راجع عقدًا وحدّد المخاطر",
    modeId: "ask",
    template: "راجع هذا العقد وحدّد المخاطر والنواقص: ",
  },
  {
    id: "objection",
    command: "/اعتراض",
    label: "لائحة اعتراض",
    description: "صغ لائحة اعتراض أو نقض",
    modeId: "action-plan",
    agentCommand: true,
    template: "/لائحة-نقض ",
  },
  {
    id: "letter",
    command: "/خطاب",
    label: "خطاب رسمي",
    description: "صغ خطابًا رسميًا",
    modeId: "consultation",
    template: "صغ خطابًا رسميًا بشأن ",
  },
  {
    id: "study",
    command: "/دراسة",
    label: "دراسة موسّعة",
    description: "فعّل الدراسة التفصيلية",
    modeId: "ask",
    detailed: true,
  },
  {
    id: "plan",
    command: "/خطة",
    label: "خطة عمل",
    description: "ابنِ خطة إجراء للقضية",
    modeId: "action-plan",
  },
  {
    id: "simulate",
    command: "/محاكاة",
    label: "محاكاة قضائية",
    description: "قدّر اتّجاه الحكم احتمالًا",
    modeId: "verdict-estimate",
  },
  {
    id: "memo",
    command: "/مذكرة-جوابية",
    label: "مذكرة جوابية",
    description: "صغ مذكرة جوابية",
    modeId: "action-plan",
    agentCommand: true,
    template: "/مذكرة-جوابية ",
  },
  {
    id: "commercial",
    command: "/تحليل-تجاري",
    label: "تحليل تجاري",
    description: "حلّل نزاعًا تجاريًا",
    modeId: "analyze-case",
    agentCommand: true,
    template: "/تحليل-تجاري ",
  },
  {
    id: "audit-ruling",
    command: "/فحص-حكم",
    label: "فحص حكم",
    description: "أمر وكيل فحص الأحكام",
    modeId: "ask",
    agentCommand: true,
    template: "/فحص-حكم ",
  },
  {
    id: "sources",
    command: "/مصادر",
    label: "المصادر",
    description: "ذكّر بتضييق نطاق المصادر",
    modeId: "ask",
    template: "استخدم الأنظمة السعودية فقط: ",
  },
  {
    id: "attach",
    command: "/مرفق",
    label: "توجيه عن المرفق",
    description: "اسأل عن المستند المرفق",
    modeId: "ask",
    template: "حلّل المستند المرفق من حيث ",
  },
];

export function suggestionsForSurface(
  surface: ComposerSurface,
  opts?: { hasAttachment?: boolean; followUp?: boolean }
): ComposerSuggestion[] {
  if (opts?.followUp) {
    return [
      { id: "deeper", label: "عمّق البحث", insertText: "عمّق البحث في هذه النقطة مع مزيد من الاستشهادات" },
      { id: "to-memo", label: "حوّل إلى مذكرة", insertText: "حوّل الإجابة السابقة إلى مذكرة قانونية موجزة" },
      { id: "to-plan", label: "أنشئ خطة تنفيذ", insertText: "حوّل التحليل إلى خطة عمل عملية للخطوة التالية" },
      { id: "check-cites", label: "راجع الاستشهادات", insertText: "راجع الاستشهادات وتأكد من أرقام المواد" },
    ];
  }
  if (opts?.hasAttachment) {
    return [
      { id: "att-full", label: "تحليل كامل للمرفق", insertText: "حلّل المستند المرفق تحليلًا كاملًا" },
      { id: "att-sum", label: "تلخيص المرفق", insertText: "لخّص المستند المرفق بنقاط واضحة" },
      { id: "att-extract", label: "استخراج الوقائع والطلبات", insertText: "استخرج الوقائع والطلبات والدفوع من المستند المرفق" },
      { id: "att-laws", label: "استخراج النصوص النظامية", insertText: "استخرج المواد والنصوص النظامية المشار إليها في المستند" },
    ];
  }
  switch (surface) {
    case "case":
      return [
        { id: "case-sum", label: "لخّص وقائع القضية", insertText: "لخّص وقائع القضية" },
        { id: "case-claims", label: "استخرج الطلبات والدفوع", insertText: "استخرج الطلبات والدفوع" },
        { id: "case-timeline", label: "ابنِ خطًا زمنيًا", insertText: "ابنِ خطًا زمنيًا لأحداث القضية" },
        { id: "case-gaps", label: "حدد المستندات الناقصة", insertText: "حدد المستندات الناقصة في ملف القضية" },
        { id: "case-next", label: "أعد خطة الإجراء التالية", insertText: "أعد خطة الإجراء التالية" },
      ];
    case "document":
      return [
        { id: "doc-sum", label: "لخّص هذا المستند", insertText: "لخّص هذا المستند" },
        { id: "doc-laws", label: "استخرج المواد النظامية", insertText: "استخرج المواد النظامية" },
        { id: "doc-contra", label: "اكتشف التناقضات", insertText: "اكتشف التناقضات في المستند" },
        { id: "doc-memo", label: "حوّل إلى مذكرة", insertText: "حوّل المحتوى إلى مذكرة قانونية" },
      ];
    case "library":
      return [
        { id: "lib-explain", label: "اشرح هذه المادة", insertText: "اشرح هذه المادة" },
        { id: "lib-related", label: "ابحث عن النصوص المرتبطة", insertText: "ابحث عن النصوص المرتبطة" },
        { id: "lib-compare", label: "قارن بين النصوص", insertText: "قارن بين النصوص" },
        { id: "lib-exceptions", label: "استخرج الشروط والاستثناءات", insertText: "استخرج الشروط والاستثناءات" },
      ];
    case "simulation":
      return [
        { id: "sim-judge", label: "محاكاة دور القاضي", insertText: "حاكِ نظر القاضي في هذه الوقائع" },
        { id: "sim-plaintiff", label: "دفوع المدعي", insertText: "ما أقوى دفوع المدعي؟" },
        { id: "sim-defendant", label: "دفوع المدعى عليه", insertText: "ما أقوى دفوع المدعى عليه؟" },
      ];
    case "drafting":
      return [
        { id: "dr-letter", label: "صغ خطابًا رسميًا", insertText: "صغ خطابًا رسميًا بشأن " },
        { id: "dr-memo", label: "صغ مذكرة", insertText: "صغ مذكرة قانونية بشأن " },
        { id: "dr-objection", label: "صغ لائحة اعتراض", insertText: "صغ لائحة اعتراض على " },
      ];
    default:
      return [
        { id: "home-article", label: "ابحث عن مادة نظامية", insertText: "ابحث عن المادة النظامية المنظمة لـ " },
        { id: "home-case", label: "حلّل قضية", insertText: "حلّل هذه القضية: " },
        { id: "home-contract", label: "راجع عقدًا", insertText: "راجع هذا العقد وحدّد المخاطر: " },
        { id: "home-ruling", label: "راجع حكمًا", insertText: "راجع هذا الحكم من حيث التسبيب والمنطوق: " },
        { id: "home-letter", label: "صغ خطابًا رسميًا", insertText: "صغ خطابًا رسميًا بشأن " },
      ];
  }
}

export function buildSourceHint(sources: ComposerSourceId[]): string {
  if (!sources.length) return "";
  const hints = COMPOSER_SOURCES.filter((s) => sources.includes(s.id)).map((s) => s.hint);
  return hints.join(" ");
}

export function resolveEffectiveMode(modeId: ComposerModeId): Exclude<ComposerModeId, "auto"> {
  return modeId === "auto" ? "ask" : modeId;
}

export function canSubmitComposer(input: {
  text: string;
  hasReadyAttachment: boolean;
  busy?: boolean;
  extracting?: boolean;
  maxChars: number;
}): boolean {
  if (input.busy || input.extracting) return false;
  const t = input.text.trim();
  if (!t && !input.hasReadyAttachment) return false;
  if (t.length > input.maxChars) return false;
  return true;
}

export function detectDevice(): HakeemComposerRequest["client"]["device"] {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function buildComposerRequest(input: {
  text: string;
  mode: ComposerModeId;
  detailed: boolean;
  conversationId?: string | null;
  attachments: Array<{ id: string; name: string; kind?: string | null; extractedText: string; status: string }>;
  sources: ComposerSourceId[];
  context: Array<{ type: string; id: string; label: string }>;
}): HakeemComposerRequest {
  const messageId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `msg-${Date.now()}`;
  const sourceHint = buildSourceHint(input.sources);
  const sourcePolicy = composerSourcesToPolicy(input.sources);
  return {
    conversationId: input.conversationId || undefined,
    messageId,
    text: input.text.trim(),
    mode: input.mode,
    detailed: input.detailed,
    attachments: input.attachments
      .filter((a) => a.status === "ready" && a.extractedText.trim())
      .map((a) => ({
        id: a.id,
        type: a.kind || "document",
        name: a.name,
        extractedText: a.extractedText,
      })),
    sources: input.sources,
    sourcePolicy,
    context: input.context,
    client: {
      locale: "ar-SA",
      direction: "rtl",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Riyadh",
      device: detectDevice(),
    },
    preferences: {
      responseLength: input.detailed ? "detailed" : "balanced",
      citationMode: "required",
      legalJurisdiction: "SA",
      /** انتقالي: يُزال بعد تفعيل HAKEEM_COMPOSER_SOURCE_POLICY_V2 بالكامل */
      sourceHint: sourceHint || undefined,
    },
  };
}

/** يبني نص الاستعلام المرسل لـ agent-search مع تلميحات المصادر والسياق دون كسر المحرك. */
export function composeAgentQuery(text: string, opts: {
  sourceHint?: string;
  contextLabels?: string[];
}): string {
  const parts: string[] = [];
  if (text.trim()) parts.push(text.trim());
  if (opts.contextLabels?.length) {
    parts.push(`(السياق النشط: ${opts.contextLabels.join("، ")})`);
  }
  if (opts.sourceHint?.trim()) {
    parts.push(`(تفضيل المصادر: ${opts.sourceHint.trim()})`);
  }
  return parts.join("\n\n");
}
