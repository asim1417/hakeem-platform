"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatCard,
  ChatAttachmentMeta,
  DialogueState,
  SearchStrength,
  SimulationCaseFile,
  SimulationMode,
} from "@/lib/modules/legal-chat/types";
import { ChatCardRenderer } from "./cards";

type Turn = {
  role: "user" | "assistant";
  content: string;
  cards?: ChatCard[];
  awaiting?: boolean;
  error?: string;
  suggestedButtons?: string[];
};

type HistoryItem = {
  id: string;
  title: string;
  savedAt: number;
  turns: Turn[];
  caseFile: SimulationCaseFile | null;
  mode: SimulationMode;
  status?: string;
};

type ServerConversation = {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
  status: string;
  messages: { role: string; content: string }[];
};

export interface WorkspaceConfig {
  modes: { value: SimulationMode; label: string; description: string }[];
  strengths: { value: SearchStrength; label: string; description: string }[];
  prompts: { label: string; prompt: string }[];
  greeting: string;
  disclaimer: string;
}

const FILE_KINDS = ["صحيفة دعوى", "مذكرة جوابية", "حكم", "عقد", "مستند إثبات", "مراسلات", "غير ذلك"];

export function LegalChatWorkspace({ config }: { config: WorkspaceConfig }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<SimulationMode>("RESEARCHER");
  const [strength, setStrength] = useState<SearchStrength>("BALANCED");
  const [attachments, setAttachments] = useState<ChatAttachmentMeta[]>([]);
  const [caseFile, setCaseFile] = useState<SimulationCaseFile | null>(null);
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [redact, setRedact] = useState(false);
  const lastUserMessage = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تحميل سجل المحادثات المحفوظ على الخادم (best-effort؛ يعيد فارغاً إن لم تُفعّل الجداول).
  // لا نستخدم تخزيناً محلياً للبيانات القانونية (حوكمة وخصوصية PDPL).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/legal-chat/conversations");
        const data = await res.json().catch(() => null);
        if (!active || !data?.ok || !Array.isArray(data.conversations)) return;
        const items: HistoryItem[] = data.conversations.map((c: ServerConversation) => ({
          id: c.id,
          title: c.title,
          savedAt: new Date(c.updatedAt).getTime() || Date.now(),
          turns: (c.messages ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          caseFile: null,
          mode: (c.mode as SimulationMode) ?? "RESEARCHER",
          status: c.status,
        }));
        setHistory(items);
      } catch {
        /* تجاهل — السجل اختياري */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // سجل داخل الجلسة (في الذاكرة) — يُحدَّث بعد كل دورة، ويُدمج مع المحفوظ على الخادم.
  function saveCurrentToHistory(nextTurns: Turn[], nextCase: SimulationCaseFile | null, convId: string | null) {
    if (!nextTurns.length) return;
    const id = convId ?? conversationId ?? `session-${Date.now()}`;
    const title = nextCase?.title ?? nextTurns[0]?.content?.slice(0, 60) ?? "محادثة";
    const item: HistoryItem = { id, title, savedAt: Date.now(), turns: nextTurns, caseFile: nextCase, mode, status: nextCase?.status };
    setHistory((prev) => [item, ...prev.filter((h) => h.id !== id)].slice(0, 50));
  }

  async function send(message: string, approval?: "CONFIRM" | "DRAFT_WITH_ASSUMPTIONS") {
    const text = message.trim();
    if ((!text && !approval) || busy) return;
    setBusy(true);
    if (text) lastUserMessage.current = text;

    const userTurn: Turn[] = text ? [{ role: "user", content: text }] : [];
    const working = [...turns, ...userTurn];
    setTurns(working);
    setValue("");

    try {
      const res = await fetch("/api/legal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || lastUserMessage.current,
          mode,
          searchStrength: strength,
          approval: approval ?? null,
          caseFile,
          conversationId,
          attachments,
          redact,
          dialogue,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const err = res.status === 401 ? "انتهت الجلسة — يلزم تسجيل الدخول." : data?.error ?? "تعذّر تنفيذ الطلب.";
        const next = [...working, { role: "assistant" as const, content: "", error: err }];
        setTurns(next);
        return;
      }
      const assistantTurn: Turn = {
        role: "assistant",
        content: data.reply,
        cards: data.cards as ChatCard[],
        awaiting: data.awaitingConfirmation,
        suggestedButtons: (data.suggestedButtons as string[] | undefined) ?? undefined,
      };
      const next = [...working, assistantTurn];
      setTurns(next);
      setCaseFile((data.caseFile as SimulationCaseFile | null) ?? null);
      if (data.dialogue) setDialogue(data.dialogue as DialogueState);
      if (data.conversationId) setConversationId(data.conversationId);
      saveCurrentToHistory(next, data.caseFile as SimulationCaseFile, data.conversationId ?? null);
    } catch {
      setTurns((prev) => [...prev, { role: "assistant", content: "", error: "انقطع الاتصال أثناء المعالجة." }]);
    } finally {
      setBusy(false);
      setShowPrompts(false);
    }
  }

  function handleOption(key: string) {
    if (busy) return;
    switch (key) {
      case "CONFIRM":
        void send("", "CONFIRM");
        break;
      case "DRAFT_WITH_ASSUMPTIONS":
        void send("", "DRAFT_WITH_ASSUMPTIONS");
        break;
      case "EDIT_ROLE":
        setValue("صفتي في القضية هي: ");
        break;
      case "EDIT_OUTPUT":
        setValue("المطلوب الذي أريده تحديداً هو: ");
        break;
      case "ADD_INFO":
        setValue("معلومات إضافية: ");
        break;
      case "ASK_QUESTIONS":
        void send("اطرح عليّ الأسئلة الموجهة اللازمة لاستكمال فهم طلبي.");
        break;
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const metas: ChatAttachmentMeta[] = await Promise.all(
      Array.from(files).map(async (f) => {
        const meta: ChatAttachmentMeta = { fileName: f.name, mimeType: f.type || "application/octet-stream" };
        // نقرأ النص فقط للملفات النصية الصغيرة (لا نحلّل قبل تحديد النوع لاحقاً).
        const isText = f.type.startsWith("text/") || /\.(txt|md|csv|json|html?)$/i.test(f.name);
        if (isText && f.size <= 200_000) {
          try {
            meta.content = (await f.text()).slice(0, 60000);
          } catch {
            /* تجاهل */
          }
        }
        return meta;
      })
    );
    setAttachments((prev) => [...prev, ...metas].slice(0, 20));
  }

  function setKind(i: number, kind: string) {
    setAttachments((prev) => prev.map((a, idx) => (idx === i ? { ...a, declaredKind: kind } : a)));
  }

  function startVoice() {
    const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      alert("الإدخال الصوتي غير مدعوم في هذا المتصفح بعد. اكتب رسالتك نصاً، وسنضيف التفريغ الصوتي لاحقاً.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setValue((v) => (v ? `${v} ${transcript}` : transcript));
    };
    rec.start();
  }

  function newChat() {
    setTurns([]);
    setCaseFile(null);
    setDialogue(null);
    setConversationId(null);
    setAttachments([]);
    setValue("");
  }

  function loadHistory(item: HistoryItem) {
    setTurns(item.turns);
    setCaseFile(item.caseFile);
    setConversationId(item.id.startsWith("session-") ? null : item.id);
    setMode(item.mode);
  }

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
  };

  const currentCase = caseFile;
  const grouped = useMemo(() => history, [history]);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
      {/* اليمين: سجل المحادثات والقضايا */}
      <aside className="order-2 hidden lg:order-1 lg:block">
        <button
          type="button"
          onClick={newChat}
          className="focus-ring mb-3 w-full rounded-[var(--r-md)] bg-[var(--navy)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--navy-mid)]"
        >
          + محادثة جديدة
        </button>
        <p className="mb-1 px-1 text-[11px] font-semibold text-[var(--ink-60)]">القضايا والمحادثات</p>
        <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
          {grouped.length === 0 ? (
            <p className="px-1 text-xs text-[var(--ink-40)]">لا محادثات محفوظة بعد.</p>
          ) : (
            grouped.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => loadHistory(h)}
                className="focus-ring block w-full rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white p-2 text-right text-xs hover:border-[var(--gold)]"
              >
                <span className="block truncate font-semibold text-[var(--navy)]">{h.title}</span>
                <span className="block truncate text-[10px] text-[var(--ink-40)]">
                  {(h.caseFile?.status ?? h.status) === "READY"
                    ? "جاهز"
                    : (h.caseFile?.status ?? h.status) === "INCOMPLETE"
                      ? "ناقص"
                      : "مسودة"}{" "}
                  · {new Date(h.savedAt).toLocaleDateString("ar-SA")}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* الوسط: الشات */}
      <section className="order-1 flex min-h-[calc(100vh-12rem)] flex-col lg:order-2">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto pb-28 lg:pb-6">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center pt-[6vh] text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-3xl text-[var(--gold-bright)] shadow-[var(--sh-md)]">
                ⚖
              </span>
              <h2 className="t-head mt-4 text-2xl font-bold text-[var(--navy)]">{config.greeting}</h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-[var(--ink-60)]">
                اشرح قضيتك بكلماتك — ولو بالعامية. سأفهم أولاً، أعرض فهمي وآخذ موافقتك، أبني ملف القضية، وأطبّق منطق الإجراءات
                السعودية قبل أي مخرج. لا أُنتج مذكرة أو حكماً مباشرةً قبل التأكيد.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {config.prompts.slice(0, 6).map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setValue(p.prompt)}
                    className="focus-ring rounded-full border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs text-[var(--ink-80)] hover:border-[var(--gold)]"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className="space-y-3">
                {turn.role === "user" ? (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[var(--navy)] px-4 py-2.5 text-sm leading-7 text-white">
                      {turn.content}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {turn.error ? (
                      <div className="rounded-[var(--r-lg)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] p-3 text-sm leading-7 text-[var(--ruby)]">
                        {turn.error}
                      </div>
                    ) : (
                      <>
                        {turn.content && (
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--navy)] to-[var(--navy-mid)] text-sm text-[var(--gold-bright)]">
                              ⚖
                            </span>
                            <p className="whitespace-pre-wrap rounded-[var(--r-lg)] bg-[var(--gold-ghost)] px-3 py-2 text-sm leading-7 text-[var(--ink-80)]">
                              {turn.content}
                            </p>
                          </div>
                        )}
                        {turn.cards?.map((card, ci) => (
                          <ChatCardRenderer
                            key={ci}
                            card={card}
                            onOption={handleOption}
                            onCopy={copy}
                            optionsDisabled={busy || i !== turns.length - 1}
                          />
                        ))}
                        {turn.suggestedButtons && turn.suggestedButtons.length > 0 && (
                          <div className="flex flex-wrap gap-2 ps-9">
                            {turn.suggestedButtons.map((b, bi) => (
                              <button
                                key={bi}
                                type="button"
                                disabled={busy || i !== turns.length - 1}
                                onClick={() => void send(b)}
                                className="focus-ring rounded-full border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--navy)] transition hover:border-[var(--gold)] hover:bg-[var(--gold-ghost)] disabled:opacity-50"
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-[var(--ink-60)]">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
              يفهم ويحلّل…
            </div>
          )}
        </div>

        {/* الأسفل: مربع الإدخال الذكي */}
        <div
          className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* الخيارات المتقدمة داخل زر الإعدادات ⚙️ (مطوية افتراضيًا — لا تزاحم المحادثة) */}
          {showTools && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white p-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SimulationMode)}
                className="rounded-full border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs text-[var(--navy)] focus-ring"
                title="نمط المحاكاة"
              >
                {config.modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={strength}
                onChange={(e) => setStrength(e.target.value as SearchStrength)}
                className="rounded-full border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs text-[var(--navy)] focus-ring"
                title="قوة البحث"
              >
                {config.strengths.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowPrompts((v) => !v)}
                className="focus-ring rounded-full border border-[var(--ink-15)] bg-white px-3 py-1.5 text-xs text-[var(--ink-80)] hover:border-[var(--gold)]"
              >
                مكتبة الأوامر
              </button>
              <button
                type="button"
                onClick={() => setRedact((v) => !v)}
                aria-pressed={redact}
                title="إخفاء البيانات الحساسة (هوية/جوال/آيبان) في المخرجات"
                className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  redact ? "border-[var(--ruby)] bg-[var(--ruby-soft)] text-[var(--ruby)]" : "border-[var(--ink-15)] bg-white text-[var(--ink-60)] hover:border-[var(--gold)]"
                }`}
              >
                {redact ? "🛡️ الإخفاء مُفعّل" : "🛡️ إخفاء البيانات"}
              </button>
              {currentCase && (
                <span className="rounded-full bg-[var(--emerald-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--emerald)]">
                  حالة الملف: {currentCase.status === "READY" ? "جاهز" : currentCase.status === "INCOMPLETE" ? "ناقص" : "مسودة"}
                </span>
              )}
            </div>
          )}

          {showPrompts && (
            <div className="mb-2 flex flex-wrap gap-1.5 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white p-2">
              {config.prompts.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setValue(p.prompt);
                    setShowPrompts(false);
                  }}
                  className="focus-ring rounded-full border border-[var(--ink-15)] px-2.5 py-1 text-[11px] text-[var(--ink-80)] hover:border-[var(--gold)]"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* مرفقات بانتظار تحديد النوع */}
          {attachments.length > 0 && (
            <div className="mb-2 space-y-1 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-2">
              <p className="text-[11px] font-semibold text-[var(--navy)]">حدّد نوع كل ملف قبل التحليل:</p>
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="truncate text-[var(--ink-80)]">📎 {a.fileName}</span>
                  <select
                    value={a.declaredKind ?? ""}
                    onChange={(e) => setKind(i, e.target.value)}
                    className="rounded border border-[var(--ink-15)] bg-white px-1.5 py-0.5 text-[11px]"
                  >
                    <option value="">نوع الملف…</option>
                    {FILE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setAttachments((p) => p.filter((_, idx) => idx !== i))} className="text-[var(--ruby)]">
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(value);
            }}
            className="rounded-[var(--r-xl)] border border-[var(--ink-15)] bg-white p-2 shadow-[var(--sh-md)] focus-within:border-[var(--gold)]"
          >
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(value);
                }
              }}
              rows={1}
              placeholder="اشرح قضيتك بكلماتك… (مثال: جاني تبليغ من المحكمة وأبغى أرد على دعوى)"
              className="max-h-36 min-h-[40px] w-full resize-none border-0 bg-transparent px-2 py-1.5 text-base leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
            />
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
                <IconBtn title="رفع ملف" onClick={() => fileInputRef.current?.click()}>📎</IconBtn>
                <IconBtn title="إدخال صوتي" onClick={startVoice}>🎙️</IconBtn>
                <IconBtn title="أدوات" onClick={() => setShowTools((v) => !v)}>⚙️</IconBtn>
              </div>
              <button
                type="submit"
                disabled={busy || (!value.trim() && !attachments.length)}
                className="focus-ring rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-mid)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "جارٍ…" : "إرسال"}
              </button>
            </div>
            {showTools && (
              <div className="border-t border-[var(--ink-08)] px-1 pt-2 text-[11px] text-[var(--ink-60)]">
                النمط الحالي: <b className="text-[var(--navy)]">{config.modes.find((m) => m.value === mode)?.label}</b> — {config.modes.find((m) => m.value === mode)?.description}
                <br />
                قوة البحث: <b className="text-[var(--navy)]">{config.strengths.find((s) => s.value === strength)?.label}</b> — {config.strengths.find((s) => s.value === strength)?.description}
              </div>
            )}
          </form>
          <p className="mt-2 px-1 text-center text-[11px] leading-6 text-[var(--ink-40)]">{config.disclaimer}</p>
        </div>
      </section>

      {/* اليسار: ملف القضية والمصادر */}
      <aside className="order-3 hidden lg:block">
        <p className="mb-2 px-1 text-[11px] font-semibold text-[var(--ink-60)]">ملف القضية</p>
        {currentCase ? (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 14rem)" }}>
            <div className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white p-3 text-xs">
              <p className="font-bold text-[var(--navy)]">{currentCase.title}</p>
              <p className="mt-1 leading-6 text-[var(--ink-60)]">{currentCase.summary}</p>
              {currentCase.missingInfo.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-[var(--amber)]">النواقص:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pe-4 leading-5 text-[var(--ink-80)]">
                    {currentCase.missingInfo.map((m, i) => (
                      <li key={i}>{m.label}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--ink-15)] bg-white p-4 text-center text-xs text-[var(--ink-40)]">
            يظهر ملف القضية هنا تلقائياً بعد أول رسالة.
          </div>
        )}
      </aside>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="focus-ring grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white text-base hover:border-[var(--gold)]"
    >
      {children}
    </button>
  );
}

// أنواع مبسّطة لواجهة الكلام الصوتي (لتفادي الاعتماد على lib.dom كاملة).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEventLike) => void;
  start(): void;
}
interface SpeechRecognitionEventLike {
  results: Array<Array<{ transcript: string }>>;
}
