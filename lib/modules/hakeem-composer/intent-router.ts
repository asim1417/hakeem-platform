import { classifyIntent, intentNeedsSearch, isCaseHelpWithoutFacts } from "@/lib/modules/agents/intent-gate";
import { resolveAgentSlash } from "./slash-commands";
import type { ComposerModeId, ComposerSourceId } from "./types";
import { resolveEffectiveMode } from "./constants";

export type HakeemIntentCategory =
  | "legal-question"
  | "legal-research"
  | "case-analysis"
  | "document-review"
  | "legal-drafting"
  | "judicial-simulation"
  | "general-chat"
  | "workflow-action"
  | "greeting"
  | "clarify";

export type HakeemIntent = {
  category: HakeemIntentCategory;
  legalDomain?: string;
  requiresRetrieval: boolean;
  requiresCitations: boolean;
  requiresFiles: boolean;
  requiredTools: string[];
  outputType: "answer" | "memo" | "letter" | "report" | "table" | "timeline" | "action-plan";
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  suggestedMode: Exclude<ComposerModeId, "auto">;
  agentSlash?: { command: string; args: string } | null;
};

/**
 * موجّه مقصد خفيف فوق البوابات القائمة — لا يستبدل المحرك القانوني.
 * يستخدم intent-gate + أوامر الوكلاء + تلميحات الوضع.
 */
export function routeComposerIntent(input: {
  text: string;
  mode: ComposerModeId;
  hasAttachment: boolean;
  sources?: ComposerSourceId[];
}): HakeemIntent {
  const text = (input.text || "").trim();
  const sources = input.sources ?? [];
  const attachedOnly = sources.includes("attached-only");
  const slash = resolveAgentSlash(text);
  if (slash) {
    return {
      category: "workflow-action",
      requiresRetrieval: !attachedOnly,
      requiresCitations: !attachedOnly,
      requiresFiles: /حكم|عقد|مرفق|مستند/.test(text) || input.hasAttachment || attachedOnly,
      requiredTools: attachedOnly
        ? ["read_attachment"]
        : [slash.spec.target, slash.spec.skill],
      outputType: slash.spec.target.includes("drafter") ? "memo" : "report",
      riskLevel: "medium",
      confidence: 0.95,
      suggestedMode: resolveEffectiveMode(input.mode),
      agentSlash: { command: slash.spec.command, args: slash.args },
    };
  }

  if (input.mode !== "auto") {
    const mode = resolveEffectiveMode(input.mode);
    const base = intentFromMode(mode, text, input.hasAttachment);
    if (attachedOnly) {
      return {
        ...base,
        requiresRetrieval: false,
        requiresFiles: true,
        requiredTools: ["read_attachment"],
        category: "document-review",
      };
    }
    return base;
  }

  if ((!text && input.hasAttachment) || attachedOnly) {
    return {
      category: "document-review",
      requiresRetrieval: !attachedOnly,
      requiresCitations: !attachedOnly,
      requiresFiles: true,
      requiredTools: attachedOnly ? ["read_attachment"] : ["read_attachment", "legal_search"],
      outputType: "report",
      riskLevel: "medium",
      confidence: 0.8,
      suggestedMode: "ask",
    };
  }

  if (isCaseHelpWithoutFacts(text)) {
    return {
      category: "clarify",
      requiresRetrieval: false,
      requiresCitations: false,
      requiresFiles: false,
      requiredTools: [],
      outputType: "answer",
      riskLevel: "low",
      confidence: 0.85,
      suggestedMode: "chat",
    };
  }

  const gate = classifyIntent(text);
  if (gate.type !== "legal_question") {
    return {
      category: gate.type === "greeting" ? "greeting" : gate.type === "ambiguous" ? "clarify" : "general-chat",
      requiresRetrieval: false,
      requiresCitations: false,
      requiresFiles: false,
      requiredTools: [],
      outputType: "answer",
      riskLevel: "low",
      confidence: gate.confidence,
      suggestedMode: "chat",
    };
  }

  const lower = text.toLowerCase();
  if (/محاك|تقدير حكم|اتجاه الحكم|القاضي/.test(text)) {
    return intentFromMode("verdict-estimate", text, input.hasAttachment);
  }
  if (/خطة عمل|خطة اج|خطة إج|اجراءات|إجراءات التالية/.test(text)) {
    return intentFromMode("action-plan", text, input.hasAttachment);
  }
  if (/حلّل|حلل|تحليل قضية|وقائع|دفوع|طلبات/.test(text) && text.length > 40) {
    return intentFromMode("analyze-case", text, input.hasAttachment);
  }
  if (/صغ|اكتب خطاب|مذكرة|لائحة|عقد/.test(text)) {
    return {
      category: "legal-drafting",
      requiresRetrieval: intentNeedsSearch(gate.type),
      requiresCitations: true,
      requiresFiles: input.hasAttachment,
      requiredTools: ["legal_search"],
      outputType: /خطاب/.test(text) ? "letter" : "memo",
      riskLevel: "medium",
      confidence: 0.75,
      suggestedMode: "consultation",
    };
  }
  if (input.hasAttachment || /المستند|المرفق|الملف|pdf|العقد|الحكم/.test(lower)) {
    return {
      category: "document-review",
      requiresRetrieval: true,
      requiresCitations: true,
      requiresFiles: true,
      requiredTools: ["read_attachment", "legal_search"],
      outputType: "report",
      riskLevel: "medium",
      confidence: 0.78,
      suggestedMode: "ask",
    };
  }

  return {
    category: "legal-question",
    requiresRetrieval: true,
    requiresCitations: true,
    requiresFiles: false,
    requiredTools: ["legal_search"],
    outputType: "answer",
    riskLevel: "low",
    confidence: gate.confidence,
    suggestedMode: "ask",
  };
}

function intentFromMode(
  mode: Exclude<ComposerModeId, "auto">,
  text: string,
  hasAttachment: boolean
): HakeemIntent {
  switch (mode) {
    case "analyze-case":
      return {
        category: "case-analysis",
        requiresRetrieval: true,
        requiresCitations: true,
        requiresFiles: hasAttachment,
        requiredTools: ["legal_search", "resolve_scope"],
        outputType: "report",
        riskLevel: text.length < 80 ? "medium" : "low",
        confidence: 0.9,
        suggestedMode: mode,
      };
    case "action-plan":
      return {
        category: "legal-drafting",
        requiresRetrieval: true,
        requiresCitations: true,
        requiresFiles: hasAttachment,
        requiredTools: ["legal_search"],
        outputType: "action-plan",
        riskLevel: "medium",
        confidence: 0.9,
        suggestedMode: mode,
      };
    case "verdict-estimate":
      return {
        category: "judicial-simulation",
        requiresRetrieval: true,
        requiresCitations: true,
        requiresFiles: hasAttachment,
        requiredTools: ["legal_search"],
        outputType: "report",
        riskLevel: "high",
        confidence: 0.9,
        suggestedMode: mode,
      };
    case "consultation":
      return {
        category: "legal-question",
        requiresRetrieval: true,
        requiresCitations: true,
        requiresFiles: hasAttachment,
        requiredTools: ["legal_search"],
        outputType: "answer",
        riskLevel: "low",
        confidence: 0.88,
        suggestedMode: mode,
      };
    case "chat":
      return {
        category: "general-chat",
        requiresRetrieval: false,
        requiresCitations: false,
        requiresFiles: false,
        requiredTools: [],
        outputType: "answer",
        riskLevel: "low",
        confidence: 0.85,
        suggestedMode: mode,
      };
    default:
      return {
        category: "legal-research",
        requiresRetrieval: true,
        requiresCitations: true,
        requiresFiles: hasAttachment,
        requiredTools: ["legal_search"],
        outputType: "answer",
        riskLevel: "low",
        confidence: 0.85,
        suggestedMode: "ask",
      };
  }
}
