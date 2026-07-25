"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, PanelRightClose, PanelRightOpen, RefreshCw, X } from "lucide-react";
import { listAskSessions, type AskSessionListItem } from "@/components/ask/ask-session-api";

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  if (days < 7) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar-SA");
}

export type AskSessionSidebarProps = {
  activeConversationId?: string | null;
  onNewSession: () => void;
  /** يُستدعى بعد تحميل/تحديث القائمة (اختياري) */
  refreshToken?: number;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function AskSessionSidebar({
  activeConversationId,
  onNewSession,
  refreshToken = 0,
  collapsed = false,
  onCollapsedChange,
}: AskSessionSidebarProps) {
  const [items, setItems] = useState<AskSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listAskSessions({ take: 40 });
    if (!res.ok) {
      setError(res.message ?? "تعذّر جلب الجلسات.");
      setItems([]);
    } else {
      setItems(res.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const panel = (
    <div className="hkm-sess-panel">
      <div className="hkm-sess-panel-head">
        <h2 className="hkm-sess-panel-title">الجلسات</h2>
        <div className="hkm-sess-panel-head-actions">
          <button
            type="button"
            className="hkm-sess-panel-icon-btn"
            onClick={() => void load()}
            aria-label="تحديث قائمة الجلسات"
            title="تحديث"
          >
            <RefreshCw size={16} aria-hidden />
          </button>
          {onCollapsedChange ? (
            <button
              type="button"
              className="hkm-sess-panel-icon-btn hkm-sess-panel-collapse-desktop"
              onClick={() => onCollapsedChange(true)}
              aria-label="طي قائمة الجلسات"
            >
              <PanelRightClose size={16} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="hkm-sess-panel-icon-btn hkm-sess-panel-close-mobile"
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق قائمة الجلسات"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      <button type="button" className="hkm-sess-panel-new" onClick={onNewSession}>
        <MessageSquarePlus size={16} aria-hidden />
        جلسة جديدة
      </button>

      <div className="hkm-sess-panel-list" role="list">
        {loading ? (
          <p className="hkm-sess-panel-hint" aria-busy="true">
            جارٍ التحميل…
          </p>
        ) : error ? (
          <div className="hkm-sess-panel-error">
            <p>{error}</p>
            <button type="button" onClick={() => void load()}>
              إعادة المحاولة
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="hkm-sess-panel-hint">لا توجد جلسات بعد. ابدأ بسؤال جديد.</p>
        ) : (
          items.map((item) => {
            const active = item.id === activeConversationId;
            return (
              <Link
                key={item.id}
                href={`/dashboard/ask/c/${item.id}`}
                role="listitem"
                className={
                  active
                    ? "hkm-sess-panel-item hkm-sess-panel-item-active"
                    : "hkm-sess-panel-item"
                }
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <span className="hkm-sess-panel-item-title">{item.title}</span>
                {item.preview ? (
                  <span className="hkm-sess-panel-item-preview">{item.preview}</span>
                ) : null}
                <span className="hkm-sess-panel-item-meta">
                  {relativeTime(item.updatedAt)}
                  {item.messageCount > 0 ? ` · ${item.messageCount} رسالة` : ""}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="hkm-sess-panel-mobile-open"
        onClick={() => setMobileOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
      >
        الجلسات
      </button>

      {collapsed ? (
        <button
          type="button"
          className="hkm-sess-panel-expand-desktop"
          onClick={() => onCollapsedChange?.(false)}
          aria-label="إظهار قائمة الجلسات"
        >
          <PanelRightOpen size={18} aria-hidden />
          <span>الجلسات</span>
        </button>
      ) : (
        <aside className="hkm-sess-panel-desktop" aria-label="جلسات اسأل حكيم">
          {panel}
        </aside>
      )}

      {mobileOpen ? (
        <div className="hkm-sess-drawer" role="dialog" aria-modal="true" aria-label="جلسات اسأل حكيم">
          <button
            type="button"
            className="hkm-sess-drawer-backdrop"
            aria-label="إغلاق"
            onClick={() => setMobileOpen(false)}
          />
          <div className="hkm-sess-drawer-sheet">{panel}</div>
        </div>
      ) : null}
    </>
  );
}
