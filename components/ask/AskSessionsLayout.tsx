"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AskSessionSidebar } from "@/components/ask/AskSessionSidebar";

const COLLAPSE_KEY = "hakeem-ask-sessions-collapsed";

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

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* تجاهل */
    }
  }, []);

  const onCollapsedChange = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* تجاهل */
    }
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
    <div className="ask-sessions-layout">
      <AskSessionSidebar
        activeConversationId={activeConversationId}
        onNewSession={onNewSession}
        refreshToken={refreshToken}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      />
      <div className="ask-sessions-layout__main">{children}</div>
    </div>
  );
}
