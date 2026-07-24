"use client";

import { useEffect, useState, useTransition } from "react";

type Thread = {
  id: string;
  userId: string;
  status: string;
  subject: string | null;
  lastMessageAt: string;
  unreadAdmin: number;
  userEmail?: string | null;
  userName?: string | null;
  preview?: string | null;
};

type Msg = {
  id: string;
  senderRole: "user" | "admin";
  body: string;
  createdAt: string;
};

export function AdminSupportInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadThreads() {
    const res = await fetch("/api/admin/support", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as { ok?: boolean; threads?: Thread[] };
    if (data.ok && data.threads) setThreads(data.threads);
  }

  async function openThread(id: string) {
    setActiveId(id);
    setError(null);
    const res = await fetch(`/api/admin/support/${id}`, { credentials: "same-origin" });
    if (!res.ok) {
      setError("تعذّر فتح المحادثة.");
      return;
    }
    const data = (await res.json()) as { ok?: boolean; thread?: Thread; messages?: Msg[] };
    if (data.ok) {
      setActive(data.thread || null);
      setMessages(data.messages || []);
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, unreadAdmin: 0 } : t))
      );
    }
  }

  useEffect(() => {
    void loadThreads();
    const t = setInterval(() => void loadThreads(), 12000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => void openThread(activeId), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function reply() {
    if (!activeId || !text.trim() || pending) return;
    const body = text.trim();
    startTransition(async () => {
      const res = await fetch(`/api/admin/support/${activeId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json()) as { ok?: boolean; messages?: Msg[]; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message || "تعذّر الإرسال.");
        return;
      }
      setText("");
      if (data.messages) setMessages(data.messages);
      void loadThreads();
    });
  }

  function closeActive() {
    if (!activeId || pending) return;
    startTransition(async () => {
      await fetch(`/api/admin/support/${activeId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      void loadThreads();
      if (active) setActive({ ...active, status: "closed" });
    });
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-4 py-3">
          <h2 className="font-bold text-[#0E3435]">المحادثات</h2>
        </div>
        <ul className="max-h-[70vh] divide-y divide-[rgba(14,52,53,0.06)] overflow-y-auto">
          {threads.length === 0 ? (
            <li className="p-4 text-sm text-[rgba(14,52,53,0.55)]">لا محادثات بعد.</li>
          ) : (
            threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className={
                    activeId === t.id
                      ? "w-full px-4 py-3 text-right bg-[#0E3435] text-[#FFFcf7]"
                      : "w-full px-4 py-3 text-right hover:bg-[#F7F2EA]"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {t.userName || t.userEmail || t.userId.slice(0, 8)}
                    </span>
                    {t.unreadAdmin > 0 ? (
                      <span className="rounded bg-[#8B6914] px-1.5 text-[11px] font-bold text-white">
                        {t.unreadAdmin}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={
                      activeId === t.id
                        ? "mt-1 truncate text-xs text-white/70"
                        : "mt-1 truncate text-xs text-[rgba(14,52,53,0.55)]"
                    }
                  >
                    {t.preview || t.subject || "—"}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        {!activeId || !active ? (
          <p className="m-auto p-8 text-sm text-[rgba(14,52,53,0.55)]">اختر محادثة للرد.</p>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(14,52,53,0.08)] px-4 py-3">
              <div>
                <p className="font-bold text-[#0E3435]">{active.userName || "مستخدم"}</p>
                <p className="text-xs text-[rgba(14,52,53,0.55)]" dir="ltr">
                  {active.userEmail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[rgba(14,52,53,0.5)]">
                  {active.status === "closed" ? "مغلقة" : "مفتوحة"}
                </span>
                {active.status !== "closed" ? (
                  <button
                    type="button"
                    onClick={closeActive}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.15)]"
                  >
                    إغلاق
                  </button>
                ) : null}
              </div>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.senderRole === "admin"
                      ? "mr-10 rounded-lg bg-[#0E3435] px-3 py-2 text-sm text-[#FFFcf7]"
                      : "ml-10 rounded-lg bg-white px-3 py-2 text-sm text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)]"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-60">
                    {new Date(m.createdAt).toLocaleString("ar-SA")}
                  </p>
                </div>
              ))}
            </div>
            <footer className="border-t border-[rgba(14,52,53,0.08)] p-3">
              {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
              <div className="flex gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="اكتب ردك…"
                  className="min-h-[44px] flex-1 resize-none rounded-md border border-[rgba(14,52,53,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      reply();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={pending || !text.trim()}
                  onClick={reply}
                  className="touch-target self-end rounded-md bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  رد
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
