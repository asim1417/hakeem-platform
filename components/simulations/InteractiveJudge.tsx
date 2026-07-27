"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stageLabel } from "@/lib/modules/simulations/simulation-labels";

// القاضي التفاعليّ الحديث — واجهةٌ واحدةٌ موحَّدة تحفظ الجلسة في قاعدة البيانات (جداول
// Simulation) وتستدعي العقل القضائيّ الموحَّد عبر /api/simulations/[id]/judge-turn.
// تحلّ محلّ الـ iframe القديم: حالةٌ واحدة، دماغٌ واحد، أمانٌ كامل (مصادقة + ملكيّة).

type TurnState = {
  allowedSpeakerRole: string;
  requiredInput?: string;
  procedureAction?: string;
  reason?: string;
} | null;

type Msg = { id?: string; role: string; content: string; stage?: string };
type Judgment = { id: string; content: string };
type Session = {
  id: string;
  title: string;
  stage: string;
  messages: Msg[];
  decisions?: Array<{ decisionType: string; content: string }>;
  judgments?: Judgment[];
};
type SessionSummary = { id: string; title: string; stage: string; updatedAt?: string };

const SPEAKER_LABEL: Record<string, string> = {
  claimant: "المدعي",
  claimant_agent: "وكيل المدعي",
  defendant: "المدعى عليه",
  defendant_agent: "وكيل المدعى عليه",
  judge: "القاضي",
  both: "الطرفان",
  none: "لا أحد (قُفل باب المرافعة)",
  system: "النظام"
};

function isMarker(content: string) {
  return content.startsWith("HAKEEM_");
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.detail || "تعذّر تنفيذ الطلب.");
  return data;
}

export function InteractiveJudge() {
  const [view, setView] = useState<"list" | "new" | "session">("list");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [turn, setTurn] = useState<TurnState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sendAs, setSendAs] = useState<"المدعي" | "المدعى عليه">("المدعي");
  const bottomRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ subject: "", facts: "", requests: "", plaintiffName: "", defendantName: "", caseType: "تجاري" });

  // ── المرحلة الأولى من النقل التدريجيّ: خصائص القاعة (قوّة · ضبط · صلح) ──
  const [strength, setStrength] = useState<{ score: number; notes: string[] } | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [settlement, setSettlement] = useState({ amount: "", obligations: "", duration: "", waiver: "" });

  const loadList = useCallback(async () => {
    try {
      const data = await api("/api/simulations");
      setSessions((data.sessions ?? []).map((s: Session) => ({ id: s.id, title: s.title, stage: s.stage })));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  const applyState = useCallback((s: Session, t: TurnState) => {
    setSession(s);
    setTurn(t);
    if (t?.allowedSpeakerRole === "defendant" || t?.allowedSpeakerRole === "defendant_agent") setSendAs("المدعى عليه");
    else if (t?.allowedSpeakerRole === "claimant" || t?.allowedSpeakerRole === "claimant_agent") setSendAs("المدعي");
  }, []);

  const openSession = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/api/simulations/${id}/messages`);
      applyState(data.session, data.turnState ?? null);
      setView("session");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [applyState]);

  const createSession = useCallback(async () => {
    if (form.subject.trim().length < 3 || form.facts.trim().length < 5) {
      setError("أدخل موضوع الدعوى ووقائعها على الأقلّ.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api("/api/simulations", { method: "POST", body: JSON.stringify(form) });
      await openSession(data.sessionId);
      void loadList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [form, openSession, loadList]);

  // بعد مداخلة الطرف: يُستدعى القاضي (العقل الموحَّد) ليقرأ ويكيّف ويقرّر إجرائيًّا.
  const runJudge = useCallback(async (id: string) => {
    const data = await api(`/api/simulations/${id}/judge-turn`, { method: "POST", body: JSON.stringify({}) });
    return data;
  }, []);

  const submitStatement = useCallback(async () => {
    if (!session || input.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/simulations/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ role: sendAs, content: input.trim() })
      });
      setInput("");
      await runJudge(session.id); // القاضي يردّ بذكاءٍ مؤصَّل
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
      // أعِد تحميل الحالة لتصحيح الدور المسموح عند الرفض (403).
      try {
        const fresh = await api(`/api/simulations/${session.id}/messages`);
        applyState(fresh.session, fresh.turnState ?? null);
      } catch {
        /* تجاهل */
      }
    } finally {
      setBusy(false);
    }
  }, [session, input, sendAs, runJudge, applyState]);

  const advanceJudge = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await runJudge(session.id);
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session, runJudge, applyState]);

  const closePleading = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/simulations/${session.id}/decisions`, {
        method: "POST",
        body: JSON.stringify({ decisionType: "قفل باب المرافعة" })
      });
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session, applyState]);

  const generateJudgment = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/simulations/${session.id}/judgment`, { method: "POST", body: JSON.stringify({}) });
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session, applyState]);

  const computeStrength = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/api/simulations/${session.id}/strength-score`, { method: "POST", body: JSON.stringify({}) });
      setStrength(data.score ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session]);

  const generateHearingRecord = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/simulations/${session.id}/hearing-record`, { method: "POST", body: JSON.stringify({}) });
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session, applyState]);

  const submitSettlement = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/simulations/${session.id}/settlement`, { method: "POST", body: JSON.stringify(settlement) });
      setShowSettlement(false);
      setSettlement({ amount: "", obligations: "", duration: "", waiver: "" });
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [session, settlement, applyState]);

  const closed = turn?.allowedSpeakerRole === "none";
  const judgment = session?.judgments?.[session.judgments.length - 1];
  const visibleMessages = (session?.messages ?? []).filter((m) => !isMarker(m.content) && !(m.role === "النظام" && m.content.includes("تقييد الدعوى")));

  // ── قائمة الجلسات ──
  if (view === "list") {
    return (
      <div dir="rtl" className="space-y-5">
        <header className="hero">
          <p className="text-sm text-[var(--gold-pale)]">القاضي التفاعليّ</p>
          <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">قاعة المحاكاة القضائيّة</h1>
          <p className="mt-3 max-w-3xl leading-8 text-white/85">
            جلسةٌ تفاعليّة مؤصَّلة في النواة القانونيّة: تُقيّد الدعوى، وتترافع أمام قاضٍ يقرأ كلّ إفادة ويكيّفها ويطبّق قواعد الإثبات ثمّ يقرّر إجرائيًّا — وتُحفظ جلستك في حسابك.
          </p>
          <button onClick={() => { setForm({ subject: "", facts: "", requests: "", plaintiffName: "", defendantName: "", caseType: "تجاري" }); setError(null); setView("new"); }} className="focus-ring mt-5 rounded-[var(--r-md)] bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[var(--navy)] transition hover:opacity-90">
            + جلسة محاكاة جديدة
          </button>
        </header>

        {error ? <p className="rounded-[var(--r-md)] border border-[var(--ruby)] bg-[var(--ruby-soft,rgba(140,47,50,.08))] px-4 py-2 text-sm text-[var(--ruby)]">{error}</p> : null}

        <section className="grid gap-3">
          {sessions.length === 0 ? (
            <p className="rounded-[var(--r-lg)] border border-line bg-ivory p-6 text-center text-sm text-[var(--muted)]">لا توجد جلسات بعد — ابدأ جلستك الأولى.</p>
          ) : (
            sessions.map((s) => (
              <button key={s.id} onClick={() => openSession(s.id)} className="focus-ring flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-line bg-ivory p-4 text-right transition hover:border-[var(--gold-border)]">
                <div>
                  <div className="font-bold text-[var(--petrol)]">{s.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">المرحلة: {stageLabel(s.stage)}</div>
                </div>
                <span className="text-[var(--gold)]">فتح ←</span>
              </button>
            ))
          )}
        </section>

        <ClassicLink />
      </div>
    );
  }

  // ── إنشاء جلسة ──
  if (view === "new") {
    return (
      <div dir="rtl" className="mx-auto max-w-2xl space-y-4">
        <button onClick={() => setView("list")} className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--petrol)]">→ كل الجلسات</button>
        <h1 className="t-display text-2xl font-bold text-[var(--petrol)]">تقييد دعوى جديدة</h1>
        {error ? <p className="rounded-[var(--r-md)] border border-[var(--ruby)] px-4 py-2 text-sm text-[var(--ruby)]">{error}</p> : null}
        <div className="grid gap-3">
          <Field label="موضوع الدعوى *" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المدعي" value={form.plaintiffName} onChange={(v) => setForm({ ...form, plaintiffName: v })} />
            <Field label="اسم المدعى عليه" value={form.defendantName} onChange={(v) => setForm({ ...form, defendantName: v })} />
          </div>
          <Field label="نوع الدعوى" value={form.caseType} onChange={(v) => setForm({ ...form, caseType: v })} />
          <Field label="الوقائع *" value={form.facts} onChange={(v) => setForm({ ...form, facts: v })} textarea />
          <Field label="الطلبات" value={form.requests} onChange={(v) => setForm({ ...form, requests: v })} textarea />
        </div>
        <button onClick={createSession} disabled={busy} className="focus-ring rounded-[var(--r-md)] bg-[var(--petrol)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
          {busy ? "جارٍ التقييد…" : "تقييد الدعوى وبدء الجلسة"}
        </button>
      </div>
    );
  }

  // ── الجلسة ──
  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => { setView("list"); void loadList(); }} className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--petrol)]">→ كل الجلسات</button>
        <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--gold)]">{stageLabel(session?.stage ?? "")}</span>
      </div>

      <h1 className="t-display text-2xl font-bold text-[var(--petrol)]">{session?.title}</h1>

      {/* المحضر */}
      <div className="space-y-3 rounded-[var(--r-xl)] border border-line bg-[var(--surface)] p-4">
        {visibleMessages.map((m, i) => {
          const isJudge = m.role === "القاضي الافتراضي";
          const isSystem = m.role === "النظام";
          return (
            <div key={m.id ?? i} className={`rounded-[var(--r-lg)] border p-3 text-sm leading-7 ${isJudge ? "border-[var(--gold-border)] bg-[var(--parchment)]" : isSystem ? "border-line bg-ivory text-[var(--muted)]" : "border-line bg-white"}`}>
              <div className={`mb-1 text-xs font-bold ${isJudge ? "text-[var(--gold)]" : "text-[var(--petrol)]"}`}>{m.role}</div>
              <div className="whitespace-pre-wrap text-[var(--ink)]">{m.content}</div>
            </div>
          );
        })}
        {judgment ? (
          <div className="rounded-[var(--r-lg)] border-2 border-[var(--gold)] bg-[var(--parchment)] p-4">
            <div className="mb-2 font-bold text-[var(--gold)]">مسودة الحكم</div>
            <div className="whitespace-pre-wrap text-sm leading-8 text-[var(--ink)]">{judgment.content}</div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="rounded-[var(--r-md)] border border-[var(--ruby)] px-4 py-2 text-sm text-[var(--ruby)]">{error}</p> : null}

      {/* شريط الدور والإجراءات */}
      {!judgment && (
        <div className="rounded-[var(--r-xl)] border border-line bg-ivory p-4">
          <div className="mb-2 text-xs text-[var(--muted)]">
            {closed
              ? "قُفل باب المرافعة — يمكن الآن توليد مسودة الحكم."
              : turn?.allowedSpeakerRole === "judge"
                ? "بانتظار قرار القاضي."
                : `الدور الآن: ${SPEAKER_LABEL[turn?.allowedSpeakerRole ?? ""] ?? "—"}${turn?.requiredInput ? " — " + turn.requiredInput : ""}`}
          </div>

          {closed ? (
            <button onClick={generateJudgment} disabled={busy} className="focus-ring rounded-[var(--r-md)] bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[var(--navy)] transition hover:opacity-90 disabled:opacity-50">
              {busy ? "جارٍ التوليد…" : "توليد مسودة الحكم"}
            </button>
          ) : turn?.allowedSpeakerRole === "judge" ? (
            <button onClick={advanceJudge} disabled={busy} className="focus-ring rounded-[var(--r-md)] bg-[var(--petrol)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
              {busy ? "القاضي ينظر…" : "استمرّ — دور القاضي"}
            </button>
          ) : (
            <>
              {turn?.allowedSpeakerRole === "both" ? (
                <div className="mb-2 flex gap-2 text-xs">
                  {(["المدعي", "المدعى عليه"] as const).map((p) => (
                    <button key={p} onClick={() => setSendAs(p)} className={`rounded-full border px-3 py-1 ${sendAs === p ? "border-[var(--gold)] bg-[var(--gold-ghost)] text-[var(--gold)]" : "border-line text-[var(--muted)]"}`}>{p}</button>
                  ))}
                </div>
              ) : null}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`اكتب مداخلتك بصفتك ${sendAs}…`}
                rows={3}
                className="w-full rounded-[var(--r-md)] border border-line bg-white p-3 text-sm outline-none focus:border-[var(--gold)]"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button onClick={submitStatement} disabled={busy || input.trim().length < 2} className="focus-ring rounded-[var(--r-md)] bg-[var(--petrol)] px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
                  {busy ? "القاضي ينظر…" : `أرسل بصفتك ${sendAs}`}
                </button>
                <button onClick={closePleading} disabled={busy} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--gold-border)] disabled:opacity-50">
                  قفل باب المرافعة
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* أدوات الجلسة (منقولة من القاعة الكلاسيكيّة) */}
      <div className="rounded-[var(--r-xl)] border border-line bg-ivory p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--ink-60)]">أدوات الجلسة</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={computeStrength} disabled={busy} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50">تقييم قوّة الموقف</button>
          <button onClick={generateHearingRecord} disabled={busy} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50">ضبط الجلسة</button>
          <button onClick={() => setShowSettlement((v) => !v)} disabled={busy} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50">مسودة صلح</button>
          <a href={`/api/simulations/${session?.id}/export?type=hearing-record&format=pdf`} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:border-[var(--gold-border)]">تصدير ضبط الجلسة</a>
        </div>

        {strength ? (
          <div className="mt-3 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--parchment)] p-3 text-sm">
            <div className="font-bold text-[var(--gold)]">قوّة الموقف: {strength.score}٪</div>
            <ul className="mt-1 grid gap-0.5 text-xs text-[var(--muted)]">
              {strength.notes?.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          </div>
        ) : null}

        {showSettlement ? (
          <div className="mt-3 grid gap-2 rounded-[var(--r-lg)] border border-line bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="مبلغ التسوية" value={settlement.amount} onChange={(v) => setSettlement({ ...settlement, amount: v })} />
              <Field label="مدّة التنفيذ" value={settlement.duration} onChange={(v) => setSettlement({ ...settlement, duration: v })} />
            </div>
            <Field label="الالتزامات" value={settlement.obligations} onChange={(v) => setSettlement({ ...settlement, obligations: v })} />
            <Field label="شرط التنازل/الإنهاء" value={settlement.waiver} onChange={(v) => setSettlement({ ...settlement, waiver: v })} />
            <button onClick={submitSettlement} disabled={busy} className="focus-ring rounded-[var(--r-md)] bg-[var(--petrol)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">حفظ مسودة الصلح</button>
          </div>
        ) : null}
      </div>

      {/* التصدير ومسارات ما بعد الحكم */}
      {judgment ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a href={`/api/simulations/${session?.id}/export?type=judgment&format=pdf`} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]">تصدير الحكم PDF</a>
            <a href={`/api/simulations/${session?.id}/export?type=judgment&format=docx`} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]">تصدير الحكم Word</a>
            <a href={`/api/simulations/${session?.id}/export?type=full-report&format=pdf`} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]">تقرير الجلسة PDF</a>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--ink-60)]">مرحلة ما بعد الحكم</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/dashboard/simulations/${session?.id}/appeal`} className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">لائحة استئناف</a>
              <a href={`/dashboard/simulations/${session?.id}/cassation`} className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">طلب نقض</a>
              <a href={`/dashboard/simulations/${session?.id}/reconsideration`} className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)]">التماس إعادة نظر</a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-[var(--ink-60)]">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="rounded-[var(--r-md)] border border-line bg-white p-3 outline-none focus:border-[var(--gold)]" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-[var(--r-md)] border border-line bg-white p-2.5 outline-none focus:border-[var(--gold)]" />
      )}
    </label>
  );
}

function ClassicLink() {
  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-xs text-[var(--ink-40)]">الواجهة الكلاسيكيّة (النسخة القديمة)</summary>
      <a href="/original-hakeem/hakim1111.html?embed=1" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-[var(--muted)] underline">فتح القاعة الكلاسيكيّة في تبويب جديد ←</a>
    </details>
  );
}
