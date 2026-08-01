/**
 * سياسة المصادر — الخادم يبني السياسة النهائية (effective) ولا يثق بـ boolean من العميل.
 *
 * القرار المعماري للمرفقات (خيار أ):
 * المرفق المرفوع مع الطلب سياق متاح للقراءة دائمًا ما لم يُختر «المرفقات فقط» كحصر،
 * أو يُمنع صراحةً. لذلك وصف الواجهة: «مكتبة الأنظمة (+ المرفق الحالي إن وُجد)» لا «أنظمة فقط».
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

export const SOURCE_POLICY_KEYS = [
  "legalLibrary",
  "regulations",
  "judgments",
  "caseFiles",
  "attachments",
  "organizationLibrary",
  "web",
  "strictScope",
] as const;

export const sourcePolicySchema = z
  .object({
    legalLibrary: z.boolean(),
    regulations: z.boolean(),
    judgments: z.boolean(),
    caseFiles: z.boolean(),
    attachments: z.boolean(),
    organizationLibrary: z.boolean(),
    web: z.boolean(),
    strictScope: z.boolean(),
  })
  .strict();

/** سياسة مقيدة آمنة — لا توسّع النطاق عند الشك */
export const RESTRICTED_SOURCE_POLICY: SourcePolicy = {
  legalLibrary: false,
  regulations: false,
  judgments: false,
  caseFiles: false,
  attachments: false,
  organizationLibrary: false,
  web: false,
  strictScope: true,
};

/** السلوك التاريخي عند تعطيل العلم فقط */
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

/** حقول لا يُسمح للعميل بتفعيلها مباشرة — الخادم فقط */
export const CLIENT_FORBIDDEN_SOURCE_FIELDS = [
  "caseFiles",
  "organizationLibrary",
  "web",
] as const;

export type DeniedSource = {
  source: keyof SourcePolicy | ComposerSourceId | string;
  reason: string;
};

export type ServerSourceCapabilities = {
  allowLegalLibrary: boolean;
  allowRegulations: boolean;
  allowJudgments: boolean;
  /** يتطلب قضية مربوطة + ملكية — غير مفعّل في هذه المرحلة */
  allowCaseFiles: boolean;
  allowAttachments: boolean;
  /** يتطلب مكتبة مؤسسة مربوطة — غير مفعّل افتراضيًا */
  allowOrganizationLibrary: boolean;
  /** يتطلب HAKEEM_ALLOW_WEB_SOURCE=1 */
  allowWeb: boolean;
};

export type ResolveEffectiveSourcePolicyInput = {
  requestedSources?: unknown;
  requestedPolicy?: unknown;
  hasAttachment: boolean;
  caseContext?: { caseId?: string | null; owned?: boolean } | null;
  serverCapabilities: ServerSourceCapabilities;
  /** عند true: سياسة تالفة → خطأ بدل تقييد صامت */
  failOnInvalidPolicy?: boolean;
};

export type ResolveEffectiveSourcePolicyResult =
  | {
      ok: true;
      requestedSources: ComposerSourceId[];
      requestedPolicy: SourcePolicy;
      effectivePolicy: SourcePolicy;
      deniedSources: DeniedSource[];
      reasons: string[];
    }
  | {
      ok: false;
      code: "INVALID_SOURCE_POLICY";
      message: string;
      details?: unknown;
    };

const ALLOWED_SOURCE_IDS: ComposerSourceId[] = [
  "legal-core",
  "regulations",
  "rulings-principles",
  "attached-only",
  "user-docs",
  "case-files",
];

export function isSourcePolicyV2Enabled(): boolean {
  const v = (process.env.HAKEEM_COMPOSER_SOURCE_POLICY_V2 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function defaultServerCapabilities(input?: {
  hasAttachment?: boolean;
  caseOwned?: boolean;
}): ServerSourceCapabilities {
  return {
    allowLegalLibrary: true,
    allowRegulations: true,
    allowJudgments: true,
    allowCaseFiles: Boolean(input?.caseOwned),
    allowAttachments: true,
    allowOrganizationLibrary: false,
    allowWeb: (process.env.HAKEEM_ALLOW_WEB_SOURCE ?? "").trim() === "1",
  };
}

/**
 * يحوّل اختيارات الواجهة إلى سياسة مطلوبة (requested) — ليست فعّالة.
 * المرفقات: متاحة كسياق عند الرفع (خيار أ) إلا في attached-only كحصر.
 */
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
  // طلب واجهة فقط — يُصفَّر لاحقًا إن لم يثبت الخادم السماح
  const caseFilesRequested = set.has("case-files");
  const attachments = true; // خيار أ: المرفق الحالي سياق متاح إن وُجد
  return {
    legalLibrary,
    regulations,
    judgments,
    caseFiles: caseFilesRequested,
    attachments,
    organizationLibrary: false,
    web: false,
    strictScope:
      caseFilesRequested ||
      (legalLibrary && !judgments && set.size <= 2) ||
      (judgments && !legalLibrary) ||
      set.has("user-docs"),
  };
}

/** يصفّر الحقول الحساسة من أي سياسة واردة من العميل */
export function stripClientPrivilegedFields(policy: SourcePolicy): SourcePolicy {
  return {
    ...policy,
    caseFiles: false,
    organizationLibrary: false,
    web: false,
  };
}

/**
 * يتحقق من سياسة واردة. عند الفشل لا يعيد Default واسعًا.
 * يعيد null إن غير صالحة.
 */
export function parseRequestedPolicyStrict(raw: unknown):
  | { ok: true; policy: SourcePolicy }
  | { ok: false; message: string; details?: unknown } {
  if (raw == null) {
    return { ok: false, message: "سياسة المصادر فارغة.", details: { raw } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "سياسة المصادر يجب أن تكون كائنًا.", details: { type: Array.isArray(raw) ? "array" : typeof raw } };
  }
  const parsed = sourcePolicySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "سياسة مصادر غير صالحة.",
      details: parsed.error.flatten(),
    };
  }
  return { ok: true, policy: stripClientPrivilegedFields(parsed.data) };
}

export function parseRequestedSources(raw: unknown):
  | { ok: true; sources: ComposerSourceId[] }
  | { ok: false; message: string; details?: unknown } {
  if (raw == null) return { ok: true, sources: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, message: "sources يجب أن تكون مصفوفة.", details: { type: typeof raw } };
  }
  const sources: ComposerSourceId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !ALLOWED_SOURCE_IDS.includes(item as ComposerSourceId)) {
      return {
        ok: false,
        message: "عنصر مصدر غير معروف.",
        details: { item },
      };
    }
    sources.push(item as ComposerSourceId);
  }
  return { ok: true, sources };
}

/**
 * يبني السياسة النهائية: طلب المستخدم ∩ صلاحيات الخادم.
 * لا يستخدم requestedPolicy من العميل لتنفيذ الأدوات مباشرة.
 */
export function resolveEffectiveSourcePolicy(
  input: ResolveEffectiveSourcePolicyInput
): ResolveEffectiveSourcePolicyResult {
  const deniedSources: DeniedSource[] = [];
  const reasons: string[] = [];

  const sourcesParsed = parseRequestedSources(input.requestedSources);
  if (!sourcesParsed.ok) {
    return {
      ok: false,
      code: "INVALID_SOURCE_POLICY",
      message: sourcesParsed.message,
      details: sourcesParsed.details,
    };
  }

  let requestedPolicy: SourcePolicy;
  const requestedSources = sourcesParsed.sources;

  if (requestedSources.length > 0) {
    requestedPolicy = composerSourcesToPolicy(requestedSources);
    // إن أرسل العميل sourcePolicy مع sources: نتجاهل الحقول الحساسة ونستخدم sources كمصدر حقيقة للطلب
    if (input.requestedPolicy != null) {
      const clientPol = parseRequestedPolicyStrict(input.requestedPolicy);
      if (!clientPol.ok && input.failOnInvalidPolicy !== false) {
        return {
          ok: false,
          code: "INVALID_SOURCE_POLICY",
          message: clientPol.message,
          details: clientPol.details,
        };
      }
      // أي محاولة تفعيل حقول حساسة تُسجَّل رفضًا
      if (clientPol.ok) {
        const raw = input.requestedPolicy as Record<string, unknown>;
        for (const field of CLIENT_FORBIDDEN_SOURCE_FIELDS) {
          if (raw[field] === true) {
            deniedSources.push({
              source: field,
              reason: `محاولة تفعيل ${field} من العميل مرفوضة؛ يقررها الخادم فقط.`,
            });
          }
        }
      }
    }
  } else if (input.requestedPolicy != null) {
    const clientPol = parseRequestedPolicyStrict(input.requestedPolicy);
    if (!clientPol.ok) {
      return {
        ok: false,
        code: "INVALID_SOURCE_POLICY",
        message: clientPol.message,
        details: clientPol.details,
      };
    }
    requestedPolicy = clientPol.policy;
    const raw = input.requestedPolicy as Record<string, unknown>;
    for (const field of CLIENT_FORBIDDEN_SOURCE_FIELDS) {
      if (raw[field] === true) {
        deniedSources.push({
          source: field,
          reason: `محاولة تفعيل ${field} من العميل مرفوضة؛ يقررها الخادم فقط.`,
        });
      }
    }
  } else {
    requestedPolicy = { ...DEFAULT_SOURCE_POLICY };
  }

  // تقاطع مع قدرات الخادم
  const cap = input.serverCapabilities;
  const effective: SourcePolicy = { ...RESTRICTED_SOURCE_POLICY };

  const grant = (key: keyof SourcePolicy, want: boolean, allowed: boolean, reason: string) => {
    if (want && allowed) {
      (effective as Record<string, boolean>)[key] = true;
    } else if (want && !allowed) {
      deniedSources.push({ source: key, reason });
      reasons.push(reason);
      (effective as Record<string, boolean>)[key] = false;
    } else {
      (effective as Record<string, boolean>)[key] = false;
    }
  };

  grant("legalLibrary", requestedPolicy.legalLibrary, cap.allowLegalLibrary, "لا صلاحية لمكتبة الأنظمة.");
  grant("regulations", requestedPolicy.regulations, cap.allowRegulations, "لا صلاحية للوائح.");
  grant("judgments", requestedPolicy.judgments, cap.allowJudgments, "لا صلاحية للأحكام والمبادئ.");
  grant(
    "caseFiles",
    requestedPolicy.caseFiles,
    cap.allowCaseFiles && Boolean(input.caseContext?.caseId && input.caseContext?.owned),
    "ملفات القضايا غير متاحة: يلزم سياق قضية مملوك ومصرّح."
  );
  grant(
    "attachments",
    requestedPolicy.attachments,
    cap.allowAttachments,
    "لا صلاحية للمرفقات."
  );
  // organizationLibrary و web: لا يُفعَّلان من boolean العميل.
  // الخادم فقط يمنحها عند وجود ربط/تصريح حقيقي (allowOrganizationLibrary / مسار ويب معتمد).
  effective.organizationLibrary = Boolean(cap.allowOrganizationLibrary);
  {
    const clientOrg =
      input.requestedPolicy != null &&
      typeof input.requestedPolicy === "object" &&
      !Array.isArray(input.requestedPolicy) &&
      (input.requestedPolicy as Record<string, unknown>).organizationLibrary === true;
    if (clientOrg && !cap.allowOrganizationLibrary) {
      if (!deniedSources.some((d) => d.source === "organizationLibrary")) {
        deniedSources.push({
          source: "organizationLibrary",
          reason: "مكتبة المؤسسة غير مربوطة أو غير مصرّح بها؛ لا تُفعَّل من العميل.",
        });
        reasons.push("مكتبة المؤسسة مرفوضة.");
      }
    } else if (clientOrg && cap.allowOrganizationLibrary) {
      // مسموح خادميًا — تبقى true من القدرة أعلاه؛ نسجّل أن الطلب جاء من العميل بعد التحقق
      reasons.push("مكتبة المؤسسة مُنحت بتصريح خادمي.");
    }
  }

  // لا مسار طلب مشروع للويب في واجهة المصادر الحالية — تبقى false دائمًا في هذه الجولة.
  effective.web = false;
  {
    const clientWeb =
      input.requestedPolicy != null &&
      typeof input.requestedPolicy === "object" &&
      !Array.isArray(input.requestedPolicy) &&
      (input.requestedPolicy as Record<string, unknown>).web === true;
    if (clientWeb) {
      if (!deniedSources.some((d) => d.source === "web")) {
        deniedSources.push({
          source: "web",
          reason: "الويب لا يُفعَّل من العميل؛ يلزم تصريح خادمي ومسار طلب معتمد.",
        });
        reasons.push("الويب مرفوض من طلب العميل.");
      }
    }
  }

  // strictScope من الطلب أو عند تضييق فعلي
  effective.strictScope =
    requestedPolicy.strictScope ||
    (!effective.legalLibrary && effective.attachments) ||
    Boolean(requestedSources.includes("attached-only"));

  // مرفقات فقط بلا ملف: يبقى attachments=true في السياسة لكن المسار يرفض لاحقًا بـ 400
  if (!input.hasAttachment && effective.attachments && !effective.legalLibrary && !effective.regulations && !effective.judgments) {
    reasons.push("نطاق المرفقات فقط يتطلّب ملفًا مرفقًا.");
  }

  return {
    ok: true,
    requestedSources,
    requestedPolicy: stripClientPrivilegedFields(requestedPolicy),
    effectivePolicy: effective,
    deniedSources,
    reasons,
  };
}

/** @deprecated استخدم resolveEffectiveSourcePolicy — لا توسّع النطاق عند الفشل */
export function normalizeSourcePolicy(raw: unknown): SourcePolicy {
  const parsed = parseRequestedPolicyStrict(raw);
  if (!parsed.ok) return { ...RESTRICTED_SOURCE_POLICY };
  return parsed.policy;
}

export type ToolAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: string; code: "SOURCE_POLICY_DENIED" };

/**
 * يقرر إن كانت أداة الوكيل مسموحة ضمن السياسة الفعّالة فقط.
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
      // خارجي/ويب أو مكتبة مؤسسة — كلاهما يُمنحان من الخادم فقط في effectivePolicy
      if (!policy.web && !policy.organizationLibrary) {
        return {
          allowed: false,
          reason: "سياسة المصادر تمنع المصادر الخارجية ومكتبة المؤسسة.",
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
  if (policy.attachments) labels.push("المرفق الحالي");
  if (policy.organizationLibrary) labels.push("مكتبة المؤسسة");
  if (policy.web) labels.push("الويب");
  if (policy.strictScope) labels.push("نطاق صارم");
  return labels;
}
