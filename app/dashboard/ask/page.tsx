import { requirePagePermission } from "@/lib/modules/auth/session";
import { HakeemAskWorkspace } from "@/components/ask/HakeemAskWorkspace";
import { QuotaCounter } from "@/components/billing/QuotaCounter";

export const dynamic = "force-dynamic";

/**
 * مسار متوافق مع الروابط القديمة — نفس مساحة العمل المستخدمة في /dashboard.
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

  return (
    <div className="mx-auto max-w-3xl">
      <QuotaCounter />
      <HakeemAskWorkspace
        userName={firstName}
        initialQuery={initialQuery}
        initialMode={initialMode}
        variant="page"
      />
    </div>
  );
}
