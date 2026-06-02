"use client";

import { useMemo, useState } from "react";
import { ClaimSheetCard, GoldButton, HearingMessage, HearingRecordDocument, JudgmentDocument, LegalBadge, LegalCard, NavyButton, StageTracker, StrengthScoreCard } from "@/components/ui/legal";
import { admissibilityCheck, claimMarker, scoreMarker } from "@/lib/modules/simulations/hakeem-judge";
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

const roles = ["القاضي الافتراضي", "المدعي", "المدعى عليه", "وكيل المدعي", "وكيل المدعى عليه", "النظام"];
const caseTypes = ["تجارية", "مدنية", "عمالية", "أحوال شخصية", "تنفيذ", "أخرى"];
const decisionTypes = [
  "فتح باب المرافعة",
  "تمكين المدعي من عرض الدعوى",
  "تمكين المدعى عليه من الجواب",
  "تمكين المدعي من الرد",
  "طلب مستند",
  "طلب إيضاح",
  "طلب تحديد الطلبات",
  "إثبات تقديم مرفق",
  "عرض الصلح",
  "قفل باب المرافعة",
  "حجز القضية للحكم",
  "إصدار الحكم التدريبي"
];
const appealReasons: Record<string, string[]> = {
  استئناف: ["خطأ في التكييف", "قصور في التسبيب", "مخالفة الثابت بالأوراق", "خطأ في تطبيق النظام"],
  نقض: ["مخالفة أحكام الشريعة أو الأنظمة", "صدور الحكم من محكمة غير مختصة", "الخطأ في تكييف الواقعة", "مخالفة قواعد الاختصاص أو الإجراءات الجوهرية"],
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
  const [role, setRole] = useState(roles[1]);
  const [message, setMessage] = useState("");
  const [decisionType, setDecisionType] = useState(decisionTypes[0]);
  const [settlement, setSettlement] = useState({ amount: "", obligations: "", duration: "", waiver: "" });
  const [appealKind, setAppealKind] = useState("استئناف");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId), [cases, selectedCaseId]);
  const activeClaim = extractClaim(activeSession) ?? claim;
  const admissibility = admissibilityCheck(activeClaim);
  const hearingRecord = lastMatching(activeSession?.decisions, (item) => item.decisionType === "ضبط جلسة تدريبي");
  const strength = extractStrength(activeSession);
  const cleanMessages = activeSession?.messages.filter((item) => !item.content.startsWith(claimMarker) && !item.content.startsWith(scoreMarker)) ?? [];
  const proceduralDecisions = activeSession?.decisions.filter((item) => item.decisionType !== "ضبط جلسة تدريبي") ?? [];

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
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...claim, caseTitle: selectedCase?.title })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر بدء المحاكاة.");
      await refreshSession(payload.sessionId);
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
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(claim)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تقييد الدعوى.");
      await refreshSession(activeSession.id);
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
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}/${endpoint}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر تنفيذ العملية.");
      await refreshSession(activeSession.id);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy("");
    }
  }

  function updateClaim(key: string, value: string) {
    setClaim((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="legal-luxury-surface -mx-2 rounded-xl p-3 md:p-5">
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <LegalCard title="جلسات القاضي حكيم" eyebrow="السجل">
          <GoldButton type="button" onClick={() => setActiveSession(null)} className="w-full">
            بدء محاكاة جديدة
          </GoldButton>
          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? <p className="text-sm text-gray-600">لا توجد جلسات سابقة.</p> : null}
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => void refreshSession(session.id)}
                className={`w-full rounded-md border p-3 text-right ${activeSession?.id === session.id ? "border-[#C09B5A] bg-[#E8D5A8]/35" : "border-black/10 bg-white"}`}
              >
                <span className="block font-display-ar font-bold text-[#0B1F3A]">{session.title}</span>
                <span className="font-mono-legal mt-1 block text-xs text-gray-500">{session.id}</span>
                <span className="mt-2 block text-xs text-[#C09B5A]">{stageLabel(session.stage)}</span>
              </button>
            ))}
          </div>
        </LegalCard>

        <div className="space-y-6">
          <LegalCard eyebrow="القاضي حكيم" title="محكمة افتراضية تدريبية">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-judicial text-4xl font-bold text-[#0B1F3A]">{activeSession?.title || "تقييد دعوى تدريبية"}</h1>
                <p className="font-mono-legal mt-2 text-sm text-gray-500">{activeSession?.id ? `رقم الجلسة: ${activeSession.id}` : "جلسة جديدة غير مقيدة بعد"}</p>
              </div>
              <div className="flex gap-2">
                <LegalBadge status="تدريبية" />
                <LegalBadge status={activeSession?.stage === "TRAINING_JUDGMENT" ? "صدر الحكم" : "قيد المرافعة"} />
              </div>
            </div>
            <div className="mt-5">
              <StageTracker currentStage={visualStage(activeSession)} />
            </div>
          </LegalCard>

          {error ? <p className="rounded-md border border-[#8C2233]/25 bg-[#8C2233]/10 p-4 text-[#8C2233]">{error}</p> : null}

          <LegalCard title="تقييد دعوى تدريبية" eyebrow="صحيفة افتتاحية">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="عنوان الدعوى" value={claim.title} onChange={(value) => updateClaim("title", value)} />
              <Select label="نوع الدعوى" value={claim.caseType} onChange={(value) => updateClaim("caseType", value)} options={caseTypes} />
              <label>
                <span className="text-sm font-semibold text-[#0B1F3A]">بدء من قضية موجودة</span>
                <select value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3">
                  <option value="">بدون ربط</option>
                  {cases.map((caseItem) => (
                    <option key={caseItem.id} value={caseItem.id}>
                      {caseItem.title}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="اسم المدعي" value={claim.plaintiffName} onChange={(value) => updateClaim("plaintiffName", value)} />
              <Field label="صفة المدعي" value={claim.plaintiffCapacity} onChange={(value) => updateClaim("plaintiffCapacity", value)} />
              <Field label="اسم المدعى عليه" value={claim.defendantName} onChange={(value) => updateClaim("defendantName", value)} />
              <Field label="صفة المدعى عليه" value={claim.defendantCapacity} onChange={(value) => updateClaim("defendantCapacity", value)} />
              <Field label="مبلغ المطالبة" value={claim.claimAmount} onChange={(value) => updateClaim("claimAmount", value)} />
              <Field label="بيانات الحضور والوكالة" value={claim.attendance} onChange={(value) => updateClaim("attendance", value)} />
            </div>
            <TextArea label="موضوع الدعوى" value={claim.subject} onChange={(value) => updateClaim("subject", value)} />
            <TextArea label="الوقائع" value={claim.facts} onChange={(value) => updateClaim("facts", value)} />
            <TextArea label="الطلبات" value={claim.requests} onChange={(value) => updateClaim("requests", value)} />
            <TextArea label="أسانيد المدعي" value={claim.legalGrounds} onChange={(value) => updateClaim("legalGrounds", value)} />
            <TextArea label="دفوع المدعى عليه إن وجدت" value={claim.defenses} onChange={(value) => updateClaim("defenses", value)} />
            {!admissibility.complete ? <p className="mt-4 rounded-md bg-[#B8721A]/10 p-4 text-[#B8721A]">{admissibility.message} الناقص: {admissibility.missing.join("، ")}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <GoldButton type="button" onClick={() => void saveClaim()} disabled={busy === "claim" || busy === "start"}>
                {activeSession ? "حفظ تقييد الدعوى" : "بدء جلسة القاضي حكيم"}
              </GoldButton>
              <NavyButton type="button" onClick={() => void post("hearing-record", undefined, "hearing")} disabled={!activeSession || !admissibility.complete || busy === "hearing"}>
                توليد ضبط الجلسة
              </NavyButton>
            </div>
          </LegalCard>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <LegalCard title="صحيفة الدعوى" eyebrow="وثيقة متاحة طوال الجلسة">
              <ClaimSheetCard claim={activeClaim} />
            </LegalCard>
            <LegalCard title="مقياس قوة الدعوى" eyebrow="تدريبي تقديري">
              <StrengthScoreCard score={strength?.score} notes={strength?.notes} />
              <GoldButton type="button" onClick={() => void post("strength-score", undefined, "score")} disabled={!activeSession || busy === "score"} className="mt-4">
                حساب المقياس
              </GoldButton>
            </LegalCard>
          </div>

          {hearingRecord ? (
            <LegalCard title="ضبط الجلسة" eyebrow="محضر تدريبي">
              <HearingRecordDocument content={hearingRecord.content} />
            </LegalCard>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <LegalCard title="المرافعة التفاعلية" eyebrow="سجل الجلسة">
              <div className="space-y-3">
                {cleanMessages.length === 0 ? <p className="rounded-md bg-[#F2EADB] p-4 text-gray-700">لا توجد مرافعات ظاهرة حتى الآن.</p> : null}
                {cleanMessages.map((item) => (
                  <HearingMessage key={item.id} role={item.role} content={item.content} stage={item.stage} createdAt={item.createdAt} />
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <select value={role} onChange={(event) => setRole(event.target.value)} className="focus-ring rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3">
                  {roles.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <input value={message} onChange={(event) => setMessage(event.target.value)} className="focus-ring rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3" placeholder="اكتب مداخلة الجلسة..." />
                <NavyButton type="button" onClick={() => void post("messages", { role, content: message }, "message")} disabled={!activeSession || message.trim().length < 2 || busy === "message"}>
                  إضافة
                </NavyButton>
              </div>
            </LegalCard>

            <div className="space-y-6">
              <LegalCard title="قرارات القاضي" eyebrow="إجراءات">
                <select value={decisionType} onChange={(event) => setDecisionType(event.target.value)} className="focus-ring w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3">
                  {decisionTypes.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <GoldButton type="button" onClick={() => void post("decisions", { decisionType }, "decision")} disabled={!activeSession || busy === "decision"} className="mt-3 w-full">
                  إصدار قرار إجرائي
                </GoldButton>
                <NavyButton type="button" onClick={() => void post("judgment", undefined, "judgment")} disabled={!activeSession || busy === "judgment"} className="mt-3 w-full">
                  إصدار حكم تدريبي
                </NavyButton>
              </LegalCard>

              <LegalCard title="المرفقات والبينات" eyebrow="Metadata">
                {attachments.length === 0 ? <p className="text-sm text-gray-700">لا توجد مرفقات مسجلة حتى الآن.</p> : null}
                <div className="space-y-2">
                  {attachments.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-md bg-white p-3 text-sm">
                      <p className="font-semibold text-[#0B1F3A]">{item.fileName}</p>
                      <p className="text-xs text-gray-500">{item.mimeType} · {new Date(item.createdAt).toLocaleString("ar-SA")}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-gray-500">TODO: سيتم لاحقًا ربط المرفقات باستخراج النص وتحليلها بالذكاء الاصطناعي.</p>
              </LegalCard>
            </div>
          </section>

          <LegalCard title="القرارات والصلح" eyebrow="سجل إجراءات الجلسة">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                {proceduralDecisions.length === 0 ? <p className="rounded-md bg-[#F2EADB] p-4 text-gray-700">لم تصدر قرارات بعد.</p> : null}
                {proceduralDecisions.map((decision) => (
                  <article key={decision.id} className="rounded-md border border-[#C09B5A]/20 bg-white p-4">
                    <p className="font-display-ar font-bold text-[#0B1F3A]">{decision.decisionType}</p>
                    <pre className="mt-2 whitespace-pre-wrap leading-8 text-gray-700">{decision.content}</pre>
                  </article>
                ))}
              </div>
              <div>
                <h3 className="font-display-ar font-bold text-[#0B1F3A]">عرض الصلح</h3>
                <Field label="مبلغ التسوية" value={settlement.amount} onChange={(value) => setSettlement((current) => ({ ...current, amount: value }))} />
                <TextArea label="الالتزامات" value={settlement.obligations} onChange={(value) => setSettlement((current) => ({ ...current, obligations: value }))} />
                <Field label="مدة التنفيذ" value={settlement.duration} onChange={(value) => setSettlement((current) => ({ ...current, duration: value }))} />
                <TextArea label="شرط التنازل أو إنهاء النزاع" value={settlement.waiver} onChange={(value) => setSettlement((current) => ({ ...current, waiver: value }))} />
                <GoldButton type="button" onClick={() => void post("settlement", settlement, "settlement")} disabled={!activeSession || busy === "settlement"} className="mt-3">
                  توليد مسودة صلح
                </GoldButton>
              </div>
            </div>
          </LegalCard>

          <LegalCard title="الحكم التدريبي وما بعد الحكم" eyebrow="وثيقة وطرق اعتراض تدريبية">
            {activeSession?.judgments.length ? (
              activeSession.judgments.map((judgment) => <JudgmentDocument key={judgment.id} content={judgment.content} disclaimer={judgment.disclaimer} />)
            ) : (
              <p className="rounded-md bg-[#F2EADB] p-4 text-gray-700">لم يصدر حكم تدريبي بعد.</p>
            )}
            <div className="mt-5 rounded-md border border-[#C09B5A]/20 bg-white p-4">
              <h3 className="font-display-ar font-bold text-[#0B1F3A]">ما بعد الحكم</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <select value={appealKind} onChange={(event) => { setAppealKind(event.target.value); setSelectedReasons([]); }} className="focus-ring rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3">
                  {Object.keys(appealReasons).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  {appealReasons[appealKind].map((reason) => (
                    <button
                      type="button"
                      key={reason}
                      onClick={() => setSelectedReasons((current) => (current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]))}
                      className={`rounded-full border px-3 py-2 text-xs ${selectedReasons.includes(reason) ? "border-[#C09B5A] bg-[#E8D5A8]" : "border-black/10 bg-white"}`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <NavyButton type="button" onClick={() => void post("appeal", { kind: appealKind, reasons: selectedReasons }, "appeal")} disabled={!activeSession || busy === "appeal"}>
                  إنشاء الطلب
                </NavyButton>
              </div>
            </div>
          </LegalCard>
        </div>
      </div>
    </div>
  );
}

function extractClaim(session?: SimulationSession | null): ClaimForm | undefined {
  const source = lastMatching(session?.messages, (item) => item.content.startsWith(claimMarker));
  if (!source) return undefined;
  try {
    return JSON.parse(source.content.slice(claimMarker.length)) as ClaimForm;
  } catch {
    return undefined;
  }
}

function extractStrength(session?: SimulationSession | null): { score: number; notes: string[] } | undefined {
  const source = lastMatching(session?.messages, (item) => item.content.startsWith(scoreMarker));
  if (!source) return undefined;
  try {
    return JSON.parse(source.content.slice(scoreMarker.length)) as { score: number; notes: string[] };
  } catch {
    return undefined;
  }
}

function visualStage(session?: SimulationSession | null) {
  if (!session) return "CLAIM_FILING";
  if (session.judgments.length) return "TRAINING_JUDGMENT";
  if (session.decisions.some((item) => item.decisionType === "مسودة صلح تدريبية")) return "SETTLEMENT";
  if (session.decisions.some((item) => item.decisionType === "ضبط جلسة تدريبي")) return "HEARING_RECORD";
  return session.stage;
}

function lastMatching<T>(items: T[] | undefined, predicate: (item: T) => boolean) {
  if (!items) return undefined;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return items[index];
  }
  return undefined;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block">
      <span className="text-sm font-semibold text-[#0B1F3A]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block">
      <span className="text-sm font-semibold text-[#0B1F3A]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 min-h-24 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3 leading-8" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="mt-3 block">
      <span className="text-sm font-semibold text-[#0B1F3A]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-2 w-full rounded-md border border-[#C09B5A]/25 bg-white px-4 py-3">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
