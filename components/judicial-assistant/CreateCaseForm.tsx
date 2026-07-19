"use client";

// إنشاء قضية (مشروع/مجلّد) يملكها القاضي — لا موصل «تقاضي». المدخل بيانات المستخدم.
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { JaIcon } from "./icons";

const JURISDICTIONS = [
  { v: "general", l: "عامّ" }, { v: "commercial", l: "تجاريّ" }, { v: "labor", l: "عمّاليّ" },
  { v: "criminal", l: "جزائيّ" }, { v: "administrative", l: "إداريّ" },
];
const CONFID = [{ v: "normal", l: "عاديّة" }, { v: "restricted", l: "مقيّدة" }, { v: "secret", l: "سرّيّة" }];

export function CreateCaseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ subject: "", caseNumber: "", court: "", circuit: "", jurisdiction: "general", confidentiality: "normal" });

  function upd(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.subject.trim().length < 3) { setError("أدخل موضوع القضية."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/judicial-assistant/cases", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) throw new Error(data?.message || "تعذّر الإنشاء.");
      router.push(`/dashboard/judicial-assistant/cases/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الإنشاء.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-gold" onClick={() => setOpen(true)}>
        <JaIcon name="case" size={16} /> إنشاء قضية
      </button>
    );
  }

  return (
    <form className="card ja-panel ja-createform" onSubmit={submit}>
      <h2 className="ja-panel__title"><JaIcon name="case" size={18} /> قضية جديدة (مشروع)</h2>
      <div className="ja-formgrid">
        <label className="ja-field ja-field--wide">
          <span>موضوع القضية *</span>
          <input value={form.subject} onChange={(e) => upd("subject", e.target.value)} placeholder="مثال: مطالبة بقيمة عقد توريد" required />
        </label>
        <label className="ja-field"><span>رقم القضية</span><input value={form.caseNumber} onChange={(e) => upd("caseNumber", e.target.value)} placeholder="اختياريّ" /></label>
        <label className="ja-field"><span>المحكمة</span><input value={form.court} onChange={(e) => upd("court", e.target.value)} placeholder="اختياريّ" /></label>
        <label className="ja-field"><span>الدائرة</span><input value={form.circuit} onChange={(e) => upd("circuit", e.target.value)} placeholder="اختياريّ" /></label>
        <label className="ja-field"><span>نوع القضاء</span>
          <select value={form.jurisdiction} onChange={(e) => upd("jurisdiction", e.target.value)}>
            {JURISDICTIONS.map((j) => <option key={j.v} value={j.v}>{j.l}</option>)}
          </select>
        </label>
        <label className="ja-field"><span>السرّيّة</span>
          <select value={form.confidentiality} onChange={(e) => upd("confidentiality", e.target.value)}>
            {CONFID.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </label>
      </div>
      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}
      <div className="ja-formactions">
        <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء وفتح"}</button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} disabled={busy}>إلغاء</button>
      </div>
    </form>
  );
}
