// تدقيق عمليّات أداة الوثائق — يربط كل عمليّة حفظ/مسح بالمستخدم المُصادَق (إن وُجد)
// ويكتبها في سجلّ التدقيق المركزيّ (audit_logs) فتُعرَض في لوحة الإدارة كبقيّة المنصّة.
//
// المبادئ:
//  • fail-open: التدقيق لا يعطّل عمليّة المستخدم أبدًا (كل شيء داخل try/catch).
//  • خصوصيّة: لا يُسجَّل نصٌّ خام ولا صور — بياناتٌ وصفيّة فقط (عدد/عناوين مقتضبة).
//  • بلا أسرار: entityId هو معرّف مساحة العمل (UUID) لا قيمة الكوكي السرّيّة.
//  • مُفعَّل افتراضيًا مع مفتاح إيقافٍ طارئ: HAKEEM_DOC_TOOL_AUDIT_V1=0.

import type { NextRequest } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { summarizeDocDelta } from "@/lib/modules/doc-tool/doc-delta";

export { summarizeDocDelta };

function enabled(): boolean {
  const v = (process.env.HAKEEM_DOC_TOOL_AUDIT_V1 ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function clientIp(request?: NextRequest): string | undefined {
  const xff = request?.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim().slice(0, 45) || undefined;
  return request?.headers.get("x-real-ip")?.slice(0, 45) || undefined;
}

/**
 * يسجّل عمليّة أداة الوثائق في سجلّ التدقيق. fail-open تمامًا: أيّ خطأ يُبتلع بصمت
 * فلا يتأثّر حفظ المستخدم. لا يُنتظَر أثرُه على مسار العمليّة الأساسيّة.
 */
export async function auditDocToolOp(input: {
  action: string;
  workspaceId?: string;
  request?: NextRequest;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!enabled()) return;
  try {
    const user = await getApiUser(input.request).catch(() => null);
    await auditEvent({
      actorId: user?.id,
      subject: "LIBRARY",
      action: input.action,
      entityId: input.workspaceId,
      ipAddress: clientIp(input.request),
      metadata: { source: "documents-tool", ...(input.metadata ?? {}) }
    });
  } catch {
    /* fail-open: التدقيق لا يعطّل عمليّة المستخدم أبدًا */
  }
}
