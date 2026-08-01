"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ClientFinding = {
  id: string;
  category: string;
  severity: string;
  description: string;
  evidenceCount: number;
  ruleId: string | null;
};
export type ClientSuggestion = {
  id: string;
  title: string;
  body: string;
  status: string;
  decisionNote: string | null;
};

const SEVERITY_LABEL: Record<string, string> = {
  INFO: "معلومة", LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", CRITICAL: "حرجة",
};
const STATUS_LABEL: Record<string, string> = {
  SUGGESTED: "مقترح", ACCEPTED: "مقبول", REJECTED: "مرفوض", DEFERRED: "مؤجَّل",
};
const STATUS_STYLE: Record<string, string> = {
  SUGGESTED: "bg-[rgba(14,52,53,0.1)] text-[#0E3435]",
  ACCEPTED: "bg-[#0E3435] text-[#FFFcf7]",
  REJECTED: "bg-[#B45309] text-white",
  DEFERRED: "bg-[#F59E0B] text-white",
};

export function ReviewSessionClient({
  sessionId,
  findings,
  suggestions,
}: {
  sessionId: string;
  findings: ClientFinding[];
  suggestions: ClientSuggestion[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // نموذج ملاحظة
  const [desc, setDesc] = useState("");
  const [evidence, setEvidence] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");

  // نموذج اقتراح
  const [sTitle, setSTitle] = useState("");
  const [sBody, setSBody] = useState("");

  async function call(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "تعذّرت العملية.");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addFinding(e: React.FormEvent) {
    e.preventDefault();
    const ev = evidence.split("\n").map((l) => l.trim()).filter(Boolean);
    if (ev.length === 0) {
      setError("Evidence-First (§13): أضف سطر دليل واحدًا على الأقل.");
      return;
    }
    const ok = await call("/api/review/findings", {
      sessionId, description: desc, severity, evidence: ev, category: "عامّ",
    });
    if (ok) { setDesc(""); setEvidence(""); }
  }

  async function addSuggestion(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call("/api/review/findings", {
      kind: "suggestion", sessionId, title: sTitle, body: sBody,
    });
    if (ok) { setSTitle(""); setSBody(""); }
  }

  async function decide(id: string, decision: string) {
    await call(`/api/review/suggestions/${id}/decision`, { decision });
  }

  return (
    <div className="space-y-6" dir="rtl">
      {error ? <p className="rounded-md bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">{error}</p> : null}

      {/* الملاحظات */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-[#0E3435]">الملاحظات ({findings.length})</h2>
        <ul className="mb-3 space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="rounded-lg border border-[rgba(14,52,53,0.1)] bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0E3435]">{f.category}</span>
                <span className="rounded-full bg-[rgba(14,52,53,0.08)] px-2 py-0.5 text-xs">
                  {SEVERITY_LABEL[f.severity] ?? f.severity}
                </span>
              </div>
              <p className="mt-1 text-sm text-[rgba(14,52,53,0.85)]">{f.description}</p>
              <p className="mt-1 text-xs text-[rgba(14,52,53,0.5)]">أدلّة: {f.evidenceCount}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={addFinding} className="rounded-lg border border-dashed border-[rgba(14,52,53,0.2)] p-3">
          <textarea
            value={desc} onChange={(e) => setDesc(e.target.value)} required
            placeholder="وصف الملاحظة" rows={2}
            className="mb-2 w-full rounded-md border border-[rgba(14,52,53,0.18)] px-3 py-2 text-sm"
          />
          <textarea
            value={evidence} onChange={(e) => setEvidence(e.target.value)}
            placeholder="الأدلّة — سطرٌ لكلّ دليل (إلزاميّ §13)" rows={2}
            className="mb-2 w-full rounded-md border border-[rgba(14,52,53,0.18)] px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="rounded-md border border-[rgba(14,52,53,0.18)] px-2 py-1.5 text-sm">
              {Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="submit" disabled={busy}
              className="rounded-md bg-[#0E3435] px-3 py-1.5 text-sm font-semibold text-[#FFFcf7] disabled:opacity-50">
              إضافة ملاحظة
            </button>
          </div>
        </form>
      </section>

      {/* الاقتراحات */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-[#0E3435]">الاقتراحات ({suggestions.length})</h2>
        <ul className="mb-3 space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-lg border border-[rgba(14,52,53,0.1)] bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0E3435]">{s.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[s.status] ?? ""}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[rgba(14,52,53,0.85)]">{s.body}</p>
              {s.status === "SUGGESTED" ? (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => decide(s.id, "ACCEPTED")} disabled={busy}
                    className="rounded-md bg-[#0E3435] px-3 py-1 text-xs font-semibold text-[#FFFcf7] disabled:opacity-50">قبول</button>
                  <button onClick={() => decide(s.id, "REJECTED")} disabled={busy}
                    className="rounded-md bg-[#B45309] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">رفض</button>
                  <button onClick={() => decide(s.id, "DEFERRED")} disabled={busy}
                    className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.15)] disabled:opacity-50">تأجيل</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <form onSubmit={addSuggestion} className="rounded-lg border border-dashed border-[rgba(14,52,53,0.2)] p-3">
          <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} required
            placeholder="عنوان الاقتراح"
            className="mb-2 w-full rounded-md border border-[rgba(14,52,53,0.18)] px-3 py-2 text-sm" />
          <textarea value={sBody} onChange={(e) => setSBody(e.target.value)} required
            placeholder="نصّ الاقتراح" rows={2}
            className="mb-2 w-full rounded-md border border-[rgba(14,52,53,0.18)] px-3 py-2 text-sm" />
          <button type="submit" disabled={busy}
            className="rounded-md bg-[#0E3435] px-3 py-1.5 text-sm font-semibold text-[#FFFcf7] disabled:opacity-50">
            اقتراح إصلاح
          </button>
        </form>
      </section>
    </div>
  );
}
