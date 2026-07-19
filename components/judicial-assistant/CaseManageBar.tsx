"use client";

// لوحة تحكّم القضية — تعديل البيانات وحذف القضية (المالك فقط). human-in-the-loop: الحذف بتأكيد.
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { JaIcon } from "./icons";

const JURISDICTIONS = [
  { v: "general", l: "عامّ" }, { v: "commercial", l: "تجاريّ" }, { v: "labor", l: "عمّاليّ" },
  { v: "criminal", l: "جزائيّ" }, { v: "administrative", l: "إداريّ" },
];
const CONFID = [{ v: "normal", l: "عاديّة" }, { v: "restricted", l: "مقيّدة" }, { v: "secret", l: "سرّيّة" }];
const STAGES = [
  { v: "active", l: "نشطة" }, { v: "hearing_preparation", l: "تحضير جلسة" }, { v: "deliberation", l: "المداولة" },
  { v: "drafting", l: "الصياغة" }, { v: "quality_review", l: "مراجعة الجودة" }, { v: "appeal_review", l: "تحليل الاعتراض" }, { v: "closed", l: "مُغلقة" },
];

export function CaseManageBar({ caseId, initial }: {
  caseId: string;
  initial: { subject: string; caseNumber: string; court: string; circuit: string; jurisdiction: string; confidentiality: string; stage: string };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "confirmDelete">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initial);

  function upd(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحفظ.");
      setMode("idle"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر الحفظ."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/judicial-assistant/cases/${caseId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحذف.");
      router.push("/dashboard/judicial-assistant/cases"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذّر الحذف."); setBusy(false); }
  }

  if (mode === "idle") {
    return (
      <div className="ja-managebar">
        <button type="button" className="btn btn-outline" onClick={() => setMode("edit")}><JaIcon name="drafting" size={15} /> تعديل بيانات القضية</button>
        <button type="button" className="ja-danger-btn" onClick={() => setMode("confirmDelete")}><JaIcon name="quality" size={15} /> حذف القضية</button>
        {error ? <span className="ja-uploader__err">{error}</span> : null}
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <div className="ja-managebar ja-managebar--danger">
        <span>حذف القضية وكلّ مرفقاتها نهائيًّا؟ لا يمكن التراجع.</span>
        <button type="button" className="ja-danger-btn" onClick={() => void remove()} disabled={busy}>{busy ? "جارٍ الحذف…" : "تأكيد الحذف"}</button>
        <button type="button" className="btn btn-outline" onClick={() => setMode("idle")} disabled={busy}>إلغاء</button>
        {error ? <span className="ja-uploader__err">{error}</span> : null}
      </div>
    );
  }

  return (
    <form className="ja-createform" onSubmit={save}>
      <div className="ja-formgrid">
        <label className="ja-field ja-field--wide"><span>موضوع القضية</span><input value={form.subject} onChange={(e) => upd("subject", e.target.value)} /></label>
        <label className="ja-field"><span>رقم القضية</span><input value={form.caseNumber} onChange={(e) => upd("caseNumber", e.target.value)} /></label>
        <label className="ja-field"><span>المحكمة</span><input value={form.court} onChange={(e) => upd("court", e.target.value)} /></label>
        <label className="ja-field"><span>الدائرة</span><input value={form.circuit} onChange={(e) => upd("circuit", e.target.value)} /></label>
        <label className="ja-field"><span>المرحلة</span><select value={form.stage} onChange={(e) => upd("stage", e.target.value)}>{STAGES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></label>
        <label className="ja-field"><span>نوع القضاء</span><select value={form.jurisdiction} onChange={(e) => upd("jurisdiction", e.target.value)}>{JURISDICTIONS.map((j) => <option key={j.v} value={j.v}>{j.l}</option>)}</select></label>
        <label className="ja-field"><span>السرّيّة</span><select value={form.confidentiality} onChange={(e) => upd("confidentiality", e.target.value)}>{CONFID.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></label>
      </div>
      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}
      <div className="ja-formactions">
        <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ التعديل"}</button>
        <button type="button" className="btn btn-outline" onClick={() => { setForm(initial); setMode("idle"); }} disabled={busy}>إلغاء</button>
      </div>
    </form>
  );
}
