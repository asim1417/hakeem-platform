import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import type { Permission } from "@/lib/modules/auth/role-permissions";
import {
  conversationServiceSchema,
  type ConversationService,
} from "@/lib/modules/conversations/types";

/** صلاحية المسار حسب الخدمة — لا تخلط JA مع ask. */
export function permissionForService(service: ConversationService): Permission {
  if (service === "judicial-assistant") return "JUDICIAL_ASSISTANT_USE";
  return "LEGAL_CORE_VIEW";
}

export async function requireConversationService(
  request: NextRequest,
  serviceRaw: unknown
): Promise<
  | { ok: true; userId: string; serviceKey: ConversationService }
  | { ok: false; response: Response }
> {
  const parsed = conversationServiceSchema.safeParse(serviceRaw);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, message: "معامل service مطلوب: ask | judicial-assistant | legal-chat" },
        { status: 400 }
      ),
    };
  }
  const serviceKey = parsed.data;
  const gate = await requireApiPermission(permissionForService(serviceKey), request);
  if (gate.response) return { ok: false, response: gate.response };
  if (!gate.user) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: "يلزم تسجيل الدخول." }, { status: 401 }),
    };
  }
  return { ok: true, userId: gate.user.id, serviceKey };
}
