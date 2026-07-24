"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Msg = {
  id: string;
  senderRole: "user" | "admin";
  senderName?: string | null;
  body: string;
  createdAt: string;
};

const DRAFT_KEY = "hakeem-support-draft";

/**
 * نافذة تواصل خفيفة مع دعم حكيم — للعملاء فقط (ليس السوبر أدمن).
 * الشارة تُحدَّث والويدجت مغلق عبر ?peek=1 دون إنشاء خيط فارغ.
 */
export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) setText(draft);
    } catch {
      /* تجاهل */
    }
  }, []);

  async function loadThread() {
    try {
      const res = await fetch("/api/support/thread", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        messages?: Msg[];
      };
      if (data.ok && data.messages) {
        setMessages(data.messages);
        setUnread(0);
      }
    } catch {
      /* شبكة */
    }
  }

  async function peekUnread() {
    if (openRef.current) return;
    try {
      const res = await fetch("/api/support/thread?peek=1", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; unread?: number };
      if (data.ok) setUnread(Number(data.unread) || 0);
    } catch {
      /* شبكة */
    }
  }

  // عند الفتح: حمّل المحادثة وpoll الرسائل
  useEffect(() => {
    if (!open) return;
    void loadThread();
    const t = setInterval(() => void loadThread(), 8000);
    return () => clearInterval(t);
  }, [open]);

  // والويدجت مغلق: peek خفيف للشارة فقط (لا ينشئ خيطًا)
  useEffect(() => {
    if (open) return;
    void peekUnread();
    const t = setInterval(() => void peekUnread(), 20000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  function setDraft(next: string) {
    setText(next);
    try {
      if (!next.trim()) sessionStorage.removeItem(DRAFT_KEY);
      else sessionStorage.setItem(DRAFT_KEY, next.slice(0, 4000));
    } catch {
      /* تجاهل */
    }
  }

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    setStatus("جارٍ إرسال رسالتك…");
    startTransition(async () => {
      try {
        const res = await fetch("/api/support/thread", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          messages?: Msg[];
          message?: string;
        };
        if (res.status === 429) {
          setError(data.message || "انتظر دقيقة ثم أعد المحاولة.");
          setStatus(null);
          return;
        }
        if (!res.ok || !data.ok) {
          setError(data.message || "تعذّر إرسال الطلب. بقيت رسالتك محفوظة، أعد المحاولة.");
          setStatus(null);
          return;
        }
        setDraft("");
        if (data.messages) setMessages(data.messages);
        setUnread(0);
        setStatus("تم استلام رسالتك. سيظهر رد الدعم هنا عند وصوله.");
      } catch {
        setError("انقطع الاتصال. تحقق من الشبكة ثم أعد المحاولة.");
        setStatus(null);
      }
    });
  }

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 flex max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 sm:bottom-6 sm:left-6">
      {open ? (
        <section
          className="flex h-[min(420px,70vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-[#FFFcf7] shadow-[0_12px_40px_rgba(14,52,53,0.15)]"
          aria-label="محادثة الدعم"
        >
          <header className="flex items-center justify-between border-b border-[rgba(14,52,53,0.08)] bg-[#0E3435] px-4 py-3 text-[#FFFcf7]">
            <div>
              <p className="text-sm font-bold">الدعم والمساعدة</p>
              <p className="text-xs text-white/70">
                رسائلك تصل لإدارة حكيم — والرد يظهر في هذه المحادثة
              </p>
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

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
            {messages.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm leading-7 text-[rgba(14,52,53,0.55)]">
                اكتب استفسارك أو مشكلتك — سيظهر اسمك وبريدك للإدارة مع الرسالة. الردود تصل هنا.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.senderRole === "user";
                return (
                  <div
                    key={m.id}
                    className={
                      mine
                        ? "mr-6 rounded-lg bg-[#0E3435] px-3 py-2 text-sm leading-6 text-[#FFFcf7]"
                        : "ml-6 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)]"
                    }
                  >
                    <p className="text-[11px] font-bold opacity-80">
                      {mine ? "أنت" : m.senderName || "دعم حكيم"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-[10px] opacity-60">
                      {new Date(m.createdAt).toLocaleString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <footer className="border-t border-[rgba(14,52,53,0.08)] p-3">
            {error ? (
              <p className="mb-2 text-xs text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {status && !error ? (
              <p className="mb-2 text-xs text-[rgba(14,52,53,0.65)]" role="status">
                {status}
              </p>
            ) : null}
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="hakeem-support-input">
                رسالة الدعم
              </label>
              <textarea
                id="hakeem-support-input"
                value={text}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setStatus(null);
                }}
                rows={2}
                maxLength={4000}
                placeholder="اكتب رسالتك…"
                className="min-h-[44px] flex-1 resize-none rounded-md border border-[rgba(14,52,53,0.12)] bg-white px-3 py-2 text-sm text-[#0E3435] outline-none focus:border-[#C9A84C]"
                style={{ fontSize: 16 }}
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
                aria-busy={pending}
              >
                {pending ? "…" : "إرسال"}
              </button>
            </div>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setUnread(0);
        }}
        className="touch-target relative inline-flex min-h-[48px] items-center gap-2 rounded-[0.75rem] bg-[#0E3435] px-4 py-2.5 text-sm font-semibold text-[#FFFcf7] shadow-[0_8px_24px_rgba(14,52,53,0.2)] hover:bg-[#164849]"
        aria-expanded={open}
        aria-label={
          unread > 0
            ? `الدعم والمساعدة — ${unread} رسالة غير مقروءة`
            : "فتح الدعم والمساعدة"
        }
        title="الدعم والمساعدة"
      >
        الدعم
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-[#8B6914] px-1 text-[11px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
