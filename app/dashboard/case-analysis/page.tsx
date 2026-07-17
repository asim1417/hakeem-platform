import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// توحيد الأوضاع: «تحليل القضايا» صار نمط «حلّل قضية» داخل «اسأل حكيم».
// تبقى المسار عاملًا كتحويلٍ دائم للنمط المقابل. انظر docs/agent-modes-unification.md.
export default async function CaseAnalysisPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  redirect("/dashboard/ask?mode=analyze-case");
}
