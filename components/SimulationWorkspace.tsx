"use client";

import { useMemo, useState } from "react";
import { judicialSimulationStages, stageLabel } from "@/lib/modules/simulations/simulation-labels";

type SimulationMessage = {
  id: string;
  role: string;
  stage: string;
  content: string;
  createdAt: string;
};

type SimulationDecision = {
  id: string;
  decisionType: string;
  content: string;
  stage: string;
  createdAt: string;
};

type SimulationJudgment = {
  id: string;
  content: string;
  disclaimer: string;
  createdAt: string;
};

type SimulationSession = {
  id: string;
  title: string;
  stage: string;
  createdAt: string;
  messages: SimulationMessage[];
  decisions: SimulationDecision[];
  judgments: SimulationJudgment[];
};

type CaseOption = {
  id: string;
  title: string;
};

const roles = ["القاضي الافتراضي", "المدعي", "المدعى عليه", "النظام"];
const decisionTypes = ["فتح باب المرافعة", "تمكين المدعي من الرد", "تمكين المدعى عليه من الجواب", "طلب مستند", "قفل باب المرافعة"];

export function SimulationWorkspace({
  initialSessions,
  cases
}: {
  initialSessions: SimulationSession[];
  cases: CaseOption[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSession, setActiveSession] = useState<SimulationSession | null>(initialSessions[0] ?? null);
  const [title, setTitle] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [role, setRole] = useState(roles[1]);
  const [message, setMessage] = useState("");
  const [decisionType, setDecisionType] = useState(decisionTypes[0]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId), [cases, selectedCaseId]);

  async function refreshSession(sessionId: string) {
    const response = await fetch(`/api/simulations/${sessionId}/messages`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? "تعذر تحميل جلسة المحاكاة.");
    setActiveSession(payload.session as SimulationSession);
    setSessions((current) => current.map((item) => (item.id === sessionId ? (payload.session as SimulationSession) : item)));
  }

  async function startSession() {
    setBusy("start");
    setError("");
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          title,
          caseTitle: selectedCase?.title
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر إنشاء جلسة المحاكاة.");
      await refreshSession(payload.sessionId);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء جلسة المحاكاة.");
    } finally {
      setBusy("");
    }
  }

  async function sendMessage() {
    if (!activeSession) return;
    setBusy("message");
    setError("");
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ role, content: message })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر حفظ الرسالة.");
      setMessage("");
      await refreshSession(activeSession.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الرسالة.");
    } finally {
      setBusy("");
    }
  }

  async function issueDecision() {
    if (!activeSession) return;
    setBusy("decision");
    setError("");
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ decisionType })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر إصدار القرار الإجرائي.");
      await refreshSession(activeSession.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إصدار القرار الإجرائي.");
    } finally {
      setBusy("");
    }
  }

  async function issueJudgment() {
    if (!activeSession) return;
    setBusy("judgment");
    setError("");
    try {
      const response = await fetch(`/api/simulations/${activeSession.id}/judgment`, {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر إصدار الحكم التدريبي.");
      await refreshSession(activeSession.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إصدار الحكم التدريبي.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-black/10 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="text-sm font-semibold text-olive">موضوع المحاكاة</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
              placeholder="مثال: مطالبة توريد مواد بناء"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-olive">بدء من قضية موجودة</span>
            <select
              value={selectedCaseId}
              onChange={(event) => setSelectedCaseId(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-black/10 px-4 py-3"
            >
              <option value="">بدون قضية مرتبطة</option>
              {cases.map((caseItem) => (
                <option key={caseItem.id} value={caseItem.id}>
                  {caseItem.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void startSession()}
            disabled={busy === "start"}
            className="focus-ring self-end rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "start" ? "جار بدء الجلسة..." : "بدء جلسة محاكاة قضائية"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-6 text-gray-500">
          TODO: ربط الجلسة بمعرف القضية مباشرة يتطلب إضافة caseId إلى جدول simulation_sessions في مرحلة لاحقة. حاليًا يتم استخدام عنوان القضية فقط دون تعديل schema.
        </p>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : null}

      {activeSession ? (
        <>
          <section className="rounded-md border border-black/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gold">رقم الجلسة: {activeSession.id}</p>
                <h2 className="mt-2 text-2xl font-bold text-olive">{activeSession.title}</h2>
                <p className="mt-2 text-gray-700">المرحلة الحالية: {stageLabel(activeSession.stage)}</p>
              </div>
              <p className="rounded-md bg-sand px-4 py-2 text-sm text-gray-700">محاكاة تدريبية غير ملزمة</p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {judicialSimulationStages.map((stage, index) => {
                const active = stage.key === activeSession.stage;
                return (
                  <div key={stage.key} className={`rounded-md border p-3 ${active ? "border-gold bg-sand" : "border-black/10 bg-white"}`}>
                    <p className="text-xs text-gold">المرحلة {index + 1}</p>
                    <p className="mt-1 font-semibold text-olive">{stage.label}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-black/10 bg-white p-5">
              <h3 className="text-xl font-bold text-olive">سجل الرسائل</h3>
              <div className="mt-4 space-y-3">
                {activeSession.messages.length === 0 ? (
                  <p className="rounded-md bg-sand p-4 text-gray-700">لا توجد رسائل في هذه الجلسة حتى الآن.</p>
                ) : (
                  activeSession.messages.map((item) => (
                    <article key={item.id} className="rounded-md border border-black/10 p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-semibold text-olive">{item.role}</p>
                        <p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString("ar-SA")}</p>
                      </div>
                      <p className="mt-1 text-xs text-gold">{stageLabel(item.stage)}</p>
                      <p className="mt-2 leading-8 text-gray-700">{item.content}</p>
                    </article>
                  ))
                )}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="focus-ring rounded-md border border-black/10 px-4 py-3"
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="focus-ring rounded-md border border-black/10 px-4 py-3"
                  placeholder="اكتب رسالة المحاكاة..."
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={busy === "message" || message.trim().length < 2}
                  className="focus-ring rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "message" ? "جار الحفظ..." : "إضافة رسالة"}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-md border border-black/10 bg-white p-5">
                <h3 className="text-xl font-bold text-olive">الإجراءات القضائية</h3>
                <select
                  value={decisionType}
                  onChange={(event) => setDecisionType(event.target.value)}
                  className="focus-ring mt-4 w-full rounded-md border border-black/10 px-4 py-3"
                >
                  {decisionTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void issueDecision()}
                    disabled={busy === "decision"}
                    className="focus-ring rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === "decision" ? "جار الإصدار..." : "إصدار قرار إجرائي"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void issueJudgment()}
                    disabled={busy === "judgment"}
                    className="focus-ring rounded-md border border-olive px-5 py-3 text-olive disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === "judgment" ? "جار الإصدار..." : "إصدار حكم تدريبي"}
                  </button>
                </div>
              </section>

              <section className="rounded-md border border-black/10 bg-white p-5">
                <h3 className="text-xl font-bold text-olive">القرارات</h3>
                {activeSession.decisions.length === 0 ? (
                  <p className="mt-3 text-gray-700">لم تصدر قرارات إجرائية بعد.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {activeSession.decisions.map((decision) => (
                      <article key={decision.id} className="rounded-md bg-sand p-4">
                        <p className="font-semibold text-olive">{decision.decisionType}</p>
                        <p className="mt-2 leading-7 text-gray-700">{decision.content}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-md border border-black/10 bg-white p-5">
                <h3 className="text-xl font-bold text-olive">الحكم التدريبي</h3>
                {activeSession.judgments.length === 0 ? (
                  <p className="mt-3 text-gray-700">لم يصدر حكم تدريبي بعد.</p>
                ) : (
                  activeSession.judgments.map((judgment) => (
                    <article key={judgment.id} className="mt-3 rounded-md border border-gold bg-sand p-4">
                      <p className="font-bold text-olive">{judgment.disclaimer}</p>
                      <pre className="mt-3 whitespace-pre-wrap leading-8 text-gray-700">{judgment.content}</pre>
                    </article>
                  ))
                )}
              </section>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-md bg-white p-5 text-gray-700">ابدأ جلسة محاكاة قضائية لعرض سجلها وإجراءاتها.</p>
      )}
    </div>
  );
}
