import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// توحيد الأوضاع: «الوكيل القانوني» صار نمط «خطة عمل» داخل «اسأل حكيم».
// تبقى المسار عاملًا كتحويلٍ دائم للنمط المقابل. انظر docs/agent-modes-unification.md.
export default async function LegalAgentPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  redirect("/dashboard/ask?mode=action-plan");
}
