/**
 * محاذاة إصدار عقد المرفقات بين العميل والخادم (Runtime).
 */
import { NextRequest } from "next/server";
import {
  alignClientServerDocumentFlags,
  type ClientServerFlagAlignment,
} from "@/lib/modules/hakeem-composer/document-flags";

export const ATTACHMENTS_VERSION_HEADER = "x-hakeem-attachments-version";

export type AttachmentsVersionClaim = {
  clientClaimsV2: boolean;
  raw: string | null;
};

/**
 * يقرأ ادّعاء العميل من الترويسة أو جسم الطلب.
 */
export function readAttachmentsVersionClaim(
  request: NextRequest,
  bodyOrForm?: { get?: (k: string) => FormDataEntryValue | null } | Record<string, unknown> | null
): AttachmentsVersionClaim {
  const header = request.headers.get(ATTACHMENTS_VERSION_HEADER)?.trim() ?? null;
  let field: string | null = null;
  if (bodyOrForm && typeof (bodyOrForm as { get?: unknown }).get === "function") {
    const v = (bodyOrForm as FormData).get("attachmentsVersion") ?? (bodyOrForm as FormData).get("clientFlag");
    field = v != null ? String(v) : null;
  } else if (bodyOrForm && typeof bodyOrForm === "object") {
    const o = bodyOrForm as Record<string, unknown>;
    if (o.attachmentsVersion != null) field = String(o.attachmentsVersion);
    else if (o.clientFlag != null) field = String(o.clientFlag);
  }
  const raw = header || field;
  const clientClaimsV2 =
    raw === "2" ||
    raw === "v2" ||
    raw === "V2" ||
    raw === "ATTACHMENTS_V2" ||
    String(raw || "").toLowerCase() === "true";
  return { clientClaimsV2, raw };
}

export type RuntimeFlagDecision =
  | { ok: true; alignment: ClientServerFlagAlignment; enforceV2: boolean }
  | {
      ok: false;
      code: "CLIENT_V2_SERVER_LEGACY" | "FEATURE_DISABLED";
      message: string;
      status: number;
      alignment: ClientServerFlagAlignment;
    };

/**
 * يطبّق المحاذاة على مسار رفع/استخراج V2.
 * CLIENT_V2_SERVER_LEGACY → رفض واضح دون إنشاء attachmentId يبدو V2.
 */
export function decideAttachmentsRuntime(input: {
  clientClaimsV2: boolean;
  /** هل هذا المسار يتطلّب V2 خادميًا؟ */
  requireServerV2?: boolean;
}): RuntimeFlagDecision {
  const alignment = alignClientServerDocumentFlags({
    clientClaimsV2: input.clientClaimsV2,
  });

  if (input.clientClaimsV2 && !alignment.serverHasV2) {
    return {
      ok: false,
      code: "CLIENT_V2_SERVER_LEGACY",
      message:
        "العميل يطلب مرفقات V2 بينما الخادم يعمل بوضع Legacy. عطّل NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2 أو فعّل HAKEEM_COMPOSER_ATTACHMENTS_V2.",
      status: 409,
      alignment,
    };
  }

  if (input.requireServerV2 && !alignment.serverHasV2) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "مسار المرفقات V2 معطّل على الخادم.",
      status: 503,
      alignment,
    };
  }

  return {
    ok: true,
    alignment,
    enforceV2: alignment.enforceV2,
  };
}

/**
 * لـ agent-search: عند ادّعاء V2 بلا خادم V2 → ارفض attachmentIds.
 * عند SERVER_V2_CLIENT_LEGACY → لا تدّعِ V2 للعميل؛ طبّق ids إن وُجدت وإلا legacy.
 */
export function decideAgentSearchAttachmentsMode(input: {
  clientClaimsV2: boolean;
  hasAttachmentIds: boolean;
}): {
  mode: "v2" | "legacy" | "reject_v2_claim";
  alignment: ClientServerFlagAlignment;
  code?: string;
  message?: string;
} {
  const alignment = alignClientServerDocumentFlags({
    clientClaimsV2: input.clientClaimsV2,
  });

  if (input.clientClaimsV2 && !alignment.serverHasV2) {
    return {
      mode: "reject_v2_claim",
      alignment,
      code: "CLIENT_V2_SERVER_LEGACY",
      message: "ادّعاء عميل V2 مرفوض: الخادم Legacy.",
    };
  }

  if (alignment.enforceV2 && input.hasAttachmentIds) {
    return { mode: "v2", alignment };
  }

  // SERVER_V2_CLIENT_LEGACY بلا ids → legacy document
  if (!input.clientClaimsV2 && alignment.serverHasV2 && !input.hasAttachmentIds) {
    return { mode: "legacy", alignment };
  }

  if (alignment.enforceV2) {
    return { mode: input.hasAttachmentIds ? "v2" : "legacy", alignment };
  }

  return { mode: "legacy", alignment };
}
