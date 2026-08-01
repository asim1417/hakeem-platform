/**
 * Composer Capability Registry — سجل قدرات الصندوق.
 *
 * مبدأ حاكم: **الربط دون الابتلاع**.
 * كل خدمة تبقى مستقلة (Ask / legal-core / attachments / JDS / simulations / library).
 * السجل يصف كيف يكتشف Composer القدرة ويستدعيها — لا ينقل ملكية التنفيذ.
 */
import type { AgentModeId } from "@/lib/modules/agents/modes";
import type { ComposerModeId, ComposerSourceId, ComposerSurface } from "./types";
import type { HakeemIntentCategory } from "./intent-router";

export type CapabilityOwner =
  | "ask"
  | "legal-core"
  | "attachments"
  | "document-inspection"
  | "doc-node"
  | "judicial-assistant"
  | "jds-gates"
  | "case-analysis"
  | "simulations"
  | "library"
  | "conversations"
  | "citations"
  | "agent-runtime";

export type CapabilityEntryKind = "tool" | "route" | "fn" | "redirect" | "middleware";

export type ComposerCapability = {
  id: string;
  titleAr: string;
  ownerService: CapabilityOwner;
  /** الخدمة تبقى قابلة للنشر وحدها */
  independent: true;
  entry: {
    kind: CapabilityEntryKind;
    /** مسار ملف أو اسم أداة أو مسار URL */
    ref: string;
  };
  composer: {
    surfaces: ComposerSurface[];
    modes: Array<ComposerModeId | "*">;
    sourceKeys?: ComposerSourceId[];
    intentCategories?: HakeemIntentCategory[];
    slashHints?: string[];
  };
  flags: string[];
  auth: string[];
  grounding: "required" | "preferred" | "none";
  /** روابط إلى قدرات أخرى يُفضَّل استدعاؤها معها */
  linksTo?: string[];
};

/**
 * الكتالوج الرسمي — يُوسَّع بإضافة إدخال، لا بدمج خدمات.
 */
export const COMPOSER_CAPABILITIES: ComposerCapability[] = [
  {
    id: "ask.host",
    titleAr: "مضيف اسأل حكيم",
    ownerService: "ask",
    independent: true,
    entry: { kind: "route", ref: "POST /api/ai/agent-search" },
    composer: { surfaces: ["ask", "home", "guest"], modes: ["*"] },
    flags: [],
    auth: ["session"],
    grounding: "preferred",
    linksTo: ["ask.legal_search", "ask.read_attachment", "citations.verify"],
  },
  {
    id: "ask.legal_search",
    titleAr: "بحث النواة القانونية",
    ownerService: "legal-core",
    independent: true,
    entry: { kind: "tool", ref: "legal_search" },
    composer: {
      surfaces: ["ask", "home", "library"],
      modes: ["ask", "analyze-case", "consultation", "action-plan", "auto"],
      sourceKeys: ["legal-core", "regulations", "rulings-principles"],
      intentCategories: ["legal-question", "legal-research", "case-analysis"],
    },
    flags: [],
    auth: ["LEGAL_CORE_VIEW"],
    grounding: "required",
    linksTo: ["ask.fetch_legal_source", "citations.verify"],
  },
  {
    id: "ask.fetch_legal_source",
    titleAr: "قراءة مادة كاملة",
    ownerService: "legal-core",
    independent: true,
    entry: { kind: "tool", ref: "fetch_legal_source" },
    composer: {
      surfaces: ["ask"],
      modes: ["ask", "analyze-case", "consultation", "auto"],
      sourceKeys: ["legal-core", "regulations"],
    },
    flags: [],
    auth: ["LEGAL_CORE_VIEW"],
    grounding: "required",
    linksTo: ["citations.verify"],
  },
  {
    id: "ask.deep_study",
    titleAr: "دراسة موسّعة",
    ownerService: "ask",
    independent: true,
    entry: { kind: "tool", ref: "deep_legal_study" },
    composer: {
      surfaces: ["ask"],
      modes: ["ask", "analyze-case", "auto"],
      intentCategories: ["case-analysis", "legal-research"],
    },
    flags: ["CLAUDE_NATIVE_AGENT_ENABLED"],
    auth: ["session"],
    grounding: "required",
    linksTo: ["ask.legal_search", "citations.verify"],
  },
  {
    id: "ask.read_attachment",
    titleAr: "قراءة المرفق بالمعرّف/الصفحة",
    ownerService: "attachments",
    independent: true,
    entry: { kind: "tool", ref: "read_attachment" },
    composer: {
      surfaces: ["ask", "document"],
      modes: ["*"],
      sourceKeys: ["attached-only", "user-docs"],
      intentCategories: ["document-review"],
    },
    flags: [],
    auth: ["ASK_ATTACHMENT_UPLOAD", "ATTACHMENTS_LIMITED"],
    grounding: "preferred",
    linksTo: ["docs.process", "citations.attachment_page"],
  },
  {
    id: "docs.process",
    titleAr: "معالجة المستند (doc-node / inspection)",
    ownerService: "doc-node",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/attachments/document-processing-adapter.ts#queueAttachmentProcessing" },
    composer: { surfaces: ["ask", "document"], modes: ["*"], sourceKeys: ["attached-only", "user-docs"] },
    flags: ["HAKEEM_DOCUMENT_PROCESSING_V2"],
    auth: ["ASK_ATTACHMENT_UPLOAD"],
    grounding: "none",
    linksTo: ["ask.read_attachment"],
  },
  {
    id: "citations.verify",
    titleAr: "تحقّق الاستشهاد النظامي",
    ownerService: "citations",
    independent: true,
    entry: { kind: "middleware", ref: "lib/modules/agents/thinking/verifier.ts#verifyCitations" },
    composer: { surfaces: ["ask", "case"], modes: ["*"] },
    flags: [],
    auth: [],
    grounding: "required",
  },
  {
    id: "citations.attachment_page",
    titleAr: "استشهاد صفحة مرفق",
    ownerService: "attachments",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/hakeem-composer/unified-citations.ts#formatAttachmentPageCitation" },
    composer: { surfaces: ["ask", "document"], modes: ["*"], sourceKeys: ["attached-only"] },
    flags: [],
    auth: [],
    grounding: "preferred",
    linksTo: ["ask.read_attachment"],
  },
  {
    id: "case.analyze",
    titleAr: "تحليل قضية (وضع Ask)",
    ownerService: "case-analysis",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/agents/case-agent-bridge.ts#buildAgentGroundedContext" },
    composer: {
      surfaces: ["ask", "case"],
      modes: ["analyze-case", "auto"],
      intentCategories: ["case-analysis"],
      slashHints: ["/حلّل"],
    },
    flags: [],
    auth: ["session"],
    grounding: "required",
    linksTo: ["ask.legal_search", "citations.verify", "case.context"],
  },
  {
    id: "case.context",
    titleAr: "سياق ملف القضية",
    ownerService: "case-analysis",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/hakeem-composer/case-context-bridge.ts#resolveComposerCaseContext" },
    composer: {
      surfaces: ["ask", "case"],
      modes: ["analyze-case", "action-plan", "verdict-estimate", "auto"],
      sourceKeys: ["case-files"],
    },
    flags: ["HAKEEM_COMPOSER_CASE_CONTEXT_V1"],
    auth: ["session"],
    grounding: "preferred",
    linksTo: ["jds.handoff"],
  },
  {
    id: "mode.action_plan",
    titleAr: "خطة عمل / صياغة",
    ownerService: "ask",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/agents/modes.ts#action-plan" },
    composer: {
      surfaces: ["ask", "drafting"],
      modes: ["action-plan"],
      intentCategories: ["legal-drafting"],
      slashHints: ["/صياغة"],
    },
    flags: [],
    auth: ["session"],
    grounding: "required",
    linksTo: ["ask.legal_search", "citations.verify"],
  },
  {
    id: "mode.verdict_estimate",
    titleAr: "تقدير حكم (تدريبي)",
    ownerService: "ask",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/agents/modes.ts#verdict-estimate" },
    composer: {
      surfaces: ["ask", "simulation"],
      modes: ["verdict-estimate"],
      intentCategories: ["judicial-simulation"],
    },
    flags: [],
    auth: ["session"],
    grounding: "required",
    linksTo: ["citations.verify", "jds.shadow_review"],
  },
  {
    id: "jds.handoff",
    titleAr: "تسليم للمعاون القضائي (مستقل)",
    ownerService: "judicial-assistant",
    independent: true,
    entry: { kind: "redirect", ref: "/dashboard/judicial-assistant" },
    composer: {
      surfaces: ["ask", "case"],
      modes: ["analyze-case", "verdict-estimate", "auto"],
      intentCategories: ["case-analysis", "judicial-simulation"],
    },
    flags: ["HAKEEM_COMPOSER_JDS_HANDOFF_V1"],
    auth: ["JUDICIAL_ASSISTANT_USE"],
    grounding: "none",
    linksTo: ["jds.service_catalog"],
  },
  {
    id: "jds.service_catalog",
    titleAr: "كتالوج خدمات المعاون JS-001…024",
    ownerService: "judicial-assistant",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/judicial-assistant/catalog.ts#SERVICES" },
    composer: { surfaces: ["case"], modes: ["analyze-case", "verdict-estimate"] },
    flags: ["HAKEEM_COMPOSER_JDS_HANDOFF_V1"],
    auth: ["JUDICIAL_ASSISTANT_USE"],
    grounding: "none",
  },
  {
    id: "jds.shadow_review",
    titleAr: "مراجعة ظل JDS على المخرج",
    ownerService: "jds-gates",
    independent: true,
    entry: { kind: "middleware", ref: "lib/modules/judicial/shadow.ts#judicialShadowReview" },
    composer: {
      surfaces: ["ask", "simulation"],
      modes: ["verdict-estimate", "action-plan", "analyze-case"],
    },
    flags: ["JDS_DRAFTING_SHADOW", "JDS_ENFORCE"],
    auth: [],
    grounding: "preferred",
  },
  {
    id: "sim.courtroom",
    titleAr: "محاكاة قاعة (منتج مستقل)",
    ownerService: "simulations",
    independent: true,
    entry: { kind: "redirect", ref: "/dashboard/simulations" },
    composer: { surfaces: ["simulation"], modes: ["verdict-estimate"] },
    flags: [],
    auth: ["SIMULATIONS_USE"],
    grounding: "preferred",
  },
  {
    id: "library.browse",
    titleAr: "تصفح المكتبة",
    ownerService: "library",
    independent: true,
    entry: { kind: "redirect", ref: "/dashboard/library" },
    composer: { surfaces: ["library", "ask"], modes: ["ask", "auto"], sourceKeys: ["legal-core"] },
    flags: [],
    auth: ["LIBRARY_READ"],
    grounding: "none",
    linksTo: ["ask.legal_search"],
  },
  {
    id: "conversations.persist",
    titleAr: "حفظ جلسة المحادثة",
    ownerService: "conversations",
    independent: true,
    entry: { kind: "fn", ref: "lib/modules/conversations/engine.ts#appendMessage" },
    composer: { surfaces: ["ask", "case"], modes: ["*"] },
    flags: [],
    auth: ["session"],
    grounding: "none",
  },
];

export function getCapability(id: string): ComposerCapability | undefined {
  return COMPOSER_CAPABILITIES.find((c) => c.id === id);
}

export function listCapabilitiesByOwner(owner: CapabilityOwner): ComposerCapability[] {
  return COMPOSER_CAPABILITIES.filter((c) => c.ownerService === owner);
}

export function listCapabilitiesForMode(mode: ComposerModeId | AgentModeId): ComposerCapability[] {
  return COMPOSER_CAPABILITIES.filter(
    (c) => c.composer.modes.includes("*") || c.composer.modes.includes(mode as ComposerModeId)
  );
}

export function listCapabilitiesForIntent(category: HakeemIntentCategory): ComposerCapability[] {
  return COMPOSER_CAPABILITIES.filter((c) => c.composer.intentCategories?.includes(category));
}

export function listCapabilitiesForSources(sources: ComposerSourceId[]): ComposerCapability[] {
  if (!sources.length) return COMPOSER_CAPABILITIES.filter((c) => !c.composer.sourceKeys?.length);
  return COMPOSER_CAPABILITIES.filter((c) => {
    if (!c.composer.sourceKeys?.length) return true;
    return c.composer.sourceKeys.some((s) => sources.includes(s));
  });
}

function envOn(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * هل القدرة مفعّلة وفق الأعلام؟
 * أعلام فارغة = دائمًا متاحة (مع بقاء صلاحيات المسار).
 * لأعلام OR-مجموعة (مثل ظل JDS): أي علم كافٍ إن وُجدت بدائل معروفة.
 */
export function isCapabilityEnabled(cap: ComposerCapability): boolean {
  if (!cap.flags.length) return true;
  // ظل/إنفاذ JDS: يكفي أحدهما
  if (cap.id === "jds.shadow_review") {
    return envOn("JDS_DRAFTING_SHADOW") || envOn("JDS_ENFORCE");
  }
  // باقي القدرات: كل الأعلام مطلوبة
  return cap.flags.every((f) => envOn(f));
}

export type ResolvedComposerCapabilities = {
  mode: ComposerModeId;
  intentCategory?: HakeemIntentCategory;
  sources: ComposerSourceId[];
  capabilities: ComposerCapability[];
  toolNames: string[];
  redirects: Array<{ id: string; href: string; titleAr: string }>;
  middleware: string[];
};

/**
 * يحلّ قدرات الجلسة من الوضع + المقصد + المصادر — دون تنفيذ الخدمات.
 */
export function resolveComposerCapabilities(input: {
  mode: ComposerModeId;
  intentCategory?: HakeemIntentCategory;
  sources?: ComposerSourceId[];
  hasAttachment?: boolean;
  hasCaseContext?: boolean;
}): ResolvedComposerCapabilities {
  const sources = input.sources ?? [];
  const byMode = listCapabilitiesForMode(input.mode);
  const byIntent = input.intentCategory
    ? listCapabilitiesForIntent(input.intentCategory)
    : [];
  const merged = new Map<string, ComposerCapability>();
  for (const c of [...byMode, ...byIntent]) merged.set(c.id, c);

  // مصادر المرفقات فقط → أبقِ قدرات المرفقات والاستشهاد
  if (sources.includes("attached-only")) {
    for (const id of ["ask.read_attachment", "citations.attachment_page", "docs.process", "ask.host"]) {
      const c = getCapability(id);
      if (c) merged.set(c.id, c);
    }
  }

  if (input.hasCaseContext) {
    const c = getCapability("case.context");
    if (c) merged.set(c.id, c);
    const j = getCapability("jds.handoff");
    if (j) merged.set(j.id, j);
  }

  if (input.hasAttachment) {
    const c = getCapability("ask.read_attachment");
    if (c) merged.set(c.id, c);
  }

  const enabled = [...merged.values()].filter(isCapabilityEnabled);

  return {
    mode: input.mode,
    intentCategory: input.intentCategory,
    sources,
    capabilities: enabled,
    toolNames: enabled.filter((c) => c.entry.kind === "tool").map((c) => c.entry.ref),
    redirects: enabled
      .filter((c) => c.entry.kind === "redirect")
      .map((c) => ({ id: c.id, href: c.entry.ref, titleAr: c.titleAr })),
    middleware: enabled.filter((c) => c.entry.kind === "middleware").map((c) => c.entry.ref),
  };
}

/** إحصاء سريع للجرد */
export function capabilityRegistryStats() {
  const byOwner = new Map<CapabilityOwner, number>();
  for (const c of COMPOSER_CAPABILITIES) {
    byOwner.set(c.ownerService, (byOwner.get(c.ownerService) ?? 0) + 1);
  }
  return {
    total: COMPOSER_CAPABILITIES.length,
    allIndependent: COMPOSER_CAPABILITIES.every((c) => c.independent),
    byOwner: Object.fromEntries(byOwner),
  };
}
