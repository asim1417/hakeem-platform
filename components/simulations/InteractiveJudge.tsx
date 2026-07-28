"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ClipboardList, Copy, Check, Download, FileText, Gauge, Gavel, Handshake, Paperclip, Plus, Scale, ScrollText, Eye } from "lucide-react";
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
type Playbook = { id: string; title: string; category: string; description: string; suggestedArticleNumbers?: number[]; preferredSystems?: string[]; litigationStages?: string[]; judicialUsage?: string[] };

// مسار المراحل المرئيّ (منقول من القاعة الكلاسيكيّة).
const STAGE_FLOW = ["CLAIM_FILING", "PLAINTIFF_STATEMENT", "DEFENDANT_RESPONSE", "PROCEDURAL_DECISION", "CLOSE_PLEADING", "TRAINING_JUDGMENT"] as const;

// تحويل كلّ مراحل المحرّك إلى أقرب خطوةٍ في الشريط (يمنع السقوط الصامت للخطوة الأولى
// عند مراحل خارج المسار المرئيّ مثل SETTLEMENT/HEARING_RECORD).
const STAGE_INDEX: Record<string, number> = {
  CLAIM_FILING: 0, INITIAL_ADMISSIBILITY: 0, HEARING_RECORD: 0,
  PLEADING: 1, PLAINTIFF_STATEMENT: 1,
  DEFENDANT_RESPONSE: 2,
  PROCEDURAL_DECISION: 3, SETTLEMENT: 3,
  CLOSE_PLEADING: 4,
  TRAINING_JUDGMENT: 5, OBJECTION: 5
};

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

// تحويل ذكر المواد داخل نصّ القاضي إلى روابط قابلة للنقر إلى بحث النواة (تتبّع الاستشهاد).
const ARTICLE_MENTION = /(الما?دّ?ة\s*\(?\s*\d+\s*\)?|م\/\s*\d+)/g;
function renderWithArticleLinks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  ARTICLE_MENTION.lastIndex = 0;
  while ((m = ARTICLE_MENTION.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const label = m[0];
    out.push(
      <a key={key++} href={`/search?q=${encodeURIComponent(label)}`} target="_blank" rel="noreferrer" className="font-semibold text-[var(--gold)] underline decoration-dotted underline-offset-2">{label}</a>
    );
    last = m.index + label.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function extractClaimClient(messages: Msg[]): Record<string, string> | null {
  const m = [...messages].reverse().find((x) => x.content.startsWith("HAKEEM_CLAIM::"));
  if (!m) return null;
  try {
    return JSON.parse(m.content.slice("HAKEEM_CLAIM::".length));
  } catch {
    return null;
  }
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ subject: "", facts: "", requests: "", plaintiffName: "", plaintiffCapacity: "", defendantName: "", defendantCapacity: "", caseType: "تجاري", attendance: "" });

  // ── المرحلة الأولى من النقل التدريجيّ: خصائص القاعة (قوّة · ضبط · صلح) ──
  const [strength, setStrength] = useState<{ score: number; notes: string[] } | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [settlement, setSettlement] = useState({ amount: "", obligations: "", duration: "", waiver: "" });
  const [catalog, setCatalog] = useState<Playbook[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("الكل");
  // شفافيّة قرار القاضي (يراها صانع القرار): آخر وضع + تكييف + إجراء.
  const [judgeMeta, setJudgeMeta] = useState<{ mode: string; classification: string | null; action: string | null } | null>(null);
  // صحيفة الدعوى (منقولة من ملفّ القضية في القاعة الكلاسيكيّة).
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  // الكتابة الحيّة (منقولة من القاعة الكلاسيكيّة): يُكشف نصّ القاضي حرفًا حرفًا بدل عرضه دفعةً.
  const [typing, setTyping] = useState<{ id: string; full: string } | null>(null);
  const [typedLen, setTypedLen] = useState(0);
  // حالة المزوّد: هل القاضي يعمل بذكاء Claude «server» أم يسقط للوضع الحتميّ «offline»؟
  const [provider, setProvider] = useState<{ active: boolean; provider: string; model: string | null; nonClaudeConfigured: boolean } | null>(null);
  // لوحة الأساس النظاميّ (منقولة من القاعة الكلاسيكيّة): مواد النواة ذات الصلة بروابط قابلة للتتبّع.
  const [legalBasis, setLegalBasis] = useState<Array<{ articleNumber: number; systemName: string; citationLabel: string; internalUrl: string; snippet: string }> | null>(null);
  const [activatedScope, setActivatedScope] = useState<string[]>([]);
  const [showLegalBasis, setShowLegalBasis] = useState(false);

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
    void api("/api/simulations/provider-status").then((d) => setProvider(d)).catch(() => setProvider(null));
  }, [loadList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  // محرّك الكتابة الحيّة: يكشف النصّ تدريجيًّا بخطوةٍ متناسبة مع طوله (زمنٌ ثابتٌ تقريبًا ~6ث)،
  // فيكتب القاضي «حيًّا ومباشرةً» بدل ظهور كتلةٍ طويلة دفعةً واحدة.
  useEffect(() => {
    if (!typing) return;
    setTypedLen(0);
    const step = Math.max(1, Math.floor(typing.full.length / 400));
    const iv = setInterval(() => {
      setTypedLen((n) => {
        const next = n + step;
        if (next >= typing.full.length) {
          clearInterval(iv);
          return typing.full.length;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(iv);
  }, [typing]);

  // تمريرٌ واحدٌ عند بدء الكتابة الحيّة فقط (لا مع كلّ حرف) — يمنع قفز الصندوق واهتزازه.
  useEffect(() => {
    if (typing) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [typing]);

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
    if (data?.judge) setJudgeMeta(data.judge);
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
      const jr = await runJudge(session.id); // القاضي يردّ بذكاءٍ مؤصَّل
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
      if (jr?.message?.id && jr?.message?.content) setTyping({ id: jr.message.id, full: jr.message.content });
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

  // رفع بيّنة مُرفَقة (مستند): يُستخرَج نصّها خادِميًّا وتُسجَّل باسم الطرف الحاليّ ضمن المحضر.
  const attachEvidence = useCallback(async (file: File) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("role", sendAs);
      const res = await fetch(`/api/simulations/${session.id}/evidence`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر رفع البيّنة.");
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [session, sendAs, applyState]);

  const advanceJudge = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const jr = await runJudge(session.id);
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
      if (jr?.message?.id && jr?.message?.content) setTyping({ id: jr.message.id, full: jr.message.content });
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
      const data = await api(`/api/simulations/${session.id}/judgment`, { method: "POST", body: JSON.stringify({}) });
      const fresh = await api(`/api/simulations/${session.id}/messages`);
      applyState(fresh.session, fresh.turnState ?? null);
      if (data?.judgment?.id && data?.judgment?.content) setTyping({ id: data.judgment.id, full: data.judgment.content });
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

  // لوحة الأساس النظاميّ: تجلب مواد النواة ذات الصلة بالقضية (مؤرَّضة، بروابط).
  const toggleLegalBasis = useCallback(async () => {
    const next = !showLegalBasis;
    setShowLegalBasis(next);
    if (next && !legalBasis && session) {
      try {
        const data = await api(`/api/simulations/${session.id}/legal-basis`);
        setLegalBasis(data.articles ?? []);
        setActivatedScope(data.activatedScope ?? []);
      } catch {
        setLegalBasis([]);
      }
    }
  }, [showLegalBasis, legalBasis, session]);

  const toggleCatalog = useCallback(async () => {
    setCatalogOpen((v) => !v);
    if (catalog.length === 0) {
      try {
        const res = await fetch("/original-hakeem/judicial-playbooks.json");
        const data = await res.json();
        setCatalog(Array.isArray(data?.playbooks) ? data.playbooks : []);
      } catch {
        /* الكتالوج اختياريّ — لا يكسر الجلسة */
      }
    }
  }, [catalog.length]);

  const insertDefense = useCallback((pb: Playbook) => {
    setInput((prev) => `${prev ? prev + "\n" : ""}الدفع: ${pb.title} — ${pb.description}`.trim());
    setCatalogOpen(false);
  }, []);

  const closed = turn?.allowedSpeakerRole === "none";
  const judgment = session?.judgments?.[session.judgments.length - 1];
  const visibleMessages = (session?.messages ?? []).filter((m) => !isMarker(m.content) && !(m.role === "النظام" && m.content.includes("تقييد الدعوى")));

  // حارس الكفاية: لا يُقفل باب المرافعة قبل أن ينطق الطرفان (المدعي والمدعى عليه).
  const partyMsgs = (session?.messages ?? []).filter((m) => ["المدعي", "وكيل المدعي", "المدعى عليه", "وكيل المدعى عليه"].includes(m.role));
  const hasPlaintiff = partyMsgs.some((m) => m.role === "المدعي" || m.role === "وكيل المدعي");
  const hasDefendant = partyMsgs.some((m) => m.role === "المدعى عليه" || m.role === "وكيل المدعى عليه");
  const canClose = hasPlaintiff && hasDefendant;

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
          <button onClick={() => { setForm({ subject: "", facts: "", requests: "", plaintiffName: "", plaintiffCapacity: "", defendantName: "", defendantCapacity: "", caseType: "تجاري", attendance: "" }); setError(null); setView("new"); }} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[var(--navy)] transition hover:opacity-90">
            <Plus size={16} aria-hidden /> جلسة محاكاة جديدة
          </button>
        </header>

        {error ? <p className="rounded-[var(--r-md)] border border-[var(--ruby)] bg-[var(--ruby-soft,rgba(140,47,50,.08))] px-4 py-2 text-sm text-[var(--ruby)]">{error}</p> : null}

        <section className="grid gap-3">
          {sessions.length === 0 ? (
            <p className="rounded-[var(--r-lg)] border border-line bg-ivory p-6 text-center text-sm text-[var(--muted)]">لا توجد جلسات بعد — ابدأ جلستك الأولى.</p>
          ) : (
            sessions.map((s) => (
              <button key={s.id} onClick={() => openSession(s.id)} className="focus-ring flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-line bg-ivory p-4 text-right transition hover:border-[var(--gold-border)]">
                <div className="flex items-center gap-3">
                  <Gavel size={18} className="text-[var(--gold)]" aria-hidden />
                  <div>
                    <div className="font-bold text-[var(--petrol)]">{s.title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">المرحلة: {stageLabel(s.stage)}</div>
                  </div>
                </div>
                <ChevronLeft size={18} className="text-[var(--gold)]" aria-hidden />
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
        <button onClick={() => setView("list")} className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--petrol)]"><ArrowRight size={14} aria-hidden /> كل الجلسات</button>
        <h1 className="t-display text-2xl font-bold text-[var(--petrol)]">تقييد دعوى جديدة</h1>
        {error ? <p className="rounded-[var(--r-md)] border border-[var(--ruby)] px-4 py-2 text-sm text-[var(--ruby)]">{error}</p> : null}
        <div className="grid gap-3">
          <Field label="موضوع الدعوى *" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المدعي" value={form.plaintiffName} onChange={(v) => setForm({ ...form, plaintiffName: v })} />
            <Field label="اسم المدعى عليه" value={form.defendantName} onChange={(v) => setForm({ ...form, defendantName: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="صفة المدعي (أصالةً/وكالةً…)" value={form.plaintiffCapacity} onChange={(v) => setForm({ ...form, plaintiffCapacity: v })} />
            <Field label="صفة المدعى عليه" value={form.defendantCapacity} onChange={(v) => setForm({ ...form, defendantCapacity: v })} />
          </div>
          <Field label="نوع الدعوى" value={form.caseType} onChange={(v) => setForm({ ...form, caseType: v })} />
          <Field label="الوقائع *" value={form.facts} onChange={(v) => setForm({ ...form, facts: v })} textarea />
          <Field label="الطلبات" value={form.requests} onChange={(v) => setForm({ ...form, requests: v })} textarea />
          <Field label="إثبات الحضور والصفة (اختياري)" value={form.attendance} onChange={(v) => setForm({ ...form, attendance: v })} textarea />
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
        <button onClick={() => { setView("list"); void loadList(); }} className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--petrol)]"><ArrowRight size={14} aria-hidden /> كل الجلسات</button>
        <div className="flex items-center gap-2">
          <ProviderBadge provider={provider} />
          <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--gold)]">{stageLabel(session?.stage ?? "")}</span>
        </div>
      </div>

      <h1 className="t-display text-2xl font-bold text-[var(--petrol)]">{session?.title}</h1>

      {/* شريط المراحل (منقول من القاعة الكلاسيكيّة) */}
      <StageBar current={session?.stage ?? ""} hasJudgment={Boolean(judgment)} />

      {/* الديباجة الرسميّة (منقولة من القاعة الكلاسيكيّة) */}
      <FormalPreamble claim={extractClaimClient(session?.messages ?? [])} title={session?.title ?? ""} />

      {/* المحضر */}
      <div className="space-y-3 rounded-[var(--r-xl)] border border-line bg-[var(--surface)] p-4">
        {visibleMessages.map((m, i) => {
          const isJudge = m.role === "القاضي الافتراضي";
          const isSystem = m.role === "النظام";
          const isTyping = typing?.id === m.id;
          const shown = isTyping ? m.content.slice(0, typedLen) : m.content;
          return (
            <div key={m.id ?? i} className={`rounded-[var(--r-lg)] border p-3 text-sm leading-7 ${isJudge ? "border-[var(--gold-border)] bg-[var(--parchment)]" : isSystem ? "border-line bg-ivory text-[var(--muted)]" : "border-line bg-white"}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className={`inline-flex items-center gap-1 text-xs font-bold ${isJudge ? "text-[var(--gold)]" : "text-[var(--petrol)]"}`}>{isJudge ? <Gavel size={13} aria-hidden /> : null}{m.role}</div>
                {isJudge ? <CopyBtn text={m.content} /> : null}
              </div>
              <div className="whitespace-pre-wrap text-[var(--ink)]">{isTyping ? shown : isJudge ? renderWithArticleLinks(m.content) : m.content}{isTyping ? <span className="ml-0.5 inline-block animate-pulse font-bold text-[var(--gold)]">▌</span> : null}</div>
            </div>
          );
        })}
        {judgment ? (
          <div className="rounded-[var(--r-lg)] border-2 border-[var(--gold)] bg-[var(--parchment)] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-bold text-[var(--gold)]">مسودة الحكم</div>
              <CopyBtn text={judgment.content} />
            </div>
            <div className="whitespace-pre-wrap text-sm leading-8 text-[var(--ink)]">
              {typing?.id === judgment.id ? judgment.content.slice(0, typedLen) : renderWithArticleLinks(judgment.content)}
              {typing?.id === judgment.id ? <span className="ml-0.5 inline-block animate-pulse font-bold text-[var(--gold)]">▌</span> : null}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="rounded-[var(--r-md)] border border-[var(--ruby)] px-4 py-2 text-sm text-[var(--ruby)]">{error}</p> : null}

      {/* سجلّ القرارات الإجرائيّة (منقول من القاعة الكلاسيكيّة): كلّ قرارٍ إجرائيّ ككتلةٍ مميّزة */}
      <DecisionsLog decisions={session?.decisions ?? []} />

      {/* شفافيّة قرار القاضي (يراها صانع القرار: قرأ المداخلة، كيّفها، ثمّ قرّر) */}
      {judgeMeta ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink-60)]"><Eye size={14} aria-hidden /> شفافيّة القاضي:</span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${judgeMeta.mode === "ai" ? "bg-[var(--emerald-soft)] text-[var(--emerald)]" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
            {judgeMeta.mode === "ai" ? "قرأ المداخلة وكيّفها ثمّ قرّر (ذكيّ مؤصَّل)" : "قرار إجرائيّ منضبط"}
          </span>
          {judgeMeta.classification ? <span className="rounded-full bg-[var(--gold-ghost)] px-2.5 py-0.5 font-semibold text-[var(--gold)]">تكييف المداخلة: {judgeMeta.classification}</span> : null}
        </div>
      ) : null}

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
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attachEvidence(f); }} />
                <button onClick={() => fileRef.current?.click()} disabled={busy} title="رفع مستند بيّنة (PDF/Word/نص/صورة)" className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50">
                  <Paperclip size={15} aria-hidden /> إرفاق بيّنة
                </button>
                <button onClick={closePleading} disabled={busy || !canClose} title={canClose ? "" : "لا يُقفل باب المرافعة قبل نطق الطرفين"} className="focus-ring rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--gold-border)] disabled:opacity-50">
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
          <button onClick={() => setShowClaimSheet((v) => !v)} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)] transition hover:opacity-90"><ScrollText size={15} aria-hidden /> صحيفة الدعوى</button>
          <button onClick={toggleLegalBasis} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)]"><Scale size={15} aria-hidden /> الأساس النظاميّ</button>
          <button onClick={computeStrength} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50"><Gauge size={15} aria-hidden /> تقييم قوّة الموقف</button>
          <button onClick={generateHearingRecord} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50"><FileText size={15} aria-hidden /> ضبط الجلسة</button>
          <button onClick={() => setShowSettlement((v) => !v)} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)] disabled:opacity-50"><Handshake size={15} aria-hidden /> مسودة صلح</button>
          <button onClick={toggleCatalog} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)]"><ClipboardList size={15} aria-hidden /> كتالوج الدفوع</button>
          <a href={`/api/simulations/${session?.id}/export?type=hearing-record&format=pdf`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:border-[var(--gold-border)]"><Download size={15} aria-hidden /> تصدير ضبط الجلسة</a>
        </div>

        {showClaimSheet ? (
          <ClaimSheet claim={extractClaimClient(session?.messages ?? [])} title={session?.title ?? ""} exportHref={`/api/simulations/${session?.id}/export?type=claim-sheet&format=pdf`} />
        ) : null}

        {showLegalBasis ? (
          <div className="mt-3 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-[var(--petrol)]">الأساس النظاميّ المسترجَع من النواة</div>
              {activatedScope.length ? <div className="text-[11px] text-[var(--muted)]">النطاق المفعّل: {activatedScope.join("، ")}</div> : null}
            </div>
            {legalBasis === null ? (
              <p className="p-3 text-center text-xs text-[var(--muted)]">جارٍ استرجاع المواد…</p>
            ) : legalBasis.length === 0 ? (
              <p className="p-3 text-center text-xs text-[var(--muted)]">لم يُعثر على مادّة نظاميّة مطابقة في النواة الحاليّة.</p>
            ) : (
              <div className="grid gap-1.5">
                {legalBasis.map((a, i) => (
                  <a key={i} href={a.internalUrl} target="_blank" rel="noreferrer" className="focus-ring block rounded-[var(--r-md)] border border-line p-2.5 transition hover:border-[var(--gold-border)]">
                    <div className="text-sm font-semibold text-[var(--gold)]">{a.citationLabel}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[var(--muted)]">{a.snippet}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {catalogOpen ? (
          <div className="mt-3 rounded-[var(--r-lg)] border border-line bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["الكل", ...Array.from(new Set(catalog.map((p) => p.category)))].map((cat) => (
                <button key={cat} onClick={() => setCatFilter(cat)} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${catFilter === cat ? "border-[var(--gold)] bg-[var(--gold-ghost)] text-[var(--gold)]" : "border-line text-[var(--muted)]"}`}>{cat}</button>
              ))}
            </div>
            <div className="grid max-h-72 gap-1.5 overflow-y-auto">
              {catalog.filter((p) => catFilter === "الكل" || p.category === catFilter).map((p) => (
                <button key={p.id} onClick={() => insertDefense(p)} title="إدراج في المرافعة" className="focus-ring rounded-[var(--r-md)] border border-line p-2.5 text-right transition hover:border-[var(--gold-border)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[var(--petrol)]">{p.title}</div>
                    <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">{p.category}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[var(--muted)]">{p.description}</div>
                  {p.litigationStages?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.litigationStages.slice(0, 3).map((st) => <span key={st} className="rounded bg-[var(--emerald-soft)] px-1.5 py-0.5 text-[10px] text-[var(--emerald)]">مرحلة: {st}</span>)}
                    </div>
                  ) : null}
                  {p.suggestedArticleNumbers?.length || p.preferredSystems?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(p.preferredSystems ?? []).slice(0, 2).map((s) => <span key={s} className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-[10px] text-[var(--gold)]">{s}</span>)}
                      {(p.suggestedArticleNumbers ?? []).slice(0, 4).map((n) => <span key={n} className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-[10px] text-[var(--gold)]">م/{n}</span>)}
                    </div>
                  ) : null}
                </button>
              ))}
              {catalog.length === 0 ? <p className="p-3 text-center text-xs text-[var(--muted)]">جارٍ تحميل الكتالوج…</p> : null}
            </div>
          </div>
        ) : null}

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
            <a href={`/api/simulations/${session?.id}/export?type=judgment&format=pdf`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]"><Download size={15} aria-hidden /> تصدير الحكم PDF</a>
            <a href={`/api/simulations/${session?.id}/export?type=judgment&format=docx`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]"><ScrollText size={15} aria-hidden /> تصدير الحكم Word</a>
            <a href={`/api/simulations/${session?.id}/export?type=full-report&format=pdf`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-line px-4 py-2 text-sm font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]"><FileText size={15} aria-hidden /> تقرير الجلسة PDF</a>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--ink-60)]">مرحلة ما بعد الحكم</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/dashboard/simulations/${session?.id}/appeal`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)]"><Scale size={15} aria-hidden /> لائحة استئناف</a>
              <a href={`/dashboard/simulations/${session?.id}/cassation`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)]"><Scale size={15} aria-hidden /> طلب نقض</a>
              <a href={`/dashboard/simulations/${session?.id}/reconsideration`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm font-semibold text-[var(--gold)]"><Scale size={15} aria-hidden /> التماس إعادة نظر</a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// مؤشّر حالة المزوّد: أخضر «Claude نشط (server)» أو رماديّ «حتميّ (لا مزوّد Claude)». عند ضبط
// مزوّدٍ غير Claude يُنبَّه صراحةً بأنّ القاضي حتميّ حتى يُضبط Anthropic.
function ProviderBadge({ provider }: { provider: { active: boolean; provider: string; model: string | null; nonClaudeConfigured: boolean } | null }) {
  if (!provider) return null;
  if (provider.active) {
    return (
      <span title={`المزوّد: Claude${provider.model ? " · " + provider.model : ""}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--emerald-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--emerald)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" /> القاضي الذكيّ (Claude) نشط
      </span>
    );
  }
  return (
    <span title={provider.nonClaudeConfigured ? `المزوّد المضبوط (${provider.provider}) ليس Claude — القاضي حتميّ حتى يُضبط Anthropic` : "لا مفتاح Claude مضبوط — القاضي حتميّ"} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" /> {provider.nonClaudeConfigured ? "حتميّ (المزوّد ليس Claude)" : "حتميّ (لا مزوّد Claude)"}
    </span>
  );
}

// سجلّ القرارات الإجرائيّة — يعرض كلّ قرارٍ إجرائيّ (توجيه يمين/ندب خبير/حصر محل نزاع/طلب
// بيّنة/قفل مرافعة/عرض صلح) ككتلةٍ مميّزة عن الحكم، تمييزًا للإجراء عن المنطوق.
function DecisionsLog({ decisions }: { decisions: Array<{ decisionType: string; content: string }> }) {
  const shown = decisions.filter((d) => !d.decisionType.includes("فتح"));
  if (!shown.length) return null;
  return (
    <div className="rounded-[var(--r-xl)] border border-line bg-ivory p-4">
      <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-60)]"><Gavel size={13} aria-hidden /> سجلّ القرارات الإجرائيّة</p>
      <div className="grid gap-2">
        {shown.map((d, i) => (
          <div key={i} className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--parchment)] p-3">
            <div className="mb-1 inline-flex rounded-full bg-[var(--gold-ghost)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--gold)]">قرارٌ إجرائيّ: {d.decisionType}</div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">{d.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// زرّ نسخ النصّ (منقول من copyVerdictToClipboard في القاعة الكلاسيكيّة).
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* المتصفّح قد يمنع النسخ — تجاهل بهدوء */
    }
  }, [text]);
  return (
    <button onClick={copy} className="focus-ring inline-flex items-center gap-1 rounded-[var(--r-md)] border border-line bg-white px-2 py-1 text-[11px] font-semibold text-[var(--muted)] transition hover:border-[var(--gold-border)]">
      {done ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />} {done ? "نُسخ" : "نسخ"}
    </button>
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

// صحيفة الدعوى الكاملة — تعرض بيانات القضية المبنيَنة (الأطراف، الموضوع، الوقائع، الطلبات،
// الأساس النظاميّ) كما في ملفّ القضية بالقاعة الكلاسيكيّة، مع تصديرها.
function ClaimSheet({ claim, title, exportHref }: { claim: Record<string, string> | null; title: string; exportHref: string }) {
  if (!claim) {
    return <div className="mt-3 rounded-[var(--r-lg)] border border-line bg-white p-4 text-center text-sm text-[var(--muted)]">لم تُسجَّل صحيفة دعوى مبنيَنة لهذه الجلسة.</div>;
  }
  const rows: Array<[string, string | undefined]> = [
    ["الموضوع", claim.subject || title],
    ["نوع الدعوى", claim.caseType],
    ["المدّعي", [claim.plaintiffName, claim.plaintiffCapacity].filter(Boolean).join(" — ")],
    ["المدّعى عليه", [claim.defendantName, claim.defendantCapacity].filter(Boolean).join(" — ")],
    ["قيمة المطالبة", claim.claimAmount],
    ["الوقائع", claim.facts],
    ["الطلبات", claim.requests],
    ["الأساس النظاميّ المذكور", claim.legalGrounds],
    ["الدفوع", claim.defenses]
  ];
  const shown = rows.filter(([, v]) => v && String(v).trim());
  return (
    <div className="mt-3 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--parchment)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-judicial text-base font-bold text-[var(--navy)]">صحيفة الدعوى</div>
        <a href={exportHref} className="focus-ring inline-flex items-center gap-1 rounded-[var(--r-md)] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-[var(--petrol)] hover:border-[var(--gold-border)]"><Download size={13} aria-hidden /> تصدير PDF</a>
      </div>
      <dl className="grid gap-2 text-sm">
        {shown.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-line/60 pb-2 last:border-0">
            <dt className="font-semibold text-[var(--ink-60)]">{label}</dt>
            <dd className="whitespace-pre-wrap leading-7 text-[var(--ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FormalPreamble({ claim, title }: { claim: Record<string, string> | null; title: string }) {
  if (!claim) return null;
  const line = (label: string, name?: string, cap?: string) =>
    name ? `${label}: ${name}${cap ? ` — بصفته ${cap}` : ""}` : null;
  const rows = [
    line("المدّعي", claim.plaintiffName, claim.plaintiffCapacity),
    line("المدّعى عليه", claim.defendantName, claim.defendantCapacity),
    claim.caseType ? `نوع الدعوى: ${claim.caseType}` : null,
    claim.claimAmount ? `قيمة المطالبة: ${claim.claimAmount}` : null
  ].filter(Boolean) as string[];
  return (
    <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--parchment)] p-4 text-center">
      <div className="font-judicial text-lg font-bold text-[var(--navy)]">بسم الله الرحمن الرحيم</div>
      <div className="mt-1 text-sm font-semibold text-[var(--gold)]">الدائرة الافتراضيّة — منصّة حكيم للمحاكاة القضائيّة</div>
      <div className="mt-2 text-sm text-[var(--ink)]">موضوع الدعوى: {claim.subject || title}</div>
      {rows.length ? (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          {rows.map((r, i) => <span key={i}>{r}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function StageBar({ current, hasJudgment }: { current: string; hasJudgment: boolean }) {
  const activeIdx = hasJudgment ? STAGE_FLOW.length - 1 : STAGE_INDEX[current] ?? 0;
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-[var(--r-lg)] border border-line bg-ivory p-2">
      {STAGE_FLOW.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s} className="flex flex-none items-center gap-1">
            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-[var(--gold)] text-[var(--navy)]" : done ? "bg-[var(--emerald-soft)] text-[var(--emerald)]" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
              {done ? "✓ " : ""}{stageLabel(s)}
            </span>
            {i < STAGE_FLOW.length - 1 ? <span className="text-[var(--ink-40)]">←</span> : null}
          </div>
        );
      })}
    </div>
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
