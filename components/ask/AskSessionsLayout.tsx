"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AskSessionSidebar } from "@/components/ask/AskSessionSidebar";

export function AskSessionsLayout({
  activeConversationId,
  children,
}: {
  activeConversationId?: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const onCollapsedChange = useCallback((next: boolean) => {
    setCollapsed(next);
  }, []);

  const onNewSession = useCallback(() => {
    router.push("/dashboard/ask");
    setRefreshToken((n) => n + 1);
  }, [router]);

  // تحديث القائمة عند تغيّر الجلسة النشطة (بعد الحفظ)
  useEffect(() => {
    setRefreshToken((n) => n + 1);
  }, [activeConversationId]);

  return (
    <div className="hkm-sess-layout">
      <AskSessionSidebar
        activeConversationId={activeConversationId}
        onNewSession={onNewSession}
        refreshToken={refreshToken}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      />
      <div className="hkm-sess-layout-main">{children}</div>
    </div>
  );
}
