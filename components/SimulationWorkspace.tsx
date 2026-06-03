"use client";

import { useMemo, useState } from "react";
import { ClaimSheetCard, GoldButton, HearingMessage, HearingRecordDocument, JudgmentDocument, LegalAlert, LegalBadge, LegalCard, LegalEmptyState, NavyButton, StageTracker, StrengthScoreCard } from "@/components/ui/legal";
import { admissibilityCheck, claimMarker, scoreMarker } from "@/lib/modules/simulations/hakeem-judge";
import { isPleadingClosed } from "@/lib/modules/simulations/judge-engine";
import { stageLabel } from "@/lib/modules/simulations/simulation-labels";

type SimulationMessage = { id: string; role: string; stage: string; content: string; createdAt: string };
type SimulationDecision = { id: string; decisionType: string; content: string; stage: string; createdAt: string };
type SimulationJudgment = { id: string; content: string; disclaimer: string; createdAt: string };
type SimulationSession = {
  id: string;
  title: string;
  stage: string;
  createdAt: string;
  messages: SimulationMessage[];
  decisions: SimulationDecision[];
  judgments: SimulationJudgment[];
};
type CaseOption = { id: string; title: string };
type AttachmentOption = { id: string; fileName: string; mimeType: string; createdAt: string };
type ClaimForm = Record<string, string>;

const roles = ["المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه"];
const caseTypes = ["تجارية", "مدنية", "عمالية", "أحوال شخصية", "تنفيذ", "أخرى"];
const wizardSteps = ["الأطراف", "الموضوع", "الوقائع", "البينات", "المراجعة"];
const decisionTypes = ["فتح باب المرافعة", "تمكين المدعي من الرد", "تمكين المدعى عليه من الجواب", "طلب مستند", "طلب إيضاح", "عرض الصلح", "قفل باب المرافعة"];
const appealReasons: Record<string, string[]> = {
  استئناف: ["خطأ في التكييف", "قصور في التسبيب", "مخالفة الثابت بالأوراق", "خطأ في تطبيق النظام"],
  نقض: ["مخالفة أحكام الشريعة أو الأنظمة", "صدور الحكم من محكمة غير مختصة", "الخطأ في تكييف الواقعة", "مخالفة الإجراءات الجوهرية"],
  "التماس إعادة نظر": ["ظهور أوراق قاطعة", "وقوع غش", "الحكم بشيء لم يطلبه الخصوم", "تناقض منطوق الحكم", "عدم التمثيل الصحيح"]
};

const emptyClaim: ClaimForm = {
  title: "",
  caseType: "تجارية",
  plaintiffName: "",
  plaintiffCapacity: "",
  defendantName: "",
  defendantCapacity: "",
  subject: "",
  facts: "",
  requests: "",
  claimAmount: "",
  legalGrounds: "",
  defenses: "",
  attendance: ""
};

export function SimulationWorkspace({ initialSessions, cases, attachments }: { initialSessions: SimulationSession[]; cases: CaseOption[]; attachments: AttachmentOption[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState<SimulationSession | null>(initialSessions[0] ?? null);
  const [claim, setClaim] = useState<ClaimForm>(() => extractClaim(initialSessions[0]) ?? emptyClaim);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [role, setRole] = useState(roles[0]);
  const [message, setMessage] = useState("");
  const [decisionType, setDecisionType] = useState(decisionTypes[0]);
  const [settlement, setSettlement] = useState({ amount: "", obligations: "", duration: "", waiver: "" });
  const [appealKind, setAppealKind] = useState("استئناف");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [wizardStep, setWizardStep] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [judgeHint, setJudgeHint] = useState("ابدأ بتقييد الدعوى ثم افتح الجلسة ليستطيع القاضي حكيم تنظيم تبادل المرافعات.");

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId), [cases, selectedCaseId]);
  const activeClaim = extractClaim(activeSession) ?? claim;
  const admissibility = admissibilityCheck(activeClaim);
  const cleanMessages = activeSession?.messages.filter((item) => !item.content.startsWith(claimMarker) && !item.content.startsWith(scoreMarker)) ?? [];
  const proceduralDecisions = activeSession?.decisions ?? [];
  const hearingRecord = lastMatching(activeSession?.decisions, (item) => item.decisionType === "ضبط جلسة تدريبية");
  const latestJudgment = activeSession?.judgments.at(-1);
  const strength = extractStrength(activeSession);
  const closed = isPleadingClosed(proceduralDecisions);

  async function refreshSession(sessionId: string) {
    const response = await fetch(`/api/simulations/${sessionId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? "تعذر تحميل جلسة القاضي حكيم.");
    const session = payload.session as SimulationSession;
    setActiveSession(session);
    setClaim((payload.claim as ClaimForm) ?? emptyClaim);
    setSessions((current) => (current.some((item) => item.id === session.id) ? current.map((item) => (item.id === session.id ? session : item)) : [session, ...current]));
  }

  async function startSession() {
    setBusy("start");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...claim, caseTitle: selectedCase?.title })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر بدء المحاكاة.");
      await refreshSession(payload.sessionId);
      setNotice("تم إنشاء جلسة محاكاة قضائية.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر بدء المحاكاة.");
    } finally {
      setBusy("");
    }
  }

  async function saveClaim() {
    if (!activeSession) return startSession();
    setBusy("claim");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(claim)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تقييد الدعوى.");
      await refreshSession(activeSession.id);
      setNotice(payload.admissibility?.message ?? "تم تحديث صحيفة الدعوى.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تقييد الدعوى.");
    } finally {
      setBusy("");
    }
  }

  async function post(endpoint: string, body?: unknown, busyKey = "action") {
    if (!activeSession) return;
    setBusy(busyKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}/${endpoint}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تنفيذ العملية.");
      if (endpoint === "judge-turn" && payload.result) {
        setJudgeHint(payload.result.nextProceduralStep);
      }
      await refreshSession(activeSession.id);
      setMessage("");
      setNotice(successMessage(endpoint));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy("");
    }
  }

  async function sendPleading() {
    if (!message.trim()) {
      setError("اكتب المداخلة قبل إرسالها.");
      return;
    }
    await post("messages", { role, content: message }, "message");
    if (activeSession) await post("judge-turn", undefined, "judge");
  }

  function updateClaim(key: string, value: string) {
    setClaim((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="legal-luxury-surface -mx-2 rounded-xl p-3 md:p-5">
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <LegalCard title="جلسات القاضي حكيم" eyebrow="السجل">
          <GoldButton type="button" onClick={() => { setActiveSession(null); setClaim(emptyClaim); }} className="w-full">
            بدء جلسة محاكاة قضائية
          </GoldButton>
          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? <LegalEmptyState title="لا توجد جلسات سابقة." /> : null}
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => void refreshSession(session.id)}
                className={`w-full rounded-md border p-3 text-right ${activeSession?.id === session.id ? "border-[var(--gold)] bg-[var(--gold-ghost)]" : "border-[var(--ink-08)] bg-white"}`}
              >
                <span className="t-display block font-bold text-[var(--navy)]">{session.title}</span>
                <span className="t-mono mt-1 block text-xs text-[var(--ink-50)]">{session.id}</span>
                <span className="mt-2 block text-xs text-[var(--gold)]">{stageLabel(session.stage)}</span>
              </button>
            ))}
          </div>
        </LegalCard>

        <div className="space-y-6">
          <LegalCard eyebrow="القاضي حكيم" title="محكمة افتراضية لتدريب المسار القضائي">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="t-head text-4xl font-bold text-[var(--navy)]">{activeSession?.title || "تقييد دعوى تدريبية"}</h1>
                <p className="t-mono mt-2 text-sm text-[var(--ink-50)]">{activeSession?.id ? `رقم الجلسة: ${activeSession.id}` : "جلسة جديدة غير مقيدة بعد"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LegalBadge status="محاكاة تدريبية" />
                <LegalBadge status={stageLabel(activeSession?.stage ?? "CLAIM_FILING")} />
              </div>
            </div>
            <div className="mt-5">
              <StageTracker currentStage={activeSession?.stage ?? "CLAIM_FILING"} />
            </div>
          </LegalCard>

          {notice ? <LegalAlert tone="success">{notice}</LegalAlert> : null}
          {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}

          <LegalCard title="تقييد صحيفة الدعوى" eyebrow="معالج الدعوى">
            <div className="wizard-wrap">
              <div className="wizard-nav">
                {wizardSteps.map((step, index) => (
                  <button key={step} type="button" onClick={() => setWizardStep(index)} className={`wz-step ${wizardStep === index ? "active" : ""}`}>
                    <span className="wz-num">{(index + 1).toLocaleString("ar-SA")}</span>
                    <span>{step}</span>
                  </button>
                ))}
              </div>
              <div className="wizard-body">
                {wizardStep === 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="اسم المدعي" value={claim.plaintiffName} onChange={(value) => updateClaim("plaintiffName", value)} />
                    <Field label="صفة المدعي" value={claim.plaintiffCapacity} onChange={(value) => updateClaim("plaintiffCapacity", value)} />
                    <Field label="اسم المدعى عليه" value={claim.defendantName} onChange={(value) => updateClaim("defendantName", value)} />
                    <Field label="صفة المدعى عليه" value={claim.defendantCapacity} onChange={(value) => updateClaim("defendantCapacity", value)} />
                    <TextArea label="الحضور والوكالة والصفة" value={claim.attendance} onChange={(value) => updateClaim("attendance", value)} />
                  </div>
                ) : null}
                {wizardStep === 1 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="عنوان الدعوى" value={claim.title} onChange={(value) => updateClaim("title", value)} />
                    <Select label="نوع الدعوى" value={claim.caseType} onChange={(value) => updateClaim("caseType", value)} options={caseTypes} />
                    <Select label="بدء من قضية موجودة" value={selectedCaseId} onChange={setSelectedCaseId} options={["", ...cases.map((item) => item.id)]} labels={{ "": "دون ربط", ...Object.fromEntries(cases.map((item) => [item.id, item.title])) }} />
                    <Field label="مبلغ المطالبة" value={claim.claimAmount} onChange={(value) => updateClaim("claimAmount", value)} />
                    <TextArea label="موضوع الدعوى" value={claim.subject} onChange={(value) => updateClaim("subject", value)} />
                  </div>
                ) : null}
                {wizardStep === 2 ? (
                  <div className="grid gap-4">
                    <TextArea label="الوقائع" value={claim.facts} onChange={(value) => updateClaim("facts", value)} rows={5} />
                    <TextArea label="الطلبات" value={claim.requests} onChange={(value) => updateClaim("requests", value)} rows={4} />
                    <TextArea label="الأسانيد النظامية أو التعاقدية" value={claim.legalGrounds} onChange={(value) => updateClaim("legalGrounds", value)} rows={4} />
                    <TextArea label="الدفوع المحتملة" value={claim.defenses} onChange={(value) => updateClaim("defenses", value)} rows={4} />
                  </div>
                ) : null}
                {wizardStep === 3 ? (
                  <div className="upload-zone">
                    <p className="t-display text-lg font-bold text-[var(--navy)]">المرفقات والبينات</p>
                    <p className="mt-2 text-sm text-[var(--ink-60)]">تعرض هذه المساحة المرفقات المسجلة حاليًا. رفع الملفات الحقيقي يبقى عبر وحدة المرفقات المفعلة في المنصة.</p>
                    <div className="file-list mt-4">
                      {attachments.length ? attachments.slice(0, 6).map((file) => (
                        <div key={file.id} className="file-item">
                          <span>{file.fileName}</span>
                          <small>{file.mimeType} · {new Date(file.createdAt).toLocaleDateString("ar-SA")}</small>
                        </div>
                      )) : <LegalEmptyState title="لا توجد مرفقات ظاهرة حاليًا." description="TODO: استخراج نص PDF/DOCX لاحقًا لدعم تحليل البينات." />}
                    </div>
                  </div>
                ) : null}
                {wizardStep === 4 ? <ClaimSheetCard claim={claim} /> : null}
              </div>
              <div className="wizard-footer flex flex-wrap justify-between gap-2">
                <NavyButton type="button" onClick={() => setWizardStep((step) => Math.max(0, step - 1))} disabled={wizardStep === 0}>السابق</NavyButton>
                <div className="flex gap-2">
                  <GoldButton type="button" onClick={() => setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))} disabled={wizardStep === wizardSteps.length - 1}>التالي</GoldButton>
                  <NavyButton type="button" onClick={() => void saveClaim()} disabled={busy === "claim" || busy === "start"}>{busy === "claim" || busy === "start" ? "جار الحفظ..." : "حفظ صحيفة الدعوى"}</NavyButton>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <LegalAlert tone={admissibility.complete ? "success" : "warning"}>{admissibility.message}</LegalAlert>
            </div>
          </LegalCard>

          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <LegalCard title="سجل المرافعة" eyebrow="محضر حي">
              <div className="hearing-chat">
                <div className="hearing-chat-header">
                  <strong>الجلسة القضائية</strong>
                  <span>{judgeHint}</span>
                </div>
                <div className="space-y-3 p-4">
                  {cleanMessages.length ? cleanMessages.map((item) => <HearingMessage key={item.id} {...item} />) : <LegalEmptyState title="لم تبدأ المرافعة بعد." description="أدخل مداخلة المدعي أو استدع القاضي لفتح المسار." />}
                  {busy === "judge" ? <p className="rounded-md bg-[var(--gold-ghost)] p-3 text-sm text-[var(--navy)]">القاضي حكيم يراجع المرحلة التالية...</p> : null}
                </div>
                <div className="border-t border-[var(--ink-08)] p-4">
                  <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                    <Select label="صفة المتحدث" value={role} onChange={setRole} options={roles} />
                    <TextArea label="نص المداخلة" value={message} onChange={setMessage} rows={3} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <GoldButton type="button" onClick={() => void sendPleading()} disabled={!activeSession || busy === "message" || busy === "judge"}>إرسال المداخلة</GoldButton>
                    <NavyButton type="button" onClick={() => void post("judge-turn", undefined, "judge")} disabled={!activeSession || busy === "judge"}>استدعاء القاضي حكيم</NavyButton>
                  </div>
                </div>
              </div>
            </LegalCard>

            <div className="space-y-6">
              <LegalCard title="إجراءات الجلسة" eyebrow="أوامر قضائية">
                <Select label="نوع القرار" value={decisionType} onChange={setDecisionType} options={decisionTypes} />
                <div className="mt-3 grid gap-2">
                  <GoldButton type="button" onClick={() => void post("decisions", { decisionType }, "decision")} disabled={!activeSession}>إصدار قرار إجرائي</GoldButton>
                  <NavyButton type="button" onClick={() => void post("hearing-record", undefined, "record")} disabled={!activeSession}>توليد ضبط الجلسة</NavyButton>
                  <NavyButton type="button" onClick={() => void post("decisions", { decisionType: "قفل باب المرافعة", content: "قررت الدائرة الافتراضية قفل باب المرافعة وحجز ملف المحاكاة لإعداد مسودة الحكم." }, "close")} disabled={!activeSession || closed}>قفل باب المرافعة</NavyButton>
                  <GoldButton type="button" onClick={() => void post("judgment", undefined, "judgment")} disabled={!activeSession || !closed}>إصدار مسودة حكم قضائي مسبب</GoldButton>
                </div>
              </LegalCard>

              <LegalCard title="قياس قوة الدعوى" eyebrow="تقدير تدريبي">
                <StrengthScoreCard score={strength?.score} notes={strength?.notes} />
                <GoldButton type="button" onClick={() => void post("strength-score", { attachmentsCount: attachments.length }, "strength")} disabled={!activeSession} className="mt-4 w-full">تحديث القياس</GoldButton>
              </LegalCard>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <LegalCard title="القرارات الإجرائية" eyebrow="سجل القرارات">
              {proceduralDecisions.length ? (
                <div className="space-y-3">
                  {proceduralDecisions.map((decision) => (
                    <article key={decision.id} className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-white/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[var(--navy)]">{decision.decisionType}</strong>
                        <LegalBadge status={stageLabel(decision.stage)} />
                      </div>
                      <p className="mt-3 whitespace-pre-wrap leading-7 text-[var(--ink-80)]">{decision.content}</p>
                    </article>
                  ))}
                </div>
              ) : <LegalEmptyState title="لا توجد قرارات إجرائية بعد." />}
            </LegalCard>

            <LegalCard title="مسودة الصلح" eyebrow="مرحلة الصلح">
              <div className="grid gap-3">
                <Field label="مبلغ التسوية" value={settlement.amount} onChange={(value) => setSettlement((current) => ({ ...current, amount: value }))} />
                <TextArea label="الالتزامات" value={settlement.obligations} onChange={(value) => setSettlement((current) => ({ ...current, obligations: value }))} rows={3} />
                <Field label="مدة التنفيذ" value={settlement.duration} onChange={(value) => setSettlement((current) => ({ ...current, duration: value }))} />
                <TextArea label="شرط التنازل أو إنهاء النزاع" value={settlement.waiver} onChange={(value) => setSettlement((current) => ({ ...current, waiver: value }))} rows={3} />
                <GoldButton type="button" onClick={() => void post("settlement", settlement, "settlement")} disabled={!activeSession}>إنشاء مسودة صلح</GoldButton>
              </div>
            </LegalCard>
          </div>

          {hearingRecord ? (
            <LegalCard title="ضبط الجلسة" eyebrow="وثيقة رسمية تدريبية">
              <HearingRecordDocument content={hearingRecord.content} />
              {activeSession ? <ExportLinks sessionId={activeSession.id} type="hearing-record" /> : null}
            </LegalCard>
          ) : null}

          {latestJudgment ? (
            <LegalCard title="مسودة الحكم" eyebrow="مسبب ومنظم">
              <JudgmentDocument content={latestJudgment.content} disclaimer={latestJudgment.disclaimer} />
              {activeSession ? <ExportLinks sessionId={activeSession.id} type="judgment" full /> : null}
            </LegalCard>
          ) : null}

          {latestJudgment ? (
            <LegalCard title="مسارات الاعتراض" eyebrow="بعد الحكم">
              <div className="appeal-grid">
                {Object.keys(appealReasons).map((kind) => (
                  <button key={kind} type="button" className={`appeal-card ${appealKind === kind ? "active" : ""}`} onClick={() => setAppealKind(kind)}>
                    <strong>{kind}</strong>
                    <span>{appealReasons[kind].length.toLocaleString("ar-SA")} أسباب مقترحة</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {appealReasons[appealKind].map((reason) => (
                  <label key={reason} className="choice-box">
                    <input type="checkbox" checked={selectedReasons.includes(reason)} onChange={(event) => setSelectedReasons((current) => event.target.checked ? [...current, reason] : current.filter((item) => item !== reason))} />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              <GoldButton type="button" className="mt-4" onClick={() => void post("appeal", { kind: appealKind, reasons: selectedReasons }, "appeal")} disabled={!activeSession}>إنشاء مسودة اعتراض تدريبية</GoldButton>
            </LegalCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input className="finput" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="field-row md:col-span-2">
      <span>{label}</span>
      <textarea className="ftextarea" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <select className="finput" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function ExportLinks({ sessionId, type, full = false }: { sessionId: string; type: "judgment" | "hearing-record"; full?: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <a className="btn btn-outline" href={`/api/simulations/${sessionId}/export?type=${type}&format=pdf`}>تصدير PDF</a>
      <a className="btn btn-outline" href={`/api/simulations/${sessionId}/export?type=${type}&format=docx`}>تصدير DOCX</a>
      {full ? <a className="btn btn-gold" href={`/api/simulations/${sessionId}/export?type=full-report&format=docx`}>تصدير تقرير الجلسة كاملًا</a> : null}
    </div>
  );
}

function extractClaim(session?: SimulationSession | null): ClaimForm | undefined {
  const source = [...(session?.messages ?? [])].reverse().find((item) => item.content.startsWith(claimMarker));
  if (!source) return undefined;
  try {
    return JSON.parse(source.content.slice(claimMarker.length)) as ClaimForm;
  } catch {
    return undefined;
  }
}

function extractStrength(session?: SimulationSession | null): { score: number; notes: string[] } | undefined {
  const source = [...(session?.messages ?? [])].reverse().find((item) => item.content.startsWith(scoreMarker));
  if (!source) return undefined;
  try {
    return JSON.parse(source.content.slice(scoreMarker.length)) as { score: number; notes: string[] };
  } catch {
    return undefined;
  }
}

function lastMatching<T>(items: T[] | undefined, predicate: (item: T) => boolean) {
  return [...(items ?? [])].reverse().find(predicate);
}

function successMessage(endpoint: string) {
  if (endpoint === "messages") return "تمت إضافة المداخلة.";
  if (endpoint === "judge-turn") return "حدد القاضي حكيم الخطوة التالية.";
  if (endpoint === "judgment") return "تم إصدار مسودة حكم قضائي مسبب.";
  if (endpoint === "hearing-record") return "تم توليد ضبط الجلسة.";
  if (endpoint === "decisions") return "تم حفظ القرار الإجرائي.";
  return "تم تنفيذ العملية بنجاح.";
}
