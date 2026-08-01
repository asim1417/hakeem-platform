/**
 * عقد سياسة المصادر — مشترك بين الواجهة والخادم.
 * التلميح النصي في composeAgentQuery انتقالي؛ الإنفاذ الحقيقي يتم خادميًا عند تفعيل العلم.
 */
import { z } from "zod";
import type { ComposerSourceId } from "./types";

export type SourcePolicy = {
  legalLibrary: boolean;
  regulations: boolean;
  judgments: boolean;
  caseFiles: boolean;
  attachments: boolean;
  organizationLibrary: boolean;
  web: boolean;
  /** عند true يُمنع التوسع خارج المصادر المفعّلة */
  strictScope: boolean;
};

export const sourcePolicySchema = z.object({
  legalLibrary: z.boolean(),
  regulations: z.boolean(),
  judgments: z.boolean(),
  caseFiles: z.boolean(),
  attachments: z.boolean(),
  organizationLibrary: z.boolean(),
  web: z.boolean(),
  strictScope: z.boolean(),
});

/** السلوك التاريخي قبل سياسة المصادر الخادمية: نواة + مرفقات مسموحة، بلا ويب. */
export const DEFAULT_SOURCE_POLICY: SourcePolicy = {
  legalLibrary: true,
  regulations: true,
  judgments: true,
  caseFiles: false,
  attachments: true,
  organizationLibrary: false,
  web: false,
  strictScope: false,
};

export function composerSourcesToPolicy(sources: ComposerSourceId[]): SourcePolicy {
  const set = new Set(sources);
  if (set.has("attached-only")) {
    return {
      legalLibrary: false,
      regulations: false,
      judgments: false,
      caseFiles: false,
      attachments: true,
      organizationLibrary: false,
      web: false,
      strictScope: true,
    };
  }
  const legalLibrary = set.has("legal-core") || set.size === 0;
  const regulations = set.has("regulations") || legalLibrary;
  const judgments = set.has("rulings-principles");
  const caseFiles = set.has("case-files");
  // قراءة المرفق المرفوع مع الطلب مسموحة دائمًا ما لم يكن النطاق «مرفقات فقط» قد عُالج أعلاه
  const attachments = true;
  return {
    legalLibrary,
    regulations,
    judgments,
    caseFiles,
    attachments,
    organizationLibrary: false,
    web: false,
    // صارم عند اختيار مجموعة محدودة (أنظمة فقط، أو أحكام، أو ملفات قضية)
    strictScope:
      caseFiles ||
      (legalLibrary && !judgments && set.size <= 2) ||
      (judgments && !legalLibrary),
  };
}

/**
 * يطبّع سياسة واردة من العميل مع إسقاط الحقول الغريبة.
 * لا يثق بالقيم كما هي — يملأ الافتراضات الآمنة.
 */
export function normalizeSourcePolicy(raw: unknown): SourcePolicy {
  const parsed = sourcePolicySchema.safeParse(raw);
  if (!parsed.success) return { ...DEFAULT_SOURCE_POLICY };
  const p = parsed.data;
  // الويب مغلق افتراضيًا حتى توجد أداة ويب مصرّح بها وصلاحية
  return {
    ...p,
    web: Boolean(p.web) && process.env.HAKEEM_ALLOW_WEB_SOURCE === "1",
  };
}

/** هل إنفاذ سياسة المصادر الخادمية مفعّل؟ (افتراضي: معطّل — يُفعَّل بـ HAKEEM_COMPOSER_SOURCE_POLICY_V2=1) */
export function isSourcePolicyV2Enabled(): boolean {
  const v = (process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export type ToolAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: string; code: "SOURCE_POLICY_DENIED" };

/**
 * يقرر إن كانت أداة الوكيل مسموحة ضمن السياسة.
 * لا يعتمد على امتثال النموذج.
 */
export function decideToolAccess(toolName: string, policy: SourcePolicy): ToolAccessDecision {
  switch (toolName) {
    case "legal_search":
    case "comprehensive_legal_scan":
    case "resolve_scope":
    case "fetch_legal_source":
      if (!policy.legalLibrary && !policy.regulations) {
        return {
          allowed: false,
          reason: "سياسة المصادر تمنع البحث في مكتبة الأنظمة/اللوائح.",
          code: "SOURCE_POLICY_DENIED",
        };
      }
      return { allowed: true };
    case "deep_legal_study":
      if (!policy.legalLibrary && !policy.judgments) {
        return {
          allowed: false,
          reason: "سياسة المصادر تمنع الدراسة الموسّعة خارج النطاق المسموح.",
          code: "SOURCE_POLICY_DENIED",
        };
      }
      return { allowed: true };
    case "read_attachment":
      if (!policy.attachments) {
        return {
          allowed: false,
          reason: "سياسة المصادر تمنع قراءة المرفقات في هذا الطلب.",
          code: "SOURCE_POLICY_DENIED",
        };
      }
      return { allowed: true };
    case "islamic_library_scan":
      // مصدر خارجي — يُعامل كويب/خارجي ويُمنع ما لم يُصرَّح
      if (!policy.web && !policy.organizationLibrary) {
        return {
          allowed: false,
          reason: "سياسة المصادر تمنع المصادر الخارجية/الويب.",
          code: "SOURCE_POLICY_DENIED",
        };
      }
      return { allowed: true };
    case "load_skill":
      return { allowed: true };
    default:
      if (policy.strictScope) {
        return {
          allowed: false,
          reason: `أداة غير مدرجة في قائمة السماح ضمن النطاق الصارم: ${toolName}`,
          code: "SOURCE_POLICY_DENIED",
        };
      }
      return { allowed: true };
  }
}

/** أدوات البحث التي تُسجَّل كمصادر مُستدعاة فعليًا */
export function isRetrievalTool(toolName: string): boolean {
  return (
    toolName === "legal_search" ||
    toolName === "comprehensive_legal_scan" ||
    toolName === "deep_legal_study" ||
    toolName === "fetch_legal_source" ||
    toolName === "read_attachment" ||
    toolName === "islamic_library_scan"
  );
}

export function describeSourcePolicy(policy: SourcePolicy): string[] {
  const labels: string[] = [];
  if (policy.legalLibrary) labels.push("مكتبة الأنظمة");
  if (policy.regulations) labels.push("اللوائح");
  if (policy.judgments) labels.push("الأحكام والمبادئ");
  if (policy.caseFiles) labels.push("ملفات القضايا");
  if (policy.attachments) labels.push("المرفقات");
  if (policy.organizationLibrary) labels.push("مكتبة المؤسسة");
  if (policy.web) labels.push("الويب");
  if (policy.strictScope) labels.push("نطاق صارم");
  return labels;
}
