"use client";

import { HakeemAskWorkspace, type HakeemAskWorkspaceProps } from "@/components/ask/HakeemAskWorkspace";
import { AskSessionsLayout } from "@/components/ask/AskSessionsLayout";

/**
 * غلاف المرحلة 3A: قائمة جلسات أساسية + مساحة اسأل.
 * لا يغيّر منطق agent-search.
 */
export function AskWorkspaceWithSessions(
  props: HakeemAskWorkspaceProps & { conversationId?: string | null }
) {
  return (
    <AskSessionsLayout activeConversationId={props.conversationId ?? null}>
      <HakeemAskWorkspace {...props} conversationId={props.conversationId ?? null} />
    </AskSessionsLayout>
  );
}
