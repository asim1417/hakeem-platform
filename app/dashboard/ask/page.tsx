import { requirePagePermission } from "@/lib/modules/auth/session";
import { HakeemAskWorkspace } from "@/components/ask/HakeemAskWorkspace";
import { QuotaCounter } from "@/components/billing/QuotaCounter";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";

export const dynamic = "force-dynamic";

/**
 * مسار توافق خلفي — نفس HakeemAskWorkspace المستخدم في /dashboard.
 * عند ASK_FIRST_HOME يعرض التجربة المطابقة للرئيسية (بدون رابط قائمة منفصل).
 * لا يُحذف المسار حفاظًا على الروابط القديمة و?q= و?mode=.
 */
export default async function AskHakeemPage({
  searchParams,
}: {
  searchParams: { q?: string; mode?: string };
}) {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");
  const initialQuery = typeof searchParams?.q === "string" ? searchParams.q : "";
  const initialMode = typeof searchParams?.mode === "string" ? searchParams.mode : "ask";
  const firstName = user.name?.split(" ").filter(Boolean)[0] ?? user.name ?? "";
  const askFirst = isAskFirstHomeEnabled();

  return (
    <div className="mx-auto max-w-3xl">
      <QuotaCounter />
      <HakeemAskWorkspace
        userName={firstName}
        initialQuery={initialQuery}
        initialMode={initialMode}
        variant={askFirst ? "home" : "page"}
      />
    </div>
  );
}
