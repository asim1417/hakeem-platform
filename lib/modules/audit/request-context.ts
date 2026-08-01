import "server-only";

import { headers } from "next/headers";
import { HAKEEM_CORRELATION_HEADER } from "@/lib/modules/auth/request-path-headers";

/**
 * قراءة معرّف الارتباط الذي حقنه middleware في رأس الطلب (§6).
 * دفاعيّة: خارج سياق الطلب (وظائف خلفية/سكربتات) تعيد undefined دون تعطّل،
 * فيتولّى مغلّف الحدث توليد معرّف جديد.
 */
export function getRequestCorrelationId(): string | undefined {
  try {
    return headers().get(HAKEEM_CORRELATION_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}
