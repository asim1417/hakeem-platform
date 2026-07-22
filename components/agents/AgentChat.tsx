"use client";

import { useRef, useState } from "react";
import { AnswerRenderer } from "@/components/AnswerRenderer";
import { AnswerToolbar } from "@/components/AnswerToolbar";
import { useWakeLock } from "@/components/hooks/useWakeLock";

// صندوق محادثةٍ حيّ لوكيلٍ مخصّص — يبثّ ردًّا مؤصَّلًا بنطاق الوكيل (NDJSON) كصندوق «اسأل حكيم».
export type ChatSubRole = { id: string; label: string; stance: string };

type Msg = { role: "user" | "assistant"; content: string; sources?: Array<{ system: string; article: string; enforcement: string }> };

export function AgentChat({ agentId, displayName, scope, subRoles }: { agentId: string; displayName: string; scope: string[]; subRoles: ChatSubRole[] }) {
  const [subRoleId, setSubRoleId] = useState<string>(subRoles[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // مرفق/نصّ للتحليل: نصٌّ ملصوقٌ أو مستخرَجٌ من مستند عبر OCR — يبقى مُرفقًا للمتابعات حتى يُزال.
  const [showAttach, setShowAttach] = useState(false);
  const [context, setContext] = useState("");
  const [attachName, setAttachName] = useState<string>("");
  const [attaching, setAttaching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useWakeLock(busy || attaching); // يمنع نوم الشاشة أثناء التوليد الحيّ أو استخراج المرفق

  const scrollDown = () => requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    // نصوصٌ خام تُقرأ محليًّا؛ الصور/PDF تُستخرَج عبر خدمة OCR السحابيّة.
    if (/\.(txt|md|csv|json)$/i.test(file.name) || file.type.startsWith("text/")) {
      const t = await file.text().catch(() => "");
      if (t.trim()) { setContext(t.slice(0, 14000)); setAttachName(file.name); setShowAttach(true); }
      return;
    }
    // Word (‎.docx‏): استخراجٌ محليّ بكود منصّة الوثائق (بلا خادمٍ ولا مفتاح) — تحليل XML للمستند.
    if (/\.docx$/i.test(file.name) || file.type.includes("wordprocessingml")) {
      setAttaching(true); setAttachName(file.name);
      try {
        const { extractDocxText } = await import("@/lib/modules/document-inspection/file-extract");
        const t = await extractDocxText(await file.arrayBuffer());
        if (!t.trim()) throw new Error("ملف Word بلا نصٍّ قابلٍ للاستخراج.");
        setContext(t.slice(0, 14000)); setShowAttach(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر استخراج ملف Word.");
        setAttachName("");
      } finally {
        setAttaching(false);
        if (fileRef.current) fileRef.current.value = "";
      }
      return;
    }
    setAttaching(true); setAttachName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/doc-tool/ocr", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.text) throw new Error(j?.error ?? "تعذّر استخراج نصّ المرفق.");
      setContext(String(j.text).slice(0, 14000)); setShowAttach(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر استخراج المرفق.");
      setAttachName("");
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !context.trim()) || busy) return;
    setError(null);
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    const shownUser = text || (attachName ? `تحليل المرفق: ${attachName}` : "تحليل النصّ المرفق");
    setMsgs((prev) => [...prev, { role: "user", content: shownUser }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    scrollDown();
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, subRoleId: subRoleId || undefined, context: context.trim() || undefined }),
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
            {m.role === "user" ? (
              <div className="inline-block max-w-[92%] whitespace-pre-wrap rounded-[var(--r-md)] bg-[var(--petrol)] px-3 py-2 text-sm leading-7 text-white">
                {m.content}
              </div>
            ) : (
              // تنسيقٌ فاخر كبقيّة المنصّة (محاماة حكيم): Markdown — عناوين وقوائم وجداول ومراجع.
              <div className="inline-block w-full max-w-full rounded-[var(--r-md)] border border-line bg-white px-3 py-2 text-right">
                {m.content
                  ? <AnswerRenderer content={m.content} id={`agent-ans-${i}`} basis={(m.sources ?? []).map((s) => ({ articleNumber: Number(s.article) || 0, systemName: s.system }))} />
                  : <span className="text-sm text-[var(--muted)]">{busy && i === msgs.length - 1 ? "…" : ""}</span>}
              </div>
            )}
            {m.role === "assistant" && m.sources?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.sources.map((s, j) => (
                  <span key={j} className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-[var(--muted)]">{s.system} — م{s.article}</span>
                ))}
              </div>
            ) : null}
            {/* لوحة التحكّم: نسخ · مشاركة · طباعة · Word · PDF · HTML — تظهر بعد اكتمال ردّ الوكيل */}
            {m.role === "assistant" && m.content && !(busy && i === msgs.length - 1) ? (
              <div className="mt-2">
                <AnswerToolbar answer={m.content} basis={(m.sources ?? []).map((s) => ({ articleNumber: Number(s.article) || 0, systemName: s.system }))} question={displayName} printTargetId={`agent-ans-${i}`} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {error ? <div className="mt-2 rounded-[var(--r-sm)] bg-[var(--ruby-soft)] px-3 py-2 text-xs text-[var(--ruby)]">{error}</div> : null}

      {/* شريط المرفق: مؤشّرٌ إن أُرفقت مادّة + إزالتها */}
      {context.trim() ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--gold-border)] bg-[var(--gold-ghost,#faf7f0)] px-3 py-1.5 text-xs text-[var(--petrol)]">
          <span>📎 مرفقٌ للتحليل: {attachName || "نصٌّ ملصوق"} ({context.trim().length.toLocaleString("ar-SA")} حرف)</span>
          <button type="button" className="font-semibold text-[var(--ruby)] hover:underline" onClick={() => { setContext(""); setAttachName(""); }}>إزالة</button>
        </div>
      ) : null}

      {/* لوحة الإرفاق: لصق نصّ أو رفع مستند (PDF/صورة → استخراج تلقائيّ) */}
      {showAttach ? (
        <div className="mt-2 rounded-[var(--r-md)] border border-[var(--ink-10)] bg-white p-2.5">
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value.slice(0, 14000))}
            rows={4}
            placeholder="الصق نصّ المستند أو الوقائع هنا، أو ارفع ملفًّا (Word · PDF · صورة) ليحلّله الوكيل ضمن نطاقه…"
            className="focus-ring w-full resize-y rounded-[var(--r-sm)] border border-[var(--ink-15)] bg-white px-2.5 py-2 text-xs"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <button type="button" className="btn btn-outline px-3 py-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={attaching}>
              {attaching ? "…جارٍ الاستخراج" : "⬆ رفع مستند (Word · PDF · صورة · نص)"}
            </button>
            <button type="button" className="text-xs font-semibold text-[var(--petrol)] hover:underline" onClick={() => setShowAttach(false)}>إخفاء</button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-end gap-2">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.csv,.json,.docx,image/*,application/pdf,text/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => setShowAttach((v) => !v)}
          disabled={busy}
          title="أرفق مستندًا أو الصق نصًّا"
          className="btn btn-outline shrink-0 px-3 py-2.5 text-sm disabled:opacity-50"
        >
          {attaching ? "…استخراج" : "📎 مرفق/نص"}
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={2}
          placeholder={context.trim() ? "اكتب توجيهك حول المرفق (أو اترك الحقل واضغط إرسال لتحليله)…" : "اكتب سؤالك للوكيل…"}
          className="focus-ring min-h-[44px] flex-1 resize-y rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-3 py-2 text-sm"
          disabled={busy}
        />
        <button type="button" onClick={() => void send()} disabled={busy || (!input.trim() && !context.trim())} className="btn btn-gold shrink-0 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          {busy ? "…" : "إرسال"}
        </button>
      </div>
    </div>
  );
}
