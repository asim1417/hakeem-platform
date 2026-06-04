"use client";

import { useMemo, useState } from "react";
import {
  OriginalAppealCards,
  OriginalAuditRows,
  OriginalCaseHub,
  OriginalHearingRecord,
  OriginalHearingTranscript,
  OriginalHero,
  OriginalJudgeMessage,
  OriginalProceduralDecision,
  OriginalStrengthMeter,
  OriginalUploadZone,
  OriginalVerdictDocument,
  OriginalWorkflowTrack,
  OriginalWizard,
  OriginalWizardStep
} from "./HakeemOriginalUI";
import { admissibilityCheck, claimMarker, scoreMarker } from "@/lib/modules/simulations/hakeem-judge";
import { allowedSpeakerLabel, extractTurnState, isPleadingClosed, isRoleAllowedToSpeak, turnMarker, turnMessageForBlockedRole } from "@/lib/modules/simulations/judge-engine";
import { stageLabel } from "@/lib/modules/simulations/simulation-labels";
import { PostJudgmentRemediesPanel } from "@/components/PostJudgmentRemediesPanel";

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

const flowStages = [
  { key: "CLAIM_FILING", label: "قيد الدعوى" },
  { key: "INITIAL_ADMISSIBILITY", label: "الفحص الشكلي" },
  { key: "HEARING_RECORD", label: "ضبط الجلسة" },
  { key: "PLEADING", label: "فتح المرافعة" },
  { key: "PLAINTIFF_STATEMENT", label: "مداخلة المدعي" },
  { key: "DEFENDANT_RESPONSE", label: "جواب المدعى عليه" },
  { key: "PROCEDURAL_DECISION", label: "قرار إجرائي" },
  { key: "SETTLEMENT", label: "الصلح" },
  { key: "CLOSE_PLEADING", label: "قفل المرافعة" },
  { key: "TRAINING_JUDGMENT", label: "مسودة الحكم" }
];

const wizardSteps = [
  { title: "بيانات الأطراف", subtitle: "المدعي والمدعى عليه" },
  { title: "المطالبة", subtitle: "نوع الدعوى والمبلغ" },
  { title: "الوقائع", subtitle: "سرد النزاع" },
  { title: "الطلبات", subtitle: "الطلبات والدفوع" },
  { title: "المرفقات والمراجعة", subtitle: "البينات والخلاصة" }
];

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

export function HakeemJudgeExperience({ initialSessions, cases, attachments }: { initialSessions: SimulationSession[]; cases: CaseOption[]; attachments: AttachmentOption[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState<SimulationSession | null>(initialSessions[0] ?? null);
  const [claim, setClaim] = useState<ClaimForm>(() => extractClaim(initialSessions[0]) ?? emptyClaim);
  const [view, setView] = useState("hub");
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [entry, setEntry] = useState({ role: "المدعي", capacity: "", nationalId: "", poa: "" });
  const [messageRole, setMessageRole] = useState("المدعي");
  const [message, setMessage] = useState("");
  const [settlement, setSettlement] = useState({ amount: "", obligations: "", duration: "", waiver: "" });
  const [appealKind, setAppealKind] = useState("استئناف");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [judgeState, setJudgeState] = useState({
    currentRole: "المدعي",
    nextRole: "المدعي",
    nextAction: "تقييد الدعوى ثم دخول الجلسة",
    needsDocument: false,
    canSettle: false,
    canClose: false,
    canJudge: false,
    availableActions: ["تقييد الدعوى"]
  });

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId), [cases, selectedCaseId]);
  const activeClaim = extractClaim(activeSession) ?? claim;
  const turnState = extractTurnState(activeSession?.messages);
  const visibleMessages = activeSession?.messages.filter((item) => !item.content.startsWith(claimMarker) && !item.content.startsWith(scoreMarker) && !item.content.startsWith(turnMarker)) ?? [];
  const hearingRecord = [...(activeSession?.decisions ?? [])].reverse().find((item) => item.decisionType === "ضبط جلسة تدريبية");
  const latestDecision = activeSession?.decisions.at(-1);
  const latestJudgment = activeSession?.judgments.at(-1);
  const strength = extractStrength(activeSession) ?? localStrength(activeClaim, attachments.length);
  const closed = isPleadingClosed(activeSession?.decisions ?? []);
  const hasRecord = Boolean(hearingRecord);
  const hasJudgment = Boolean(latestJudgment);
  const canSpeakNow = isRoleAllowedToSpeak(messageRole, turnState);
  const inputLocked = Boolean(activeSession && (!canSpeakNow || closed || busy === "message" || busy === "judge"));
  const turnNotice = closed ? "تم قفل باب المرافعة، ولا يمكن إضافة مداخلات جديدة." : turnMessageForBlockedRole(turnState);

  async function refreshSession(sessionId: string) {
    const response = await fetch(`/api/simulations/${sessionId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? "تعذر تحميل جلسة القاضي حكيم.");
    const session = payload.session as SimulationSession;
    setActiveSession(session);
    setClaim((payload.claim as ClaimForm) ?? emptyClaim);
    setSessions((current) => (current.some((item) => item.id === session.id) ? current.map((item) => (item.id === session.id ? session : item)) : [session, ...current]));
    setJudgeState(localDetermineNextTurn(session, (payload.claim as ClaimForm) ?? emptyClaim, attachments.length));
  }

  async function startOrSaveClaim() {
    setBusy("claim");
    clearMessages();
    try {
      if (!activeSession) {
        const response = await fetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ ...claim, caseTitle: selectedCase?.title })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message ?? "تعذر تقييد الدعوى.");
        await refreshSession(payload.sessionId);
      } else {
        const response = await fetch(`/api/simulations/${activeSession.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(claim)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message ?? "تعذر تحديث صحيفة الدعوى.");
        await refreshSession(activeSession.id);
      }
      setNotice("تم تقييد صحيفة الدعوى، ويمكن الآن دخول الجلسة.");
      setView("enter");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تقييد الدعوى.");
    } finally {
      setBusy("");
    }
  }

  async function post(endpoint: string, body?: unknown, busyKey = "action") {
    if (!activeSession) return;
    setBusy(busyKey);
    clearMessages();
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}/${endpoint}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تنفيذ العملية.");
      if (endpoint === "judge-turn" && payload.result) {
        setJudgeState({
          currentRole: payload.result.currentTurn,
          nextRole: payload.result.currentTurn,
          nextAction: payload.result.nextProceduralStep,
          needsDocument: payload.result.availableActions?.includes("طلب مستند") ?? false,
          canSettle: payload.result.availableActions?.includes("عرض الصلح") ?? false,
          canClose: Boolean(payload.result.canClosePleading),
          canJudge: Boolean(payload.result.canGenerateJudgment),
          availableActions: payload.result.availableActions ?? []
        });
      }
      await refreshSession(activeSession.id);
      setNotice(successMessage(endpoint));
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy("");
    }
  }

  async function enterHearing() {
    if (!activeSession) {
      setError("قيّد الدعوى قبل دخول الجلسة.");
      return;
    }
    setClaim((current) => ({ ...current, attendance: `${entry.role} - الصفة: ${entry.capacity || "غير محددة"} - الهوية: ${entry.nationalId || "غير مسجلة"} - الوكالة: ${entry.poa || "لا توجد"}` }));
    await post("messages", { role: "النظام", content: `تم دخول الجلسة بصفة ${entry.role}. الصفة: ${entry.capacity || "غير محددة"}. رقم الهوية: ${entry.nationalId || "غير مسجل"}. رقم الوكالة: ${entry.poa || "لا يوجد"}.` }, "entry");
    setView("record");
  }

  async function createHearingRecord() {
    if (!activeSession) return;
    await post("hearing-record", undefined, "record");
    await post("decisions", { decisionType: "فتح باب المرافعة", content: "قررت الدائرة الافتراضية فتح باب المرافعة وتمكين الأطراف من تقديم مداخلاتهم وفق ترتيب الجلسة." }, "decision");
    setView("pleading");
  }

  async function sendPleading() {
    if (!hasRecord) {
      setError("لا مرافعة قبل ضبط الجلسة.");
      return;
    }
    if (!message.trim()) {
      setError("اكتب المداخلة قبل إرسالها.");
      return;
    }
    if (inputLocked) {
      setError(turnNotice);
      return;
    }
    await post("messages", { role: messageRole, content: message }, "message");
    setMessage("");
    await post("judge-turn", undefined, "judge");
  }

  async function closePleading() {
    if (!activeSession) return;
    await post("decisions", { decisionType: "قفل باب المرافعة", content: "قررت الدائرة الافتراضية قفل باب المرافعة وحجز ملف المحاكاة لإعداد مسودة حكم قضائي مسبب." }, "close");
    setView("judgment");
  }

  async function createJudgment() {
    if (!closed) {
      setError("لا يمكن إصدار مسودة الحكم قبل قفل باب المرافعة.");
      return;
    }
    await post("judgment", undefined, "judgment");
    setView("judgment");
  }

  function updateClaim(key: string, value: string) {
    setClaim((current) => ({ ...current, [key]: value }));
  }

  function clearMessages() {
    setError("");
    setNotice("");
  }

  return (
    <div className="ho-experience">
      <OriginalHero
        title="القاضي حكيم"
        subtitle="مركز إدارة جلسة قضائية تدريبية يبدأ من تقييد الدعوى ثم دخول الجلسة وضبطها وإدارة المرافعة حتى مسودة حكم قضائي مسبب."
        actions={
          <>
            <button className="btn btn-gold" type="button" onClick={() => setView("claim")}>تقييد دعوى جديدة</button>
            <button className="btn btn-outline ho-hero-outline" type="button" onClick={() => setView("hub")}>مركز القضية</button>
          </>
        }
      />

      <div className="stats-row">
        <div className="stat-card"><div className="stat-lbl">الجلسات</div><div className="stat-val">{sessions.length.toLocaleString("ar-SA")}</div><div className="stat-sub">مرتبطة بقاعدة البيانات</div></div>
        <div className="stat-card"><div className="stat-lbl">المداخلات</div><div className="stat-val">{visibleMessages.length.toLocaleString("ar-SA")}</div><div className="stat-sub">محضر تفاعلي</div></div>
        <div className="stat-card"><div className="stat-lbl">قوة الدعوى</div><div className="stat-val">{strength.score.toLocaleString("ar-SA")}<span className="ho-stat-unit">/100</span></div><div className="stat-sub warn">تقدير تدريبي</div></div>
        <div className="stat-card"><div className="stat-lbl">القرارات</div><div className="stat-val">{(activeSession?.decisions.length ?? 0).toLocaleString("ar-SA")}</div><div className="stat-sub">تسجل في audit logs</div></div>
      </div>

      <OriginalWorkflowTrack stages={flowStages} currentStage={activeSession?.stage ?? "CLAIM_FILING"} />

      {notice ? <div className="alert ho-alert"><div className="alert-ico">✓</div><div><div className="alert-title">تم</div><div className="alert-body">{notice}</div></div></div> : null}
      {error ? <div className="alert ho-alert danger"><div className="alert-ico">!</div><div><div className="alert-title">تنبيه</div><div className="alert-body">{error}</div></div></div> : null}

      <div className="chips ho-tabs">
        {[
          ["hub", "قائمة القضية"],
          ["claim", "تقييد الدعوى"],
          ["enter", "دخول الجلسة"],
          ["record", "ضبط الجلسة"],
          ["pleading", "المرافعة"],
          ["evidence", "البينات"],
          ["settlement", "الصلح"],
          ["judgment", "الحكم"],
          ["appeal", "الاعتراض"],
          ["strength", "مقياس القوة"]
        ].map(([key, label]) => (
          <button key={key} type="button" className={`chip ${view === key ? "on" : ""}`} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>

      {view === "hub" ? (
        <>
          <OriginalCaseHub
            title={activeSession?.title || claim.title || "شركة مقاولات ضد مورد مواد بناء"}
            sessionId={activeSession?.id}
            claim={activeClaim}
            currentStage={activeSession?.stage ?? "CLAIM_FILING"}
            lastDecision={latestDecision?.decisionType}
            onNavigate={guardedNavigate}
          />
          <div className="card">
            <div className="card-title">جلسات محفوظة</div>
            <div className="cases-stack">
              {sessions.map((session) => (
                <button className="case-item" key={session.id} type="button" onClick={() => void refreshSession(session.id)}>
                  <span className="case-ico">ح</span>
                  <span className="case-meta"><span className="cid">{session.id}</span><span className="ctitle">{session.title}</span><span className="csub">{stageLabel(session.stage)}</span></span>
                  <span className="case-stage-lbl">{stageLabel(session.stage)}</span>
                  <span className="badge badge-active">نشطة</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {view === "claim" ? (
        <OriginalWizard steps={wizardSteps} currentStep={wizardStep} onStep={setWizardStep}>
          {wizardStep === 0 ? (
            <OriginalWizardStep title="بيانات الأطراف" subtitle="أدخل بيانات المدعي والمدعى عليه وصفة كل طرف.">
              <div className="field-row"><Field label="اسم المدعي" value={claim.plaintiffName} onChange={(value) => updateClaim("plaintiffName", value)} /><Field label="صفة المدعي" value={claim.plaintiffCapacity} onChange={(value) => updateClaim("plaintiffCapacity", value)} /></div>
              <div className="field-row"><Field label="اسم المدعى عليه" value={claim.defendantName} onChange={(value) => updateClaim("defendantName", value)} /><Field label="صفة المدعى عليه" value={claim.defendantCapacity} onChange={(value) => updateClaim("defendantCapacity", value)} /></div>
            </OriginalWizardStep>
          ) : null}
          {wizardStep === 1 ? (
            <OriginalWizardStep title="المطالبة" subtitle="حدد نوع الدعوى، قيمتها، وارتباطها بقضية محفوظة إن وجدت.">
              <div className="field-row"><Field label="عنوان الدعوى" value={claim.title} onChange={(value) => updateClaim("title", value)} /><Select label="نوع الدعوى" value={claim.caseType} onChange={(value) => updateClaim("caseType", value)} options={["تجارية", "مدنية", "عمالية", "أحوال شخصية", "تنفيذ", "أخرى"]} /></div>
              <div className="field-row"><Field label="مبلغ المطالبة" value={claim.claimAmount} onChange={(value) => updateClaim("claimAmount", value)} /><Select label="ربط بقضية محفوظة" value={selectedCaseId} onChange={setSelectedCaseId} options={["", ...cases.map((item) => item.id)]} labels={{ "": "دون ربط", ...Object.fromEntries(cases.map((item) => [item.id, item.title])) }} /></div>
              <TextArea label="موضوع الدعوى" value={claim.subject} onChange={(value) => updateClaim("subject", value)} />
            </OriginalWizardStep>
          ) : null}
          {wizardStep === 2 ? <OriginalWizardStep title="الوقائع" subtitle="اسرد الوقائع المؤثرة في النزاع بوضوح."><TextArea label="الوقائع" value={claim.facts} onChange={(value) => updateClaim("facts", value)} rows={7} /></OriginalWizardStep> : null}
          {wizardStep === 3 ? (
            <OriginalWizardStep title="الطلبات والدفوع" subtitle="حدد الطلبات والدفوع والأسانيد.">
              <TextArea label="الطلبات" value={claim.requests} onChange={(value) => updateClaim("requests", value)} />
              <TextArea label="الأسانيد النظامية أو التعاقدية" value={claim.legalGrounds} onChange={(value) => updateClaim("legalGrounds", value)} />
              <TextArea label="الدفوع المحتملة" value={claim.defenses} onChange={(value) => updateClaim("defenses", value)} />
            </OriginalWizardStep>
          ) : null}
          {wizardStep === 4 ? (
            <OriginalWizardStep title="المرفقات والمراجعة" subtitle="راجع الصحيفة وأضف المرفقات المرتبطة.">
              <OriginalUploadZone files={attachments} />
              <div className="decision-box ho-review">{admissibilityCheck(claim).message}</div>
            </OriginalWizardStep>
          ) : null}
          <div className="wizard-footer">
            <button className="btn btn-ghost" type="button" onClick={() => setWizardStep((step) => Math.max(0, step - 1))}>→ السابق</button>
            <span className="step-counter">الخطوة {(wizardStep + 1).toLocaleString("ar-SA")} من ٥</span>
            {wizardStep < 4 ? <button className="btn btn-gold" type="button" onClick={() => setWizardStep((step) => Math.min(4, step + 1))}>التالي ←</button> : <button className="btn btn-gold" type="button" onClick={() => void startOrSaveClaim()} disabled={busy === "claim"}>{busy === "claim" ? "جار الحفظ..." : "حفظ وتقييد الدعوى"}</button>}
          </div>
        </OriginalWizard>
      ) : null}

      {view === "enter" ? (
        <div className="wizard-body ho-entry-card">
          <h3>دخول الجلسة</h3>
          <p className="sub">أثبت الدور والصفة قبل توليد ضبط الجلسة.</p>
          <div className="choice-grid">
            {["القاضي الافتراضي", "المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه"].map((item) => (
              <button key={item} type="button" className={`choice-box ${entry.role === item ? "selected" : ""}`} onClick={() => setEntry((current) => ({ ...current, role: item }))}>{item}</button>
            ))}
          </div>
          <div className="field-row"><Field label="الصفة" value={entry.capacity} onChange={(value) => setEntry((current) => ({ ...current, capacity: value }))} /><Field label="رقم الهوية" value={entry.nationalId} onChange={(value) => setEntry((current) => ({ ...current, nationalId: value }))} /></div>
          <div className="field-row"><Field label="رقم الوكالة" value={entry.poa} onChange={(value) => setEntry((current) => ({ ...current, poa: value }))} /><button className="btn btn-gold ho-field-button" type="button" onClick={() => void enterHearing()}>دخول الجلسة</button></div>
        </div>
      ) : null}

      {view === "record" ? (
        <div className="verdict-wrap">
          <OriginalHearingRecord claim={activeClaim} sessionId={activeSession?.id} content={hearingRecord?.content} />
          <div className="hero-cta">
            <button className="btn btn-gold" type="button" onClick={() => void createHearingRecord()} disabled={!activeSession || busy === "record"}>توليد ضبط الجلسة وفتح المرافعة</button>
            {activeSession ? <a className="btn btn-outline" href={`/api/simulations/${activeSession.id}/export?type=hearing-record&format=docx`}>تصدير DOCX</a> : null}
            {activeSession ? <a className="btn btn-outline" href={`/api/simulations/${activeSession.id}/export?type=hearing-record&format=pdf`}>تصدير PDF</a> : null}
          </div>
        </div>
      ) : null}

      {view === "pleading" ? (
        <OriginalHearingTranscript
          side={
            <>
              <div className="side-card"><div className="side-card-title">الدور التالي</div><div className="decision-box">{judgeState.nextAction}</div></div>
              <div className="side-card"><div className="side-card-title">الدور المسموح بالكلام</div><div className="decision-box">{turnState ? allowedSpeakerLabel(turnState.allowedSpeakerRole) : "لم يحدد بعد"}</div></div>
              <div className="side-card"><div className="side-card-title">الأزرار المتاحة</div><div className="chips">{judgeState.availableActions.map((action) => <span className="chip on" key={action}>{action}</span>)}</div></div>
              <div className="side-card"><button className="btn btn-gold" type="button" onClick={() => void closePleading()} disabled={!judgeState.canClose && visibleMessages.length < 4}>قفل باب المرافعة</button></div>
            </>
          }
        >
          <div className="hearing-chat-header"><div><div className="hch-title">محضر المرافعة التفاعلي</div><div className="hch-meta">{activeSession?.id || "جلسة غير مقيدة"}</div></div><div className="session-badge"><span className="live-dot" /> مباشر</div></div>
          <div className="hearing-messages">
            {visibleMessages.length ? visibleMessages.map((item) => item.role.includes("قاضي") && item.content.includes("قررت") ? <OriginalProceduralDecision key={item.id} title="قرار القاضي" content={item.content} /> : <OriginalJudgeMessage key={item.id} {...item} />) : <OriginalJudgeMessage role="القاضي الافتراضي" content="تفتتح الجلسة بعد ضبطها، ويطلب من المدعي عرض دعواه ثم يمكّن المدعى عليه من الجواب." />}
          </div>
          <div className="hearing-input-area">
            <div className="defense-type-row">
              <select className="fselect" value={messageRole} onChange={(event) => setMessageRole(event.target.value)} disabled={closed || busy === "message" || busy === "judge"}>
                {["المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه"].map((item) => <option key={item}>{item}</option>)}
              </select>
              <textarea className="hearing-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={inputLocked ? turnNotice : "اكتب المداخلة في محضر الجلسة..."} disabled={inputLocked} />
              <button className="send-btn" type="button" onClick={() => void sendPleading()} disabled={inputLocked}>←</button>
            </div>
            {inputLocked ? <div className="decision-box" style={{ marginTop: 10 }}>{turnNotice}</div> : null}
          </div>
        </OriginalHearingTranscript>
      ) : null}

      {view === "evidence" ? <OriginalUploadZone files={attachments} /> : null}

      {view === "settlement" ? (
        <div className="wizard-body">
          <h3>فحص التسوية الودية</h3>
          <p className="sub">مرحلة الصلح جزء من مسار الجلسة وليست زرًا منفصلًا.</p>
          <div className="field-row"><Field label="مبلغ التسوية" value={settlement.amount} onChange={(value) => setSettlement((current) => ({ ...current, amount: value }))} /><Field label="مدة التنفيذ" value={settlement.duration} onChange={(value) => setSettlement((current) => ({ ...current, duration: value }))} /></div>
          <TextArea label="الالتزامات" value={settlement.obligations} onChange={(value) => setSettlement((current) => ({ ...current, obligations: value }))} />
          <TextArea label="شرط التنازل أو إنهاء النزاع" value={settlement.waiver} onChange={(value) => setSettlement((current) => ({ ...current, waiver: value }))} />
          <button className="btn btn-gold" type="button" onClick={() => void post("settlement", settlement, "settlement")}>تقييم مقترحات التسوية</button>
        </div>
      ) : null}

      {view === "judgment" ? (
        <div className="verdict-wrap">
          <OriginalVerdictDocument claim={activeClaim} content={latestJudgment?.content} disclaimer={latestJudgment?.disclaimer} />
          <div className="hero-cta">
            <button className="btn btn-gold" type="button" onClick={() => void createJudgment()} disabled={!closed || busy === "judgment"}>إصدار مسودة حكم قضائي مسبب</button>
            {activeSession ? <a className="btn btn-outline" href={`/api/simulations/${activeSession.id}/export?type=judgment&format=docx`}>تصدير DOCX</a> : null}
            {activeSession ? <a className="btn btn-outline" href={`/api/simulations/${activeSession.id}/export?type=judgment&format=pdf`}>تصدير PDF</a> : null}
            {activeSession ? <a className="btn btn-outline" href={`/api/simulations/${activeSession.id}/export?type=full-report&format=docx`}>تقرير الجلسة كاملًا</a> : null}
          </div>
        </div>
      ) : null}

      {view === "appeal" ? hasJudgment ? <OriginalAppealCards selected={appealKind} onSelect={setAppealKind} /> : <div className="decision-box">لا اعتراض قبل صدور مسودة حكم قضائي مسبب.</div> : null}

      {view === "appeal" ? <PostJudgmentRemediesPanel sessionId={activeSession?.id} hasJudgment={hasJudgment} compact /> : null}

      {view === "strength" ? <OriginalStrengthMeter score={strength.score} notes={strength.notes} /> : null}

      <div className="card ho-audit-card">
        <div className="card-title">أثر العمليات</div>
        <OriginalAuditRows rows={[
          { action: "المرحلة", detail: stageLabel(activeSession?.stage ?? "CLAIM_FILING") },
          { action: "القاضي", detail: judgeState.nextAction },
          { action: "القفل", detail: closed ? "تم قفل باب المرافعة" : "لم يقفل بعد" }
        ]} />
      </div>
    </div>
  );

  function guardedNavigate(nextView: string) {
    if (nextView === "pleading" && !hasRecord) return setError("لا مرافعة قبل ضبط الجلسة.");
    if (nextView === "record" && !activeSession) return setError("لا ضبط جلسة قبل دخول الجلسة وتقييد الدعوى.");
    if (nextView === "judgment" && !closed) setNotice("يمكن عرض نموذج المسودة، لكن الإصدار الفعلي لا يتم إلا بعد قفل باب المرافعة.");
    if (nextView === "appeal" && !hasJudgment) return setError("لا اعتراض قبل صدور مسودة حكم.");
    setView(nextView);
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="field"><label className="flabel">{label}</label><input className="finput" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function TextArea({ label, value, onChange, rows = 5 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <div className="field"><label className="flabel">{label}</label><textarea className="ftextarea" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <div className="field"><label className="flabel">{label}</label><select className="fselect" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}</select></div>;
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

function localStrength(claim: ClaimForm, attachmentsCount: number) {
  const checks = [
    [Boolean(claim.facts && claim.facts.length > 30), "وضوح الوقائع"],
    [Boolean(claim.requests && claim.requests.length > 10), "تحديد الطلبات"],
    [attachmentsCount > 0, "وجود بينة أو مرفق"],
    [Boolean(claim.legalGrounds), "وجود سند نظامي"],
    [Boolean(claim.defenses), "اتساق الدفوع"],
    [Boolean(claim.plaintiffName && claim.defendantName), "اكتمال بيانات الأطراف"]
  ] as const;
  return {
    score: Math.round((checks.filter(([passed]) => passed).length / checks.length) * 100),
    notes: checks.map(([passed, label]) => `${passed ? "مكتمل" : "ناقص"}: ${label}`)
  };
}

function localDetermineNextTurn(session: SimulationSession, claim: ClaimForm, attachmentsCount: number) {
  const partyMessages = session.messages.filter((message) => ["المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه"].includes(message.role));
  const hasPlaintiff = partyMessages.some((message) => message.role.includes("المدعي") && !message.role.includes("المدعى عليه"));
  const hasDefendant = partyMessages.some((message) => message.role.includes("المدعى عليه"));
  const closed = isPleadingClosed(session.decisions);
  const canClose = hasPlaintiff && hasDefendant && partyMessages.length >= 3;
  return {
    currentRole: hasPlaintiff ? "المدعى عليه" : "المدعي",
    nextRole: closed ? "القاضي الافتراضي" : hasPlaintiff ? "المدعى عليه" : "المدعي",
    nextAction: closed ? "إصدار مسودة حكم قضائي مسبب" : hasPlaintiff ? "تمكين المدعى عليه من الجواب" : "تمكين المدعي من تحرير دعواه",
    needsDocument: attachmentsCount === 0,
    canSettle: hasPlaintiff && hasDefendant,
    canClose,
    canJudge: closed,
    availableActions: closed ? ["إصدار مسودة الحكم", "تصدير التقرير"] : canClose ? ["قفل باب المرافعة", "عرض الصلح", "طلب إيضاح"] : ["طلب مستند", "إدخال مداخلة", claim.subject ? "متابعة" : "استكمال البيانات"]
  };
}

function successMessage(endpoint: string) {
  if (endpoint === "messages") return "أضيفت المداخلة إلى محضر الجلسة.";
  if (endpoint === "judge-turn") return "أصدر القاضي حكيم قراره الإجرائي التالي.";
  if (endpoint === "hearing-record") return "تم توليد ضبط الجلسة.";
  if (endpoint === "judgment") return "تم إصدار مسودة حكم قضائي مسبب.";
  if (endpoint === "settlement") return "تم إنشاء مسودة الصلح.";
  return "تم تنفيذ العملية.";
}
