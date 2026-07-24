"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Msg = {
  id: string;
  senderRole: "user" | "admin";
  body: string;
  createdAt: string;
};

/**
 * نافذة تواصل خفيفة مع السوبر أدمن — تظهر في الداشبورد بعد تسجيل الدخول.
 */
export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  async function load() {
    try {
      const res = await fetch("/api/support/thread", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        messages?: Msg[];
        thread?: { unreadUser?: number };
      };
      if (data.ok && data.messages) {
        setMessages(data.messages);
        setUnread(open ? 0 : Number(data.thread?.unreadUser) || 0);
      }
    } catch {
      /* شبكة */
    }
  }

  useEffect(() => {
    if (!open) return;
    loaded.current = true;
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إعادة التحميل عند الفتح فقط
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/support/thread", {
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
        setUnread(0);
      } catch {
        setError("تعذّر الاتصال. حاول مرة أخرى.");
      }
    });
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2 sm:bottom-6 sm:left-6">
      {open ? (
        <section
          className="flex h-[min(420px,70vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-[#FFFcf7] shadow-[0_12px_40px_rgba(14,52,53,0.15)]"
          aria-label="محادثة الدعم"
        >
          <header className="flex items-center justify-between border-b border-[rgba(14,52,53,0.08)] bg-[#0E3435] px-4 py-3 text-[#FFFcf7]">
            <div>
              <p className="text-sm font-bold">تواصل مع حكيم</p>
              <p className="text-xs text-white/70">رد مباشر من إدارة المنصة</p>
            </div>
            <button
              type="button"
              className="touch-target rounded-md px-2 py-1 text-sm hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المحادثة"
            >
              إغلاق
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm leading-7 text-[rgba(14,52,53,0.55)]">
                اكتب استفسارك أو مشكلتك — سنرد عليك من هنا.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.senderRole === "user"
                      ? "mr-6 rounded-lg bg-[#0E3435] px-3 py-2 text-sm leading-6 text-[#FFFcf7]"
                      : "ml-6 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)]"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-60">
                    {new Date(m.createdAt).toLocaleString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <footer className="border-t border-[rgba(14,52,53,0.08)] p-3">
            {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
            <div className="flex gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={4000}
                placeholder="اكتب رسالتك…"
                className="min-h-[44px] flex-1 resize-none rounded-md border border-[rgba(14,52,53,0.12)] bg-white px-3 py-2 text-sm text-[#0E3435] outline-none focus:border-[#C9A84C]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={send}
                className="touch-target self-end rounded-md bg-[#8B6914] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                إرسال
              </button>
            </div>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
        className="touch-target relative inline-flex min-h-[48px] items-center gap-2 rounded-[0.75rem] bg-[#0E3435] px-4 py-2.5 text-sm font-semibold text-[#FFFcf7] shadow-[0_8px_24px_rgba(14,52,53,0.2)] hover:bg-[#164849]"
        aria-expanded={open}
        aria-label="فتح محادثة الدعم"
      >
        تواصل معنا
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-[#8B6914] px-1 text-[11px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
