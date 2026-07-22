"use client";

import { useRef, useState } from "react";

// صندوق محادثةٍ حيّ لوكيلٍ مخصّص — يبثّ ردًّا مؤصَّلًا بنطاق الوكيل (NDJSON) كصندوق «اسأل حكيم».
export type ChatSubRole = { id: string; label: string; stance: string };

type Msg = { role: "user" | "assistant"; content: string; sources?: Array<{ system: string; article: string; enforcement: string }> };

export function AgentChat({ agentId, displayName, scope, subRoles }: { agentId: string; displayName: string; scope: string[]; subRoles: ChatSubRole[] }) {
  const [subRoleId, setSubRoleId] = useState<string>(subRoles[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); });

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    scrollDown();
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, subRoleId: subRoleId || undefined }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "تعذّر بدء المحادثة.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sources: Msg["sources"] | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let ev: { type?: string; text?: string; sources?: Msg["sources"]; message?: string };
          try { ev = JSON.parse(t); } catch { continue; }
          if (ev.type === "basis") sources = ev.sources;
          else if (ev.type === "delta" && ev.text) {
            setMsgs((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + ev.text, sources };
              return next;
            });
            scrollDown();
          } else if (ev.type === "error") setError(ev.message ?? "خطأ غير متوقّع.");
        }
      }
      setMsgs((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, sources };
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت المحادثة.");
      setMsgs((prev) => prev.slice(0, -1)); // أزِل فقاعة الوكيل الفارغة
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  return (
    <div className="rounded-[var(--r-xl)] border border-line bg-ivory p-4 shadow-sm" dir="rtl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[var(--petrol)]">محادثةٌ حيّة — {displayName}</h3>
        {subRoles.length ? (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            الموقف:
            <select value={subRoleId} onChange={(e) => setSubRoleId(e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--ink-15)] bg-white px-2 py-1 text-xs">
              {subRoles.map((sr) => <option key={sr.id} value={sr.id}>{sr.label} · {sr.stance}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <p className="mb-2 text-[11px] leading-6 text-[var(--ink-50)]">
        مؤصَّلٌ حصريًا بنطاق الوكيل: {scope.join(" · ")}. لا اختلاق ولا خروجٌ عن النطاق.
      </p>

      <div ref={scrollRef} className="max-h-[46vh] space-y-3 overflow-y-auto rounded-[var(--r-md)] bg-[var(--ink-02,#faf9f7)] p-3">
        {msgs.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">اطرح سؤالًا في نطاق هذا الوكيل — يجيب مستندًا لمواد النواة ضمن نطاقه.</p>
        ) : null}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-left" : "text-right"}>
            <div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-[var(--r-md)] px-3 py-2 text-sm leading-7 ${m.role === "user" ? "bg-[var(--petrol)] text-white" : "border border-line bg-white text-[var(--ink-80)]"}`}>
              {m.content || (busy && i === msgs.length - 1 ? "…" : "")}
            </div>
            {m.role === "assistant" && m.sources?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.sources.map((s, j) => (
                  <span key={j} className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-[var(--muted)]">{s.system} — م{s.article}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {error ? <div className="mt-2 rounded-[var(--r-sm)] bg-[var(--ruby-soft)] px-3 py-2 text-xs text-[var(--ruby)]">{error}</div> : null}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={2}
          placeholder="اكتب سؤالك للوكيل…"
          className="focus-ring min-h-[44px] flex-1 resize-y rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-3 py-2 text-sm"
          disabled={busy}
        />
        <button type="button" onClick={() => void send()} disabled={busy || !input.trim()} className="btn btn-gold shrink-0 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          {busy ? "…" : "إرسال"}
        </button>
      </div>
    </div>
  );
}
