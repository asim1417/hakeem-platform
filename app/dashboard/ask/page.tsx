import { requirePagePermission } from "@/lib/modules/auth/session";
import { AgentSearchPanel } from "@/components/agent/AgentSearchPanel";

export const dynamic = "force-dynamic";

export default async function AskHakeemPage({ searchParams }: { searchParams: { q?: string; mode?: string } }) {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");
  const initialQuery = typeof searchParams?.q === "string" ? searchParams.q : "";
  const initialMode = typeof searchParams?.mode === "string" ? searchParams.mode : "ask";
  const firstName = user.name?.split(" ").filter(Boolean)[0] ?? user.name ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <AgentSearchPanel userName={firstName} initialQuery={initialQuery} initialMode={initialMode} />
    </div>
  );
}
