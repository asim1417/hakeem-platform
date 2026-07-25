import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { AskWorkspaceWithSessions } from "@/components/ask/AskWorkspaceWithSessions";
import { QuotaCounter } from "@/components/billing/QuotaCounter";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";

export const dynamic = "force-dynamic";

/**
 * رابط دائم لجلسة «اسأل حكيم».
 * /dashboard/ask/c/[conversationId]
 */
export default async function AskConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const user = await requirePagePermission("LEGAL_CORE_VIEW");
  const conversationId = params?.conversationId?.trim();
  if (!conversationId || conversationId.length < 8) notFound();

  const firstName = user.name?.split(" ").filter(Boolean)[0] ?? user.name ?? "";
  const askFirst = isAskFirstHomeEnabled();

  return (
    <div className="ask-page">
      <QuotaCounter />
      <AskWorkspaceWithSessions
        userName={firstName}
        variant={askFirst ? "home" : "page"}
        conversationId={conversationId}
      />
    </div>
  );
}
